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

// ── 질문지 전체 인쇄 (요약 없이 A/B/C 전체) ────────────────────────────
// [면접 직전 한 장]은 A급 5개·90자 요약이지만, 이건 저장된 질문 전체를
// 페이지 제한 없이 인쇄합니다(길면 여러 장으로 자연스럽게 넘어갑니다).
const QUESTIONS_PRINT_EVIDENCE_LIMIT = 200;

function buildQuestionsPrintHtml(state) {
  const uni = getActiveUniversity();
  const groups = [
    { key: "A", label: "A · 반드시 준비" },
    { key: "B", label: "B · 준비 권장" },
    { key: "C", label: "C · 여유가 있으면" },
    { key: null, label: "우선순위 미지정" },
  ];
  const qs = state.questions || [];

  const sectionsHtml = groups.map((g) => {
    const pool = qs.filter((q) => (q.priority || null) === g.key);
    if (!pool.length) return "";
    const items = pool.map((q) => {
      const hint = q.hint ? `<span class="print-q-sub">힌트: ${escapeHtml(q.hint)}</span>` : "";
      let evidence = "";
      if (q.evidenceText) {
        const ev = typeof redactCommonPii === "function" ? redactCommonPii(String(q.evidenceText)) : String(q.evidenceText);
        const cut = truncate(ev, QUESTIONS_PRINT_EVIDENCE_LIMIT);
        evidence = `<span class="print-q-sub">근거(${escapeHtml(q.evidenceSection || "학생부")}): ${escapeHtml(cut)}</span>`;
      }
      return `<li><span class="print-q-main">[${escapeHtml(q.directionLabel || "질문")}] ${escapeHtml(q.text || "")}</span>${hint}${evidence}</li>`;
    }).join("");
    return `<section class="print-section"><h2>${escapeHtml(g.label)} (${pool.length}개)</h2><ol class="print-q-list">${items}</ol></section>`;
  }).join("");

  return `
  <div id="print-sheet-content" class="print-a4">
    <header class="print-header">
      <h1>면접 예상질문 전체</h1>
      <p class="print-caution">실제 대학 기출문항이 아니라 본인이 정리·연습한 예상질문입니다. 면접실 반입 가능 여부는 대학마다 다르니 대학 안내를 반드시 확인하세요.</p>
    </header>
    <section class="print-section">
      <h2>대학 · 학과 · 전형</h2>
      <p>${escapeHtml(uni?.name || "(미입력)")} · ${escapeHtml(uni?.major || "")} · ${escapeHtml(uni?.track || "")}</p>
    </section>
    ${sectionsHtml || '<section class="print-section"><p>저장된 질문이 없습니다.</p></section>'}
  </div>`;
}

function openQuestionsPrintView(state) {
  if (!(state.questions || []).length) { toast("인쇄할 질문이 없습니다. 먼저 질문을 만들어주세요."); return; }
  runPrintMount(buildQuestionsPrintHtml(state));
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
