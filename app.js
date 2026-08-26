/**
 * app.js — 앱 코어
 *
 * 저장 정책 (중요):
 *  - localStorage에는 아래 ALLOWED_LOCAL_KEYS에 있는 "민감하지 않은 설정"만 저장합니다.
 *    (테마, 마지막으로 본 화면, 튜토리얼 완료 여부)
 *  - 대학 정보·활동·질문·답변 등 준비 데이터, 생활기록부 원문, 녹음은
 *    localStorage에 자동 저장하지 않습니다. 사용자가 명시적으로
 *    [내 준비 데이터 저장(JSON)]을 눌러야만 파일로 내려받습니다.
 *  - 생활기록부 원문과 녹음은 메모리(state)에만 있다가 새로고침·탭 종료·
 *    [PDF 원문 버퍼 삭제]/[학생부 관련 항목 전체 삭제] 실행 시 사라집니다.
 */

const ALLOWED_LOCAL_KEYS = ["theme", "lastScreen", "tutorialDone"];

const AppState = {
  // 화면단 임시 데이터 (새로고침 시 소멸) — 학생부 원문·녹음은 반드시 여기까지만
  universities: [],      // STEP1 대학 카드 목록
  activeUniversityId: null,
  records: [],           // 학생부/직접입력에서 파생된 "기록" 목록. 태그는 record.tags(배열)
  recordRawText: "",     // 학생부 원문 전체(텍스트, 절단 없음). 내보내기 대상 아님.
  activities: [],         // 핵심활동 카드 (최대 3)
  questions: [],          // 생성된 질문들 {direction, text, priority, source, recordId}
  interviewLogs: [],      // 면접 후기
  aiResultRaw: "",        // 마지막으로 붙여넣은 AI 결과 원문(내보내기 제외)
  weaknessEntries: [],    // 설명이 필요한 기록 4단계 입력
  commonAnswers: {},      // 빈출 12유형 키워드 { [id]: text }
  mockEvaluation: { checks: {}, good: "", fix: "" }, // 모의면접 자가평가 저장값
  aiResultSections: null, // 마지막 AI 전체분석 결과
  aiDeepResult: null,     // 마지막 핵심활동 심화분석 결과
  aiVerificationNotes: [], // AI가 "학생이 직접 확인해야 할 내용"으로 표시한 것 중 채택된 항목
  analysisResult: null,    // 자동 면접 분석 결과(핵심기록/질문/설명필요 등)
  analysisUpdatedAt: null, // 마지막 자동분석 시각
};

function saveLocalSetting(key, value) {
  if (!ALLOWED_LOCAL_KEYS.includes(key)) return;
  try { localStorage.setItem("ihub:" + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}
function loadLocalSetting(key, fallback) {
  if (!ALLOWED_LOCAL_KEYS.includes(key)) return fallback;
  try {
    const v = localStorage.getItem("ihub:" + key);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}

// ── 공용 유틸 ────────────────────────────────────────────────────────
function uid(prefix) {
  return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 9);
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function toast(msg) {
  const box = document.getElementById("toast-box");
  const item = el(`<div class="toast">${escapeHtml(msg)}</div>`);
  box.appendChild(item);
  requestAnimationFrame(() => item.classList.add("show"));
  setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 300); }, 2600);
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  return diff;
}
function fmtDday(n) {
  if (n === null) return "날짜 미입력";
  if (n > 0) return `D-${n}`;
  if (n === 0) return "D-Day (오늘)";
  return `D+${Math.abs(n)} (지난 일정)`;
}

function hasImportedStudentRecord() {
  return !!(String(AppState.recordRawText || "").trim()) || AppState.records.some((r) => r.source === "학생부/붙여넣기");
}
function hasDirectActivityRecords() {
  return AppState.records.some((r) => r.source === "직접 입력");
}
function navigateAiMode(mode) {
  navigate("ai-coach", { mode });
}

// ── 개인정보 후보 탐지 (경고용, 자동 확정 아님) ───────────────────────
function findPiiCandidates(text) {
  const hits = new Set();
  if (!text) return [];
  const patterns = [
    { label: "전화번호로 보이는 숫자", re: /01[0-9][-\s]?\d{3,4}[-\s]?\d{4}/g },
    { label: "이메일로 보이는 문자열", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
    { label: "학교명으로 보이는 표현(○○고/중/초)", re: /[가-힣A-Za-z0-9]+(고등학교|중학교|초등학교|고교)/g },
    { label: "숫자로 된 등급/석차 표현", re: /(전교\s?\d+\s?등|\d\s?등급)/g },
    { label: "생년월일로 보이는 표현", re: /(19|20)\d{2}[.\-/]\s?(0?[1-9]|1[0-2])[.\-/]\s?(0?[1-9]|[12]\d|3[01])/g },
  ];
  patterns.forEach((p) => {
    const m = text.match(p.re);
    if (m && m.length) hits.add(`${p.label} (${m.length}건)`);
  });
  return Array.from(hits);
}

// ── 라우터 (해시 기반, 빌드 과정 없는 정적 SPA) ─────────────────────────
const routes = {};
function registerRoute(name, renderFn) { routes[name] = renderFn; }

function navigate(name, params) {
  location.hash = "#/" + name + (params ? "?" + new URLSearchParams(params).toString() : "");
}

function currentRoute() {
  const hash = location.hash.replace(/^#\//, "");
  const [name, qs] = hash.split("?");
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  return { name: name || "home", params };
}

function renderRoute() {
  const { name, params } = currentRoute();
  const view = document.getElementById("view");
  const fn = routes[name] || routes["home"];
  try {
    view.innerHTML = "";
    view.appendChild(fn(params));
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card error-card">
      <h2>화면을 불러오지 못했습니다</h2>
      <p>${escapeHtml(err.message || String(err))}</p>
      <button class="btn" onclick="navigate('home')">처음으로</button>
    </div>`;
  }
  saveLocalSetting("lastScreen", name);
  updateProgressBar(name);
  window.scrollTo(0, 0);
}

// ── 학생 진행 흐름(STEP) 정의 — 대시보드와 이전/다음 내비게이션이 함께 씁니다 ──
const FLOW_STEPS = [
  { key: "start",       route: "student-dashboard", num: 1, label: "자료 넣기" },
  { key: "ai",          route: "ai-coach",          num: 2, label: "AI 전체 분석" },
  { key: "trainer",     route: "trainer",           num: 3, label: "말하기 연습" },
  { key: "print-sheet", route: "print-sheet",       num: 4, label: "면접 직전 한 장" },
];

function flowStepStatus(key) {
  switch (key) {
    case "start": return AppState.records.length > 0 || !!String(AppState.recordRawText || "").trim();
    case "ai": return !!AppState.aiResultSections;
    case "trainer": return AppState.questions.length > 0;
    case "print-sheet": return !!(AppState.introKeywords || AppState.questions.length);
    default: return false;
  }
}

// 화면 하단에 "◀ 이전 · 학생 홈 · 다음 ▶" 내비게이션을 붙입니다. 흐름에 포함된
// 화면이라면 어디서나 이 함수를 호출해 하단에 붙이세요(고아 화면 방지).
function buildFlowNav(currentKey) {
  const idx = FLOW_STEPS.findIndex((s) => s.key === currentKey);
  if (idx < 0) {
    const nav = el(`<div class="flow-nav"><button class="btn-ghost small">학생 홈</button></div>`);
    nav.querySelector("button").onclick = () => navigate("student-dashboard");
    return nav;
  }
  const prev = idx > 0 ? FLOW_STEPS[idx - 1] : null;
  const next = idx < FLOW_STEPS.length - 1 ? FLOW_STEPS[idx + 1] : null;
  const nav = el(`<div class="flow-nav">
    <button class="btn-ghost small" ${prev ? "" : "disabled"}>◀ 이전</button>
    <button class="btn-ghost small">학생 홈</button>
    <button class="btn-ghost small" ${next ? "" : "disabled"}>다음 ▶</button>
  </div>`);
  const [prevBtn, homeBtn, nextBtn] = nav.querySelectorAll("button");
  if (prev) prevBtn.onclick = () => navigate(prev.route);
  homeBtn.onclick = () => navigate("student-dashboard");
  if (next) nextBtn.onclick = () => navigate(next.route);
  return nav;
}

document.addEventListener("keydown", (e) => {
  // 접근성: 모달이 열려 있을 때 Escape로 닫기
  if (e.key === "Escape") {
    const modal = document.querySelector(".modal-backdrop");
    if (modal) modal.remove();
  }
});

window.addEventListener("hashchange", renderRoute);
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(loadLocalSetting("theme", "light"));
  renderRoute();
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  saveLocalSetting("theme", theme);
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) btn.textContent = theme === "dark" ? "☀️ 밝게" : "🌙 어둡게";
}
function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

// ── 대학 카드 헬퍼 ───────────────────────────────────────────────────
function getActiveUniversity() {
  const found = AppState.universities.find((u) => u.id === AppState.activeUniversityId);
  if (found) return found;
  const first = AppState.universities[0] || null;
  if (first && !AppState.activeUniversityId) AppState.activeUniversityId = first.id;
  return first;
}
function setActiveUniversity(id) {
  if (AppState.universities.some((u) => u.id === id)) AppState.activeUniversityId = id;
}
function effectiveInterviewType(uni) {
  if (!uni) return "";
  if (uni.typeGuessOverride) {
    const found = window.APP_DATA?.interviewTypes?.find((t) => t.id === uni.typeGuessOverride);
    return found ? found.label : uni.typeGuessOverride;
  }
  return uni.typeGuess || "";
}
function nearestUniversity() {
  const withDates = AppState.universities.filter((u) => u.interviewDate);
  if (!withDates.length) return null;
  const upcoming = withDates.filter((u) => { const d = daysUntil(u.interviewDate); return d !== null && d >= 0; });
  if (upcoming.length) return upcoming.slice().sort((a, b) => daysUntil(a.interviewDate) - daysUntil(b.interviewDate))[0];
  return withDates.slice().sort((a, b) => daysUntil(b.interviewDate) - daysUntil(a.interviewDate))[0];
}
function updateProgressBar(routeName) {
  const bar = document.getElementById("progress-bar");
  if (!bar) return;
  const idx = FLOW_STEPS.findIndex((s) => s.route === routeName);
  if (idx < 0) { bar.style.width = "0%"; bar.setAttribute("aria-valuenow", "0"); return; }
  const pct = Math.round(((idx + 1) / FLOW_STEPS.length) * 100);
  bar.style.width = pct + "%";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(pct));
  bar.setAttribute("aria-label", `면접 준비 진행률 ${pct}%`);
}

// ── 기록 태그 헬퍼 (다중 선택 지원: record.tags는 배열) ───────────────
function recordHasTag(record, tagId) {
  return Array.isArray(record.tags) && record.tags.includes(tagId);
}
function toggleRecordTag(record, tagId, on) {
  if (!Array.isArray(record.tags)) record.tags = [];
  const has = record.tags.includes(tagId);
  if (on && !has) record.tags.push(tagId);
  if (!on && has) record.tags = record.tags.filter((t) => t !== tagId);
}

// ── 학생부 원문/기록 삭제 (두 가지로 구분) ────────────────────────────
// ① PDF 원문 버퍼만 삭제 — 이미 정리한 면접 준비 기록(records)은 그대로 유지됩니다.
function purgeRecordRawText() {
  AppState.recordRawText = "";
  toast("PDF 원문 버퍼를 삭제했습니다. 이미 정리한 기록은 유지됩니다.");
}
// ② 학생부 관련 항목 전체 삭제 — 원문 + 학생부에서 파생된 기록 + 그 기록에서
//    만든 질문·활동까지 모두 지웁니다. 직접 입력한 기록은 영향받지 않습니다.
function purgeAllRecordData() {
  const recordIds = new Set(AppState.records.filter((r) => r.source !== "직접 입력").map((r) => r.id));
  AppState.recordRawText = "";
  AppState.records = AppState.records.filter((r) => !recordIds.has(r.id));
  AppState.activities = AppState.activities.filter((a) => !recordIds.has(a.recordId));
  AppState.questions = AppState.questions.filter((q) => !recordIds.has(q.recordId));
  toast("학생부에서 가져온 원문·기록·관련 질문을 모두 삭제했습니다.");
}
window.addEventListener("beforeunload", () => { AppState.recordRawText = ""; AppState.aiResultRaw = ""; });
