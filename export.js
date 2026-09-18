/**
 * export.js
 * 준비 데이터 백업/복원과 면접후기 내보내기.
 * - schemaVersion 8
 * - 학생부 PDF 전체 원문, 녹음, AI 원문은 어떤 경우에도 내보내지 않습니다.
 * - 직접 입력 기록은 기본 백업합니다.
 * - 학생부에서 파생된 기록과 질문 근거문장은 사용자가 별도 선택한 경우에만 포함합니다.
 */

const BACKUP_SCHEMA_VERSION = 8;

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }

function buildExportPayload(state, options) {
  options = options || {};
  const includeEvidence = options.includeEvidence === true;
  const includeRecordDerived = options.includeRecordDerived === true;
  const includeUniversities = options.includeUniversities !== false;
  const includeActivities = options.includeActivities !== false;
  const includeQuestions = options.includeQuestions !== false;
  const includeLogs = options.includeLogs !== false;
  const includeWeakness = options.includeWeakness !== false;
  const includePreparationNotes = options.includePreparationNotes !== false;
  const includeTranscripts = options.includeTranscripts === true;

  const exportRecords = (state.records || []).filter((r) => r.source === "직접 입력" || includeRecordDerived);
  const exportedRecordIds = new Set(exportRecords.map((r) => r.id));

  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    records: cloneJson(exportRecords),
    _includesRecordDerived: includeRecordDerived,
    _includesRecordEvidence: includeEvidence,
    _includesPreparationNotes: includePreparationNotes,
    _includesTranscripts: includeTranscripts,
  };


  if (includePreparationNotes) {
    payload.commonAnswers = cloneJson(state.commonAnswers || {});
    payload.mockEvaluation = cloneJson(state.mockEvaluation || { checks: {}, good: "", fix: "" });
    payload.aiVerificationNotes = cloneJson(state.aiVerificationNotes || []);
    payload.practiceStats = cloneJson(state.practiceStats || {});
    if (!includeTranscripts) Object.values(payload.practiceStats).forEach((v) => { if (v && typeof v === "object") delete v.lastTranscript; });
    payload.mmiPracticeCount = Number(state.mmiPracticeCount || 0);
    payload.introKeywords = state.introKeywords || "";
    payload.lastWord = state.lastWord || "";
    payload.motivation = {
      motiveMoment: state.motiveMoment || "",
      motiveActions: cloneJson(state.motiveActions || []),
      majorCourses: state.majorCourses || "",
      majorSourceLog: state.majorSourceLog || "",
      favoriteCourseWhy: state.favoriteCourseWhy || "",
      afterAdmission: state.afterAdmission || "",
      motiveOneLine: state.motiveOneLine || "",
      ragFeedback: cloneJson(state.ragFeedback || {}),
    };
  }

  if (includeUniversities) {
    payload.universities = cloneJson(state.universities || []);
    payload.activeUniversityId = state.activeUniversityId || null;
  }
  if (includeActivities) {
    payload.activities = (state.activities || []).map((a) => {
      const copy = cloneJson(a);
      if (copy.recordId && !exportedRecordIds.has(copy.recordId)) copy.recordId = null;
      return copy;
    });
  }
  if (includeQuestions) {
    payload.questions = (state.questions || []).map((q) => {
      const copy = cloneJson(q);
      if (copy.recordId && !exportedRecordIds.has(copy.recordId)) copy.recordId = null;
      if (!includeEvidence) { delete copy.evidenceText; delete copy.evidenceSection; }
      return copy;
    });
  }
  if (includeLogs) payload.interviewLogs = cloneJson(state.interviewLogs || []);
  if (includeWeakness) payload.weaknessEntries = cloneJson(state.weaknessEntries || []);

  payload._note = "이 파일에는 면접 준비 데이터가 담겨 있습니다. 공용 기기·공용 클라우드 저장에 주의하세요. " +
    (includeRecordDerived ? "학생부에서 파생된 정리 기록이 포함되어 있습니다. " : "학생부에서 파생된 정리 기록은 제외되었습니다. ") +
    (includeEvidence ? "질문의 학생부 근거 문장이 포함되어 있습니다. " : "질문의 학생부 근거 문장은 제외되었습니다. ") +
    (includePreparationNotes ? "기타 면접 준비 메모·자가평가·연습기록이 포함되어 있습니다. " : "기타 면접 준비 메모·자가평가·연습기록은 제외되었습니다. ") +
    (includeTranscripts ? "받아쓰기 답변 텍스트가 포함되어 있습니다." : "받아쓰기 답변 텍스트는 제외되었습니다.");
  return payload;
}

function exportStateAsJson(state, options) {
  const payload = buildExportPayload(state, options);
  downloadFile(`interview-hub-backup-${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function resetPreparationStateForImport() {
  AppState.universities = []; AppState.activeUniversityId = null;
  AppState.records = []; AppState.recordRawText = ""; AppState.activities = []; AppState.questions = [];
  AppState.interviewLogs = []; AppState.aiResultRaw = ""; AppState.weaknessEntries = [];
  AppState.commonAnswers = {}; AppState.mockEvaluation = { checks: {}, good: "", fix: "" };
  AppState.aiResultSections = null; AppState.aiDeepResult = null; AppState.aiVerificationNotes = [];
  AppState.analysisResult = null; AppState.analysisUpdatedAt = null; AppState.practiceStats = {}; AppState.mmiPracticeCount = 0; AppState.ragFeedback = {};
  AppState.introKeywords = ""; AppState.lastWord = ""; AppState.motiveMoment = ""; AppState.motiveActions = [];
  AppState.majorCourses = ""; AppState.majorSourceLog = ""; AppState.favoriteCourseWhy = ""; AppState.afterAdmission = ""; AppState.motiveOneLine = "";
}

function importStateFromJson(jsonText, options) {
  try {
    const data = JSON.parse(jsonText);
    const version = Number(data.schemaVersion || 1);
    if (version > BACKUP_SCHEMA_VERSION) return { ok: false, reason: `이 백업은 더 새로운 버전(schema ${version})에서 만들어졌습니다.` };
    if (!options || options.reset !== false) resetPreparationStateForImport();

    if (Array.isArray(data.universities)) AppState.universities = data.universities;
    if (Array.isArray(data.records)) AppState.records = data.records.map((r) => ({
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : [],
      tagsInitialized: typeof r.tagsInitialized === "boolean" ? r.tagsInitialized : (Array.isArray(r.tags) && r.tags.length > 0),
    }));
    if (Array.isArray(data.activities)) AppState.activities = data.activities;
    if (Array.isArray(data.questions)) AppState.questions = data.questions;
    if (Array.isArray(data.interviewLogs)) AppState.interviewLogs = data.interviewLogs;
    if (Array.isArray(data.weaknessEntries)) AppState.weaknessEntries = data.weaknessEntries;
    if (typeof data.commonAnswers === "object" && data.commonAnswers) AppState.commonAnswers = data.commonAnswers;
    if (typeof data.mockEvaluation === "object" && data.mockEvaluation) AppState.mockEvaluation = data.mockEvaluation;
    if (Array.isArray(data.aiVerificationNotes)) AppState.aiVerificationNotes = data.aiVerificationNotes;
    if (typeof data.practiceStats === "object" && data.practiceStats) AppState.practiceStats = data.practiceStats;
    if (Number.isFinite(Number(data.mmiPracticeCount))) AppState.mmiPracticeCount = Number(data.mmiPracticeCount);
    if (typeof data.introKeywords === "string") AppState.introKeywords = data.introKeywords;
    if (typeof data.lastWord === "string") AppState.lastWord = data.lastWord;

    const m = data.motivation || data;
    if (typeof data.ragFeedback === "object" && data.ragFeedback) AppState.ragFeedback = data.ragFeedback;
    else if (typeof m.ragFeedback === "object" && m.ragFeedback) AppState.ragFeedback = m.ragFeedback;
    ["motiveMoment", "majorCourses", "majorSourceLog", "favoriteCourseWhy", "afterAdmission", "motiveOneLine"].forEach((k) => {
      if (typeof m[k] === "string") AppState[k] = m[k];
    });
    if (Array.isArray(m.motiveActions)) AppState.motiveActions = m.motiveActions;

    const requestedActive = data.activeUniversityId;
    AppState.activeUniversityId = AppState.universities.some((u) => u.id === requestedActive)
      ? requestedActive : (AppState.universities[0]?.id || null);

    const validRecordIds = new Set((AppState.records || []).map((r) => r.id));
    (AppState.questions || []).forEach((q) => { if (q.recordId && !validRecordIds.has(q.recordId)) q.recordId = null; });
    (AppState.activities || []).forEach((a) => { if (a.recordId && !validRecordIds.has(a.recordId)) a.recordId = null; });

    // 원문·녹음·AI 원문은 백업에서 복원하지 않습니다.
    AppState.recordRawText = "";
    AppState.aiResultRaw = "";
    return { ok: true, schemaVersion: version };
  } catch (err) {
    return { ok: false, reason: "JSON 형식을 읽을 수 없습니다: " + (err.message || err) };
  }
}

function csvCell(v) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }

function exportInterviewLogsCsv(logs) {
  const headers = ["대학", "학과", "전형", "면접유형", "면접관수", "받은질문", "가장어려웠던꼬리질문", "예상과달랐던운영", "가장아쉬웠던답", "다음에바꿀점"];
  const rows = logs.map((l) => [
    l.university, l.major, l.track, l.type, l.interviewerCount,
    (l.questions || []).join(" / "), l.hardestFollowUp, l.unexpected, l.regret, (l.changes || []).join(" / "),
  ]);
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  downloadFile(`interview-logs-${Date.now()}.csv`, "\uFEFF" + csv, "text/csv");
}

function redactCommonPii(text) {
  return String(text || "")
    .replace(/01[0-9][-\s]?\d{3,4}[-\s]?\d{4}/g, "[전화번호 삭제]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[이메일 삭제]")
    .replace(/[가-힣A-Za-z0-9]+(?:고등학교|중학교|초등학교|고교)/g, "[학교명 삭제]")
    .replace(/전교\s*\d+\s*등/g, "[석차 삭제]")
    .replace(/\d+(?:\.\d+)?\s*등급/g, "[등급 삭제]")
    .replace(/(19|20)\d{2}[.\-/]\s?(0?[1-9]|1[0-2])[.\-/]\s?(0?[1-9]|[12]\d|3[01])/g, "[생년월일 삭제]");
}

// ── 질문지 파일 저장 (사람이 읽는 .txt) ──────────────────────────────
// JSON 백업(exportStateAsJson)과 달리, 학생이 만든 예상질문을 그대로 읽고
// 인쇄하거나 다른 사람과 공유할 수 있는 평문 텍스트로 만듭니다.
// 학생부 원문 전체는 넣지 않고, 질문의 근거문장(evidenceText)만 짧게 잘라
// redactCommonPii로 한 번 더 개인정보 후보를 가린 뒤 포함합니다.
function buildQuestionsTextContent(state) {
  const uni = typeof getActiveUniversity === "function" ? getActiveUniversity() : null;
  const qs = state.questions || [];
  const groups = [
    { key: "A", label: "A · 반드시 준비" },
    { key: "B", label: "B · 준비 권장" },
    { key: "C", label: "C · 여유가 있으면" },
    { key: null, label: "우선순위 미지정" },
  ];

  const lines = [];
  lines.push("나의 면접 예상질문 정리");
  lines.push(`저장일: ${new Date().toLocaleString("ko-KR")}`);
  const uniLine = uni ? [uni.name, uni.major, uni.track].filter(Boolean).join(" · ") : "";
  if (uniLine) lines.push(`지원 정보: ${uniLine}`);
  lines.push("");
  lines.push("이 파일은 본인이 이 프로그램에서 직접 정리·연습한 예상질문 모음입니다.");
  lines.push("실제 대학 기출문항이 아니며, 학생부 원문 전체나 성적·수상 등 식별정보는");
  lines.push("자동으로 넣지 않도록 처리했지만 최종 확인은 본인이 직접 해 주세요.");
  lines.push("=".repeat(44));

  let any = false;
  groups.forEach((g) => {
    const pool = qs.filter((q) => (q.priority || null) === g.key);
    if (!pool.length) return;
    any = true;
    lines.push("");
    lines.push(`■ ${g.label} (${pool.length}개)`);
    pool.forEach((q, idx) => {
      lines.push("");
      lines.push(`${idx + 1}. [${q.directionLabel || "질문"}] ${q.text || ""}`);
      if (q.hint) lines.push(`   힌트: ${q.hint}`);
      if (q.evidenceText) {
        const ev = redactCommonPii(String(q.evidenceText)).slice(0, 150);
        const cut = String(q.evidenceText).length > 150 ? "…" : "";
        lines.push(`   학생부 근거(${q.evidenceSection || "학생부"}): ${ev}${cut}`);
      }
      const noted = Array.isArray(q.followUps) ? q.followUps.filter((f) => f && (f.note || f.done)) : [];
      if (noted.length) {
        lines.push(`   꼬리질문 메모:`);
        noted.forEach((f) => lines.push(`     ${f.done ? "[완료]" : "[진행중]"} ${f.label}${f.note ? " - " + f.note : ""}`));
      }
    });
  });
  if (!any) lines.push("\n(아직 저장된 질문이 없습니다. 먼저 AI 전체분석이나 질문 추가를 진행해 주세요.)");

  lines.push("");
  lines.push("=".repeat(44));
  lines.push("면접실 반입 가능 여부는 대학마다 다르니 실제 사용 전 대학 안내를 확인하세요.");
  return lines.join("\n");
}

function exportQuestionsAsText(state) {
  const content = buildQuestionsTextContent(state);
  downloadFile(`interview-questions-${Date.now()}.txt`, "\uFEFF" + content, "text/plain;charset=utf-8");
}

function exportInterviewLogsAnonymized(logs) {
  const rawText = (logs || []).map((l) => [l.questions, l.hardestFollowUp, l.unexpected].flat().join(" ")).join("\n");
  const hits = typeof findPiiCandidates === "function" ? findPiiCandidates(rawText) : [];
  if (hits.length && !confirm(`후기 자유서술에서 개인정보 후보가 발견되었습니다: ${hits.join(" / ")}\n자동으로 일부 표현을 가린 뒤 내보냅니다. 계속할까요?`)) return;

  const anon = (logs || []).map((l) => ({
    university: l.university, major: l.major, track: l.track, type: l.type,
    interviewerCount: l.interviewerCount,
    questions: (l.questions || []).map(redactCommonPii),
    hardestFollowUp: redactCommonPii(l.hardestFollowUp),
    unexpected: redactCommonPii(l.unexpected),
  }));
  downloadFile(`interview-logs-anonymous-${Date.now()}.json`, JSON.stringify(anon, null, 2), "application/json");
}
