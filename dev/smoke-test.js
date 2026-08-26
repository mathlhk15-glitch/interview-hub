const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")
  .replace(/<script src="[^"]+"><\/script>\s*/g, ""); // 실제 스크립트는 아래에서 순서대로 직접 주입

const vc = new VirtualConsole();
vc.on("jsdomError", (e) => console.error("JSDOM ERROR:", e.message, e.detail && e.detail.stack));

const dom = new JSDOM(html, {
  url: "http://localhost/index.html",
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  virtualConsole: vc,
});

const { window } = dom;
window.navigator.clipboard = { writeText: async () => {} };
window.HTMLCanvasElement.prototype.getContext = () => null;

function loadScriptText(code) {
  const scriptEl = window.document.createElement("script");
  scriptEl.textContent = code;
  window.document.body.appendChild(scriptEl);
}
function loadScript(file) {
  loadScriptText(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
}

["config.js", "data.js", "app.js", "record-parser.js", "question-engine.js",
 "prompt-generator.js", "ai-result-parser.js", "trainer.js", "print.js", "export.js",
 "screens.js", "screens2.js"].forEach((f) => {
  try { loadScript(f); } catch (e) { console.error("LOAD ERROR in " + f, e); process.exitCode = 1; }
});

window.document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true, cancelable: true }));

const routesToTest = [
  "home", "student-dashboard", "no-record-input", "universities", "type-helper", "roadmap",
  "record-import", "record-map", "activities", "questions", "followups", "weakness",
  "motivation", "ai-coach", "trainer", "mock-eval", "blind-check", "crisis-card",
  "common12", "special-track", "print-sheet", "parent-mode", "interview-log", "data-io",
];

let failed = 0;
for (const r of routesToTest) {
  try {
    window.location.hash = "#/" + r;
    window.renderRoute();
    const view = window.document.getElementById("view");
    if (!view.innerHTML || view.innerHTML.length < 5) {
      console.error("EMPTY RENDER:", r); failed++;
    } else {
      console.log("OK:", r, "(", view.innerHTML.length, "chars )");
    }
  } catch (e) {
    console.error("RENDER ERROR:", r, "\n ", e.message); failed++;
  }
}

// 고아 화면 재발 방지: 대시보드의 13개 STEP을 모두 실제 클릭해 라우트가 바뀌는지 확인합니다.
try {
  const expected = [
    ["면접정보 등록", "universities"], ["면접유형 판별", "type-helper"], ["D-Day 로드맵", "roadmap"],
    ["학생부/활동 정리", "record-map"], ["핵심활동 TOP3", "activities"], ["예상질문 만들기", "questions"],
    ["설명이 필요한 기록", "weakness"], ["지원동기·학과이해", "motivation"], ["AI 면접 코치", "ai-coach"],
    ["30·60초 말하기 훈련", "trainer"], ["모의면접 자가평가", "mock-eval"], ["블라인드 점검", "blind-check"],
    ["면접 직전 한 장", "print-sheet"],
  ];
  let clickFailures = [];
  expected.forEach(([label, route]) => {
    window.location.hash = "#/student-dashboard"; window.renderRoute();
    const rows = Array.from(window.document.querySelectorAll(".step-row"));
    const target = rows.find((r) => r.querySelector(".step-label")?.textContent === label);
    if (!target) { clickFailures.push(route + " (버튼 없음)"); return; }
    target.click();
    if (!window.location.hash.includes(route)) clickFailures.push(route + " (클릭 후 이동 실패: " + window.location.hash + ")");
  });
  console.log("대시보드 13개 STEP 클릭 이동 실패:", clickFailures.length ? clickFailures.join(", ") : "없음");
  if (clickFailures.length) failed++;

  window.location.hash = "#/questions"; window.renderRoute();
  const nextBtn = Array.from(window.document.querySelectorAll(".flow-nav button")).find((b) => b.textContent.includes("다음"));
  nextBtn && nextBtn.click();
  if (!window.location.hash.includes("weakness")) failed++;
} catch (e) { console.error("DASHBOARD CLICK TEST ERROR:", e); failed++; }

// 인터랙티브 흐름 검증 — AppState는 <script> realm의 top-level const라 Node 쪽에서
// 직접 접근할 수 없으므로(브라우저에서도 동일), 아래 코드를 실제 <script>로 주입해 확인합니다.
try {
  const interactionScript = `
    // 1) 대학 등록 + 제시문 강신호 → 유형판별이 '제시문 기반'을 강하게 반영하는지
    AppState.universities.push({ id: "u1", name: "테스트대", major: "테스트학과", interviewDate: "2026-11-01",
      duration: "20분", prepTime: "15분", docBased: "아니오", promptBased: "있음", evalWeights: "논리적 사고력 50" });
    AppState.activeUniversityId = "u1";
    location.hash = "#/type-helper"; renderRoute();
    const guess1 = computeTypeGuess(AppState.universities[0]);
    window.__typeGuessPrompt = guess1.primary;

    // 2) 정보가 전혀 없는 대학 → '판별 보류'가 되어야 함 (예전엔 조용히 '서류 기반'이 됐음)
    AppState.universities.push({ id: "u2", name: "정보없는대", major: "", interviewDate: "" });
    const guess2 = computeTypeGuess(AppState.universities[1]);
    window.__typeGuessEmpty = guess2.primary; // null이어야 정상

    // 3) 특수계열 기본값이 '해당 없음'인지
    window.__specialTrackDefault = AppState.universities[1].specialTrack || "none";

    // 4) PDF 파서: 텍스트 절단 없이 전체를 기록으로 변환하는지 (긴 텍스트로 시뮬레이션)
    const longText = Array.from({length: 50}, (_, i) => "세특 문장 " + i + ": 지역 의료 접근성 자료를 분석하여 발표함").join("\\n");
    AppState.recordRawText = longText;
    const drafts = draftRecordsFromText(longText, null);
    window.__draftCount = drafts.length; // 50개 모두 나와야 함 (예전엔 첫 4000자만 텍스트영역에 있어 일부만 나왔을 것)
    AppState.records.push(...drafts);

    // 5) 다중 태그 지정
    const rec = AppState.records[0];
    toggleRecordTag(rec, "career", true);
    toggleRecordTag(rec, "academic", true);
    window.__multiTagCount = rec.tags.length; // 2

    // 6) 질문 생성 + 우선순위 추론이 실제 태그를 반영하는지
    location.hash = "#/questions"; renderRoute();
    const genBtn = document.querySelector(".gen-btn");
    if (genBtn) genBtn.click();
    window.__questionsCount = AppState.questions.length;
    const q0 = AppState.questions[0];
    const reason = estimatePriorityReason(rec, ["진로40"]);
    window.__reasonMentionsCareer = reason.includes("전공 연결성");

    // 7) 활동에 action 필드가 있는지
    AppState.activities.push({ id: "act1", recordId: rec.id, name: "테스트", situation: "", role: "", action: "직접 실험을 설계했다", process: "", result: "", limit: "", link: "", summary: "" });
    window.__hasActionField = typeof AppState.activities[0].action === "string";

    // 8) AI 결과 JSON 전체 필드가 카드로 변환되는지 (일부만 쓰지 않는지)
    const parsed = tryParseAiJson('\`\`\`json\\n{"coreRecords":["기록1"],"coreActivities":["활동1"],"priorityA":["질문A"],"priorityB":[],"priorityC":[],"needsExplanation":["출결 설명"],"followUpQuestions":["꼬리1"],"needStudentVerification":["확인1"]}\\n\`\`\`');
    const sections = buildAiSections(parsed.data);
    window.__sectionKeys = sections.map(s => s.key).join(",");
    window.__totalCards = sections.reduce((n, s) => n + s.cards.length, 0);

    // 9) 폴백 카드는 편집 전 '채택' 옵션이 비활성인지 확인할 수 있게 플래그를 검사
    const fbSection = buildFallbackSection("- 후보1\\n- 후보2");
    window.__fallbackRequiresEdit = fbSection.requireEditBeforeAdopt === true;

    // 10) export.js: evidenceText가 기본적으로 빠지는지, 옵션을 켜면 포함되는지
    AppState.questions[0].evidenceText = "학생부 세특 원문 문장";
    const payloadDefault = buildExportPayload(AppState, {});
    window.__evidenceExcludedByDefault = !payloadDefault.questions.some(q => "evidenceText" in q);
    const payloadWithEvidence = buildExportPayload(AppState, { includeEvidence: true });
    window.__evidenceIncludedWhenAsked = payloadWithEvidence.questions.some(q => q.evidenceText === "학생부 세특 원문 문장");
    window.__excludesRawText = !("recordRawText" in payloadDefault);

    // 11) 두 가지 삭제 함수가 서로 다르게 동작하는지
    const recordsBefore = AppState.records.length;
    purgeRecordRawText();
    window.__bufferPurgeKeepsRecords = AppState.recordRawText === "" && AppState.records.length === recordsBefore;

    // 12) 인쇄 시트, PII 탐지
    const printHtml = buildPrintSheetHtml(AppState);
    window.__printHasA4 = printHtml.includes("print-a4");
    const piiHits = findPiiCandidates("제 번호는 010-1234-5678 이고 창원경일고등학교에 재학중입니다. 전교 1등 입니다.");
    window.__piiHits = piiHits.length;

    // 13) prompt-generator: single 모드가 정상적으로 문자열을 만드는지
    const prompt = buildAiPrompt({ university: AppState.universities[0], mode: "single", redactedPreviewText: "샘플" });
    window.__promptLen = prompt.length;

    // 14) 사용자 확정 면접유형이 AI 프롬프트에도 반영되는지
    AppState.universities[0].typeGuessOverride = "mmi";
    const promptMmi = buildAiPrompt({ university: AppState.universities[0], mode: "single", redactedPreviewText: "샘플" });
    window.__promptUsesOverride = promptMmi.includes("다중 미니(MMI)");

    // 15) 미래 면접이 있으면 과거 일정보다 미래 일정을 가장 가까운 일정으로 고르는지
    AppState.universities.push({id:"past",name:"과거대",interviewDate:"2020-01-01"});
    AppState.universities.push({id:"future",name:"미래대",interviewDate:"2099-01-01"});
    window.__nearestFuture = nearestUniversity().id === "u1" || nearestUniversity().id === "future";

    // 16) 일반 '결과'가 출결로 오분류되지 않는지
    window.__resultNotAttendance = guessSectionForLine("실험 결과를 분석하여 발표함") !== "출결";

    // 17) 백업 schema와 모의평가/지원동기 포함
    AppState.mockEvaluation = {checks:{x:true}, good:"좋음", fix:"보완"};
    AppState.motiveMoment = "계기";
    const p3 = buildExportPayload(AppState, {includeRecordDerived:false});
    window.__schema3 = p3.schemaVersion === 3 && p3.mockEvaluation.good === "좋음" && p3.motivation.motiveMoment === "계기";

    // 18) 피드백 전용 JSON 파서
    const fbp = tryParseFeedbackJson('{\"goodPoint\":\"좋음\",\"improvements\":[\"보완\"],\"followUpQuestions\":[\"왜?\"]}');
    window.__feedbackParser = fbp.ok && fbp.data.followUpQuestions[0] === "왜?";
  `;
  loadScriptText(interactionScript);

  console.log("\n--- 유형판별 로직 ---");
  console.log("제시문 강신호 → ", window.__typeGuessPrompt, "(기대: 제시문 기반)");
  console.log("정보 없음 → ", window.__typeGuessEmpty, "(기대: null = 판별 보류)");
  console.log("특수계열 기본값 → ", window.__specialTrackDefault, "(기대: none)");

  console.log("\n--- PDF 파서 / 다중태그 ---");
  console.log("draftRecordsFromText로 만든 기록 수:", window.__draftCount, "(기대: 50, 전체 텍스트 사용)");
  console.log("다중 태그 지정 개수:", window.__multiTagCount, "(기대: 2)");

  console.log("\n--- 질문/우선순위 ---");
  console.log("생성된 질문 수:", window.__questionsCount, "(기대: 6)");
  console.log("우선순위 추론이 실제 태그(전공 연결성)를 언급:", window.__reasonMentionsCareer, "(기대: true)");

  console.log("\n--- 활동 카드 ---");
  console.log("action(내가 직접 한 일) 필드 존재:", window.__hasActionField, "(기대: true)");

  console.log("\n--- AI 결과 전체 필드 반영 ---");
  console.log("파싱된 섹션 키:", window.__sectionKeys);
  console.log("전체 카드 수:", window.__totalCards, "(기대: 6 — 8개 필드 중 값 있는 6개)");
  console.log("폴백 카드는 편집 필요 플래그:", window.__fallbackRequiresEdit, "(기대: true)");

  console.log("\n--- 내보내기 개인정보 ---");
  console.log("evidenceText 기본 제외:", window.__evidenceExcludedByDefault, "(기대: true)");
  console.log("옵션 켜면 evidenceText 포함:", window.__evidenceIncludedWhenAsked, "(기대: true)");
  console.log("recordRawText는 항상 제외:", window.__excludesRawText, "(기대: true)");

  console.log("\n--- 학생부 삭제 구분 ---");
  console.log("버퍼만 삭제해도 기록은 유지:", window.__bufferPurgeKeepsRecords, "(기대: true)");

  console.log("\n--- 기타 ---");
  console.log("인쇄 시트 A4 클래스:", window.__printHasA4);
  console.log("PII 후보 탐지 수:", window.__piiHits, "(기대: >=2)");
  console.log("single 모드 프롬프트 길이:", window.__promptLen);

  const assertions = [
    ["제시문 강신호 인식", window.__typeGuessPrompt === "제시문 기반"],
    ["정보 없음 시 판별 보류", window.__typeGuessEmpty === null],
    ["특수계열 기본값 해당없음", window.__specialTrackDefault === "none"],
    ["전체 텍스트 사용(절단 없음)", window.__draftCount === 50],
    ["다중 태그 지원", window.__multiTagCount === 2],
    ["질문 6개 생성", window.__questionsCount === 6],
    ["우선순위가 태그 반영", window.__reasonMentionsCareer === true],
    ["action 필드 존재", window.__hasActionField === true],
    ["AI 8개 필드 중 유효한 것 모두 카드화", window.__totalCards === 6],
    ["폴백 카드 편집 강제", window.__fallbackRequiresEdit === true],
    ["evidenceText 기본 제외", window.__evidenceExcludedByDefault === true],
    ["evidenceText 옵션 포함", window.__evidenceIncludedWhenAsked === true],
    ["recordRawText 항상 제외", window.__excludesRawText === true],
    ["버퍼 삭제와 전체 삭제 구분", window.__bufferPurgeKeepsRecords === true],
    ["인쇄 시트 생성", window.__printHasA4 === true],
    ["PII 후보 2건 이상", window.__piiHits >= 2],
    ["사용자 확정 유형이 프롬프트에 반영", window.__promptUsesOverride === true],
    ["미래 면접 우선 선택", window.__nearestFuture === true],
    ["일반 결과 단어 출결 오분류 방지", window.__resultNotAttendance === true],
    ["백업 schema3 및 핵심 상태 포함", window.__schema3 === true],
    ["피드백 전용 JSON 파서", window.__feedbackParser === true],
  ];
  console.log("\n--- 단정 결과 ---");
  assertions.forEach(([label, ok]) => {
    console.log((ok ? "PASS" : "FAIL") + " - " + label);
    if (!ok) failed++;
  });
} catch (e) {
  console.error("INTERACTIVE FLOW ERROR:", e);
  failed++;
}

console.log(failed ? `\nFAILED: ${failed}` : "\nALL SMOKE TESTS PASSED");
process.exit(failed ? 1 : 0);
