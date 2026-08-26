/**
 * question-engine.js
 * 규칙 기반 면접 분석/질문 생성기.
 * 목표: 학생에게 체크박스를 많이 요구하지 않고, 학생부/직접입력 자료를 넣으면
 * 핵심 기록 -> 우선 질문 -> 말하기 훈련으로 바로 이어지게 합니다.
 * 어떤 함수도 학생부에 없는 사실을 만들어내지 않습니다.
 */

function generateSixDirectionQuestions(record) {
  return window.APP_DATA.sixDirections.map((d) => ({
    id: uid("q"),
    recordId: record.id,
    direction: d.id,
    directionLabel: d.label,
    text: d.prompt,
    hint: d.hint,
    evidenceText: record.text,
    evidenceSection: record.section,
    source: "규칙 기반 추천",
    priority: null,
    followUps: window.APP_DATA.followUpLayers.map((l) => ({ ...l, done: false, note: "" })),
  }));
}

function estimatePriorityReason(record, universityFactors) {
  const reasons = [];
  const tagWeight = {
    career: "전공·진로 연결성이 높은 기록입니다.",
    academic: "탐구·분석·문제해결 과정이 드러나는 기록입니다.",
    community: "협업·책임·리더십을 확인하기 좋은 기록입니다.",
    explain: "설명을 준비해 둘 필요가 있는 기록입니다.",
  };
  const tags = (record && Array.isArray(record.tags)) ? record.tags : [];
  tags.forEach((t) => { if (tagWeight[t]) reasons.push(tagWeight[t]); });
  if (!reasons.length) reasons.push("학생부 기록의 구체성·활동성을 기준으로 선별한 질문입니다.");
  if (universityFactors && universityFactors.length) reasons.push(`대학 평가요소 참고: ${universityFactors.join(", ")}`);
  return reasons.join(" ");
}

function buildFollowUpChecklist() {
  return window.APP_DATA.followUpLayers.map((l) => ({ ...l, done: false, note: "" }));
}

function extractQuestionLikeLines(text) {
  if (!text) return [];
  const rawLines = text.split(/\n+/).map((l) => l.replace(/^[-*\u2022\d.\)\s]+/, "").trim()).filter(Boolean);
  return rawLines.filter((l) => l.length >= 4);
}

// ──────────────────────────────────────────────────────────────────────
// 자동 면접 분석: 기본 사용자 경험의 핵심
// ──────────────────────────────────────────────────────────────────────

const INTERVIEW_ACTION_WORDS = [
  "탐구", "분석", "비교", "조사", "실험", "연구", "토론", "발표", "설계", "제작", "개발",
  "해결", "검증", "적용", "해석", "추론", "평가", "제안", "수정", "개선", "자료", "통계", "보고서",
];
const INTERVIEW_REFLECTION_WORDS = ["한계", "오류", "문제", "어려움", "실패", "수정", "개선", "보완", "변화", "배움"];
const COMMUNITY_WORDS = ["협력", "협업", "갈등", "조정", "리더", "회장", "역할", "배려", "봉사", "책임", "소통"];
const CAREER_WORDS = ["진로", "전공", "학과", "직업", "관심", "계열", "희망", "진학"];
const EXPLAIN_WORDS = ["결석", "지각", "조퇴", "미인정", "하락", "변경", "미이수", "중단", "부족"];

function countKeywordHits(text, words) {
  const s = String(text || "");
  return words.reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0);
}

function inferRecordTags(record) {
  const text = String(record?.text || "");
  const section = String(record?.section || "");
  const tags = new Set(Array.isArray(record?.tags) ? record.tags : []);
  if (/세부능력|교과|과목|성적/.test(section) || countKeywordHits(text, INTERVIEW_ACTION_WORDS) >= 1) tags.add("academic");
  if (/진로/.test(section) || countKeywordHits(text, CAREER_WORDS) >= 1) tags.add("career");
  if (/동아리|자율|자치|봉사|행동특성|종합의견/.test(section) || countKeywordHits(text, COMMUNITY_WORDS) >= 1) tags.add("community");
  if (/출결/.test(section) || countKeywordHits(text, EXPLAIN_WORDS) >= 1) tags.add("explain");
  return Array.from(tags);
}

function isLikelyLowValueRecord(record) {
  const text = String(record?.text || "").trim();
  if (text.length < 12 && !/(결석|지각|조퇴|미인정|하락|변경|미이수|중단)/.test(text)) return true;
  if (/^\d+[\s\d.\-/]*$/.test(text)) return true;
  if (/학교생활세부사항기록부|학교생활기록부II|학교생활기록부Ⅱ|출력일자|페이지\s*\d*/i.test(text)) return true;
  if (/^(학년|반|번호|성명|구분|학기|과목|단위수|석차등급|성취도)\s*$/.test(text)) return true;
  return false;
}

function scoreRecordForInterview(record, university) {
  const text = String(record?.text || "");
  const section = String(record?.section || "");
  const tags = inferRecordTags(record);
  let score = 0;
  const reasons = [];

  if (/세부능력|특기사항/.test(section)) { score += 5; reasons.push("세특"); }
  else if (/진로/.test(section)) { score += 4; reasons.push("진로활동"); }
  else if (/동아리/.test(section)) { score += 3.5; reasons.push("동아리"); }
  else if (/자율|자치/.test(section)) { score += 2.5; reasons.push("자율·자치"); }
  else if (/행동특성|종합의견/.test(section)) { score += 2; reasons.push("행동특성"); }

  const actionHits = countKeywordHits(text, INTERVIEW_ACTION_WORDS);
  const reflectionHits = countKeywordHits(text, INTERVIEW_REFLECTION_WORDS);
  if (actionHits) { score += Math.min(5, actionHits * 1.1); reasons.push("탐구·활동 과정"); }
  if (reflectionHits) { score += Math.min(3, reflectionHits * 0.9); reasons.push("한계·수정·성찰"); }
  if (tags.includes("career")) { score += 2.2; reasons.push("진로·전공"); }
  if (tags.includes("academic")) score += 1.8;
  if (tags.includes("community")) { score += 1.4; reasons.push("공동체"); }
  if (tags.includes("explain")) { score += 3; reasons.push("설명 필요"); }

  // 너무 짧거나 너무 긴 표/행 데이터는 약간 낮춤
  if (text.length >= 35 && text.length <= 320) score += 1.3;
  if (text.length > 700) score -= 1;

  const major = String(university?.major || "").trim();
  if (major && text.includes(major.replace(/학과$|학부$/g, ""))) { score += 2; reasons.push("지원학과 직접 연결"); }

  return { score, reasons: Array.from(new Set(reasons)), tags };
}

function shortEvidenceLabel(record) {
  const section = record?.section && !String(record.section).startsWith("미지정") ? record.section : "학생부 기록";
  const text = String(record?.text || "").replace(/\s+/g, " ").trim();
  return { section, snippet: text.length > 120 ? text.slice(0, 117) + "…" : text };
}

function preferredDirectionsForRecord(record) {
  const tags = inferRecordTags(record);
  const text = String(record?.text || "");
  const out = [];
  const add = (x) => { if (!out.includes(x)) out.push(x); };
  if (tags.includes("explain")) { add("limit"); add("process"); }
  if (tags.includes("academic")) { add("process"); add("concept"); add("limit"); }
  if (tags.includes("career")) { add("motive"); add("link"); add("process"); }
  if (tags.includes("community")) { add("role"); add("process"); add("limit"); }
  if (countKeywordHits(text, INTERVIEW_REFLECTION_WORDS)) add("limit");
  if (!out.length) { add("process"); add("role"); add("limit"); }
  return out;
}

function contextualQuestionText(record, direction, university) {
  const major = String(university?.major || "").trim();
  const map = {
    motive: "이 활동이나 주제에 관심을 갖고 시작하게 된 계기를 구체적으로 설명해 보세요.",
    process: "이 활동을 실제로 어떤 순서와 방법으로 진행했으며, 그 과정에서 가장 중요한 판단은 무엇이었습니까?",
    concept: "이 기록에서 가장 중요한 개념이나 용어 하나를 골라 자신의 말로 설명하고, 활동에서 어떻게 활용했는지 말해 보세요.",
    role: "이 활동에서 본인이 직접 맡은 역할과 실제로 한 행동을 구체적으로 설명해 보세요.",
    limit: "이 활동의 한계나 아쉬운 점은 무엇이며, 다시 한다면 무엇을 어떻게 바꾸겠습니까?",
    link: major
      ? `이 경험이 ${major} 지원과 어떤 점에서 연결되는지, 억지로 포장하지 말고 실제 연결 지점을 설명해 보세요.`
      : "이 경험이 자신의 진로 또는 지원하려는 전공과 어떤 점에서 연결되는지 설명해 보세요.",
  };
  return map[direction] || "이 기록에서 면접관이 추가로 확인할 만한 내용을 자신의 말로 설명해 보세요.";
}

function buildAutomaticQuestion(record, direction, priority, university, rank) {
  const d = window.APP_DATA.sixDirections.find((x) => x.id === direction) || { label: direction, hint: "" };
  return {
    id: uid("q"),
    recordId: record.id,
    direction,
    directionLabel: d.label,
    text: contextualQuestionText(record, direction, university),
    hint: d.hint || "",
    evidenceText: record.text,
    evidenceSection: record.section,
    source: "자동 분석",
    priority,
    autoRank: rank,
    followUps: buildFollowUpChecklist(),
  };
}

function automaticActivityFromRecord(record, rank) {
  const ev = shortEvidenceLabel(record);
  return {
    id: uid("act"), recordId: record.id,
    name: `${ev.section} 핵심활동 ${rank}`,
    situation: "", role: "", action: "", process: "", result: "", limit: "", link: "", summary: ev.snippet,
    source: "자동 추천",
  };
}

function runAutomaticInterviewAnalysis(options) {
  options = options || {};
  const university = getActiveUniversity ? getActiveUniversity() : null;
  const usable = (AppState.records || []).filter((r) => r && r.text && !isLikelyLowValueRecord(r));
  if (!usable.length) {
    AppState.analysisResult = null;
    return null;
  }

  usable.forEach((r) => {
    if (!r.tagsInitialized || !Array.isArray(r.tags) || !r.tags.length) {
      r.tags = inferRecordTags(r);
      r.tagsInitialized = true;
    }
  });

  // 동일 문장을 중복 추출한 경우 한 번만 사용
  const seen = new Set();
  const scored = usable
    .filter((r) => {
      const key = String(r.text).replace(/\s+/g, " ").trim().slice(0, 220);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    })
    .map((record) => ({ record, ...scoreRecordForInterview(record, university) }))
    .sort((a, b) => b.score - a.score);

  const core = scored.slice(0, Math.min(12, scored.length));
  const autoQuestions = [];
  core.forEach((item, idx) => {
    const dirs = preferredDirectionsForRecord(item.record);
    const count = idx < 6 ? 2 : 1; // 핵심 6개 기록은 2문항, 나머지는 1문항
    const priority = idx < 6 ? "A" : "B";
    dirs.slice(0, count).forEach((dir) => autoQuestions.push(buildAutomaticQuestion(item.record, dir, priority, university, idx + 1)));
  });

  // 일반 공통 질문 2개는 학생부에 없어도 실제 면접에서 준비 가치가 높음
  if (university?.major) {
    autoQuestions.unshift({
      id: uid("q"), recordId: null, direction: "motive", directionLabel: "지원동기",
      text: `${university.major}에 지원한 이유를 한 가지 구체적인 계기와 그 이후 실제로 한 행동을 연결해 설명해 보세요.`,
      hint: "계기 → 실제 행동 → 학과 연결 순서로 준비합니다.", evidenceText: "", evidenceSection: "지원정보",
      source: "자동 분석", priority: "A", autoRank: 0, followUps: buildFollowUpChecklist(),
    });
  }

  if (options.replaceQuestions !== false) {
    const keep = (AppState.questions || []).filter((q) => q.source === "AI 제안" || q.source === "학생 작성");
    AppState.questions = [...autoQuestions, ...keep];
  }

  const activityCandidates = core.filter((x) => x.tags.some((t) => ["career", "academic", "community"].includes(t))).slice(0, 3);
  const existingManualActivities = (AppState.activities || []).filter((a) => a.source !== "자동 추천");
  const autoActivities = activityCandidates.map((x, i) => automaticActivityFromRecord(x.record, i + 1));
  AppState.activities = [...existingManualActivities, ...autoActivities].slice(0, 3);

  const explainRecords = scored.filter((x) => x.tags.includes("explain")).slice(0, 5);
  const mandatory = autoQuestions.filter((q) => q.priority === "A");
  const recommended = autoQuestions.filter((q) => q.priority === "B");
  const result = {
    totalRecords: AppState.records.length,
    usableRecords: usable.length,
    coreRecords: core.map((x) => ({ record: x.record, score: x.score, reasons: x.reasons, tags: x.tags })),
    coreActivities: autoActivities,
    mandatoryQuestions: mandatory,
    recommendedQuestions: recommended,
    explainRecords: explainRecords.map((x) => ({ record: x.record, score: x.score, reasons: x.reasons })),
    universityId: university?.id || null,
    universityLabel: university ? `${university.name || ""} ${university.major || ""}`.trim() : "",
  };
  AppState.analysisResult = result;
  AppState.analysisUpdatedAt = new Date().toISOString();
  return result;
}
