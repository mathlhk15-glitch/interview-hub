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
};

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function buildPrintSheetHtml(state) {
  const uni = getActiveUniversity();
  const activities = (state.activities || []).slice(0, 3);
  const crisis = window.APP_DATA.crisisCards.slice(0, 2);
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
  const container = document.getElementById("print-mount");
  container.innerHTML = buildPrintSheetHtml(state);
  document.body.classList.add("printing-active");
  setTimeout(() => {
    window.print();
    document.body.classList.remove("printing-active");
  }, 50);
}
