/**
 * print.js
 * A4 1장을 넘지 않도록 각 항목의 글자 수를 제한하고, 인쇄 시 UI 요소를 숨깁니다.
 * 학생부 원문 전체나 성적·수상 등 식별 정보는 자동으로 넣지 않습니다.
 * (실전 면접실 반입 가능 여부는 대학마다 다르므로 화면에 안내 문구를 함께 넣습니다.)
 */

const PRINT_LIMITS = {
  intro: 60,       // 30초 자기소개 키워드
  motive: 80,      // 지원동기 한 줄
  activityName: 20,
  activityNote: 40,
  lastWord: 60,
  question: 90,
};

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function buildPrintSheetHtml(state) {
  const uni = getActiveUniversity();
  const activities = (state.activities || []).slice(0, 3);
  const crisis = window.APP_DATA.crisisCards.slice(0, 2);
  const coreQuestions = (state.questions || []).filter((q) => q.priority === "A").slice(0, 5);
  const weaknessSummary = (state.weaknessEntries || []).map((w) => {
    const parts = [w.category, w.accept, w.effort, w.result].filter(Boolean);
    return parts.join(": ");
  }).filter(Boolean).join(" / ");

  return `
  <div id="print-sheet-content" class="print-a4">
    <header class="print-header">
      <h1>면접 직전 한 장</h1>
      <p class="print-caution">이 종이의 실제 면접실 반입 가능 여부는 대학마다 다릅니다. 대학 안내를 반드시 확인하세요.</p>
    </header>
    <section class="print-section">
      <h2>대학 · 학과 · 면접정보</h2>
      <p>${escapeHtml(uni?.name || "(미입력)")} · ${escapeHtml(uni?.major || "")} · ${escapeHtml(uni?.track || "")}</p>
      <p>면접일: ${escapeHtml(uni?.interviewDate || "미입력")} / 입실: ${escapeHtml(uni?.checkInTime || "-")} / 장소: ${escapeHtml(uni?.location || "-")}</p>
    </section>
    <section class="print-section">
      <h2>30초 자기소개 키워드</h2>
      <p>${escapeHtml(truncate(state.introKeywords || "", PRINT_LIMITS.intro))}</p>
    </section>
    <section class="print-section">
      <h2>지원동기 한 줄</h2>
      <p>${escapeHtml(truncate(state.motiveOneLine || "", PRINT_LIMITS.motive))}</p>
    </section>
    <section class="print-section">
      <h2>핵심활동 3개</h2>
      <ol>
        ${activities.map((a) => `<li><strong>${escapeHtml(truncate(a.name || "", PRINT_LIMITS.activityName))}</strong> — ${escapeHtml(truncate(a.summary || "", PRINT_LIMITS.activityNote))}</li>`).join("") || "<li>미입력</li>"}
      </ol>
    </section>
    <section class="print-section">
      <h2>면접 직전 핵심 질문</h2>
      <ol>${coreQuestions.map((q) => `<li>${escapeHtml(truncate(q.text || "", PRINT_LIMITS.question))}</li>`).join("") || "<li>핵심 질문 미생성</li>"}</ol>
    </section>
    <section class="print-section">
      <h2>설명이 필요한 부분</h2>
      <p>${escapeHtml(truncate(weaknessSummary, 60))}</p>
    </section>
    <section class="print-section">
      <h2>마지막 할 말</h2>
      <p>${escapeHtml(truncate(state.lastWord || "", PRINT_LIMITS.lastWord))}</p>
    </section>
    <section class="print-section two-col">
      <div>
        <h2>면접장에서 쓸 문장</h2>
        <ul>${crisis.map((c) => `<li>"${escapeHtml(c.line)}"</li>`).join("")}</ul>
      </div>
      <div>
        <h2>블라인드 주의</h2>
        <p>학교명·지역명·숫자·실명은 대학 안내에서 다시 확인하세요.</p>
      </div>
    </section>
  </div>`;
}

function openPrintView(state) {
  runPrintMount(buildPrintSheetHtml(state));
}

// ── 질문지 인쇄: 모든 질문 / 저장된 질문 분리 ────────────────────────────
// "모든 질문"은 AI 전체분석 결과에 보이는 A/B/C, 활동별 질문, 꼬리질문과
// 질문은행에 저장된 추가 질문을 합쳐 중복을 제거합니다.
// "저장된 질문만"은 AppState.questions(질문은행)에 들어간 질문만 인쇄합니다.
const QUESTIONS_PRINT_EVIDENCE_LIMIT = 200;

function printableQuestionText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") return String(value.question || value.text || value.content || "").trim();
  return "";
}

function printableQuestionKey(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, "").replace(/[\p{P}\p{S}]/gu, "");
}

function savedPrintableQuestions(state) {
  return (state.questions || []).filter((q) => printableQuestionText(q.text));
}

function collectAllPrintableQuestions(state) {
  const out = [];
  const seen = new Set();
  const add = (item) => {
    const text = printableQuestionText(item.text || item.question);
    const key = printableQuestionKey(text);
    if (!text || !key || seen.has(key)) return;
    seen.add(key);
    out.push({
      text,
      priority: item.priority || null,
      directionLabel: item.directionLabel || item.type || item.depth || "질문",
      hint: item.hint || "",
      evidenceText: item.evidenceText || item.evidenceQuote || "",
      evidenceSection: item.evidenceSection || item.evidenceArea || item.area || "",
      printGroup: item.printGroup || "기타 질문",
      source: item.source || "",
    });
  };

  const data = state.aiResultSections || null;
  if (data) {
    [["A", data.priorityA], ["B", data.priorityB], ["C", data.priorityC]].forEach(([priority, list]) => {
      (list || []).forEach((q) => add({
        ...q,
        text: printableQuestionText(q),
        priority,
        directionLabel: q.depth || q.type || "핵심질문",
        evidenceText: q.evidenceQuote || "",
        evidenceSection: q.evidenceArea || "",
        printGroup: `${priority} · ${priority === "A" ? "반드시 준비" : priority === "B" ? "준비 권장" : "여유가 있으면"}`,
        source: "AI 전체분석",
      }));
    });

    (data.activityInventory || []).forEach((activity) => {
      (activity.questions || []).forEach((q) => add({
        ...q,
        text: printableQuestionText(q),
        priority: null,
        directionLabel: q.type || q.depth || "활동질문",
        evidenceText: activity.evidenceQuote || "",
        evidenceSection: activity.area || activity.title || "",
        printGroup: "활동별 전체 예상질문",
        source: activity.title || "AI 활동분석",
      }));
      (activity.followUpQuestions || []).forEach((q) => add({
        text: printableQuestionText(q),
        directionLabel: "꼬리질문",
        evidenceText: activity.evidenceQuote || "",
        evidenceSection: activity.area || activity.title || "",
        printGroup: "활동별 꼬리질문",
        source: activity.title || "AI 활동분석",
      }));
    });

    (data.followUpQuestions || []).forEach((group) => {
      const qs = Array.isArray(group?.questions) ? group.questions : [group];
      qs.forEach((q) => add({
        text: printableQuestionText(q),
        directionLabel: "꼬리질문",
        evidenceText: group?.evidenceQuote || "",
        evidenceSection: group?.evidenceArea || group?.topic || "",
        printGroup: "예상 꼬리질문",
        source: group?.topic || "AI 전체분석",
      }));
    });
  }

  // AI 결과 밖에서 직접 추가·생성한 질문(MMI, 수동 질문 등)도 "모든 질문"에 포함합니다.
  savedPrintableQuestions(state).forEach((q) => add({
    ...q,
    text: q.text,
    printGroup: q.priority
      ? `${q.priority} · ${q.priority === "A" ? "반드시 준비" : q.priority === "B" ? "준비 권장" : "여유가 있으면"}`
      : "저장된 추가 질문",
    source: q.source || "질문은행",
  }));

  return out;
}

function hasAllPrintableQuestions(state) {
  return collectAllPrintableQuestions(state).length > 0;
}

function hasSavedPrintableQuestions(state) {
  return savedPrintableQuestions(state).length > 0;
}

function renderPrintQuestionItem(q) {
  const hint = q.hint ? `<span class="print-q-sub">힌트: ${escapeHtml(q.hint)}</span>` : "";
  let evidence = "";
  if (q.evidenceText) {
    const ev = typeof redactCommonPii === "function" ? redactCommonPii(String(q.evidenceText)) : String(q.evidenceText);
    const cut = truncate(ev, QUESTIONS_PRINT_EVIDENCE_LIMIT);
    evidence = `<span class="print-q-sub">근거(${escapeHtml(q.evidenceSection || "학생부")}): ${escapeHtml(cut)}</span>`;
  }
  const source = q.source ? `<span class="print-q-sub">출처: ${escapeHtml(q.source)}</span>` : "";
  return `<li><span class="print-q-main">[${escapeHtml(q.directionLabel || "질문")}] ${escapeHtml(q.text || "")}</span>${hint}${evidence}${source}</li>`;
}

function buildQuestionsPrintHtml(state, scope) {
  const mode = scope === "all" ? "all" : "saved";
  const uni = getActiveUniversity();
  const title = mode === "all" ? "면접 예상질문 - 모든 질문" : "면접 예상질문 - 저장된 질문만";
  const qs = mode === "all" ? collectAllPrintableQuestions(state) : savedPrintableQuestions(state).map((q) => ({
    ...q,
    printGroup: q.priority
      ? `${q.priority} · ${q.priority === "A" ? "반드시 준비" : q.priority === "B" ? "준비 권장" : "여유가 있으면"}`
      : "우선순위 미지정",
    source: q.source || "질문은행",
  }));

  const preferredOrder = [
    "A · 반드시 준비", "B · 준비 권장", "C · 여유가 있으면",
    "활동별 전체 예상질문", "활동별 꼬리질문", "예상 꼬리질문",
    "저장된 추가 질문", "우선순위 미지정", "기타 질문",
  ];
  const groupMap = new Map();
  qs.forEach((q) => {
    const key = q.printGroup || "기타 질문";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(q);
  });
  const groupNames = [...groupMap.keys()].sort((a, b) => {
    const ia = preferredOrder.indexOf(a), ib = preferredOrder.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  const sectionsHtml = groupNames.map((name) => {
    const pool = groupMap.get(name) || [];
    return `<section class="print-section"><h2>${escapeHtml(name)} (${pool.length}개)</h2><ol class="print-q-list">${pool.map(renderPrintQuestionItem).join("")}</ol></section>`;
  }).join("");

  const scopeNote = mode === "all"
    ? "AI 전체분석 화면에 나타난 질문(저장하지 않은 질문 포함)과 질문은행의 추가 질문을 합쳐 중복을 제거한 목록입니다."
    : "질문은행에 직접 저장·추가한 질문만 모은 목록입니다.";

  return `
  <div id="print-sheet-content" class="print-a4">
    <header class="print-header">
      <h1>${escapeHtml(title)}</h1>
      <p class="print-caution">${escapeHtml(scopeNote)} 실제 대학 기출문항이 아니라 면접 준비용 예상질문이며, 면접실 반입 가능 여부는 대학 안내를 확인하세요.</p>
    </header>
    <section class="print-section">
      <h2>대학 · 학과 · 전형</h2>
      <p>${escapeHtml(uni?.name || "(미입력)")} · ${escapeHtml(uni?.major || "")} · ${escapeHtml(uni?.track || "")}</p>
      <p>총 ${qs.length}개 질문</p>
    </section>
    ${sectionsHtml || `<section class="print-section"><p>${mode === "all" ? "현재 인쇄할 질문이 없습니다." : "저장된 질문이 없습니다."}</p></section>`}
  </div>`;
}

function openAllQuestionsPrintView(state) {
  if (!hasAllPrintableQuestions(state)) { toast("인쇄할 질문이 없습니다. 먼저 AI 분석 또는 질문 생성을 진행해주세요."); return; }
  runPrintMount(buildQuestionsPrintHtml(state, "all"));
}

function openSavedQuestionsPrintView(state) {
  if (!hasSavedPrintableQuestions(state)) { toast("저장된 질문이 없습니다. 질문은행에 질문을 저장한 뒤 이용해주세요."); return; }
  runPrintMount(buildQuestionsPrintHtml(state, "saved"));
}

// 이전 버전 호출과의 호환: 기존 함수는 '저장된 질문만 인쇄'로 유지합니다.
function openQuestionsPrintView(state) {
  openSavedQuestionsPrintView(state);
}

function runPrintMount(html) {
  const container = document.getElementById("print-mount");
  container.innerHTML = html;
  document.body.classList.add("printing-active");
  setTimeout(() => {
    window.print();
    document.body.classList.remove("printing-active");
  }, 50);
}
