/**
 * export.js
 * 준비 데이터 백업/복원과 면접후기 내보내기.
 * - schemaVersion 3
 * - 학생부 PDF 전체 원문, 녹음, AI 원문은 어떤 경우에도 내보내지 않습니다.
 * - 직접 입력 기록은 기본 백업합니다.
 * - 학생부에서 파생된 기록과 질문 근거문장은 사용자가 별도 선택한 경우에만 포함합니다.
 */

const BACKUP_SCHEMA_VERSION = 3;

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

  const exportRecords = (state.records || []).filter((r) => r.source === "직접 입력" || includeRecordDerived);
  const exportedRecordIds = new Set(exportRecords.map((r) => r.id));

  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    records: cloneJson(exportRecords),
    commonAnswers: cloneJson(state.commonAnswers || {}),
    mockEvaluation: cloneJson(state.mockEvaluation || { checks: {}, good: "", fix: "" }),
    aiVerificationNotes: cloneJson(state.aiVerificationNotes || []),
    introKeywords: state.introKeywords || "",
    lastWord: state.lastWord || "",
    motivation: {
      motiveMoment: state.motiveMoment || "",
      motiveActions: cloneJson(state.motiveActions || []),
      majorCourses: state.majorCourses || "",
      majorSourceLog: state.majorSourceLog || "",
      favoriteCourseWhy: state.favoriteCourseWhy || "",
      afterAdmission: state.afterAdmission || "",
      motiveOneLine: state.motiveOneLine || "",
    },
    _includesRecordDerived: includeRecordDerived,
    _includesRecordEvidence: includeEvidence,
  };

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
    (includeEvidence ? "질문의 학생부 근거 문장이 포함되어 있습니다." : "질문의 학생부 근거 문장은 제외되었습니다.");
  return payload;
}

function exportStateAsJson(state, options) {
  const payload = buildExportPayload(state, options);
  downloadFile(`interview-hub-backup-${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function importStateFromJson(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    const version = Number(data.schemaVersion || 1);
    if (version > BACKUP_SCHEMA_VERSION) return { ok: false, reason: `이 백업은 더 새로운 버전(schema ${version})에서 만들어졌습니다.` };

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
    if (typeof data.introKeywords === "string") AppState.introKeywords = data.introKeywords;
    if (typeof data.lastWord === "string") AppState.lastWord = data.lastWord;

    const m = data.motivation || data;
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
