/**
 * ai-result-parser.js
 * 외부 AI의 분석 결과를 구조화합니다. API 호출은 없습니다.
 * v4.4: 문자열/객체 혼합 응답을 화면용 구조로 정규화하고 근거를 보존합니다.
 */

function extractJsonCandidates(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const candidates = [];
  const fencedAll = [...rawText.matchAll(/```json\s*([\s\S]*?)```/gi)];
  fencedAll.forEach((m) => candidates.push(m[1]));
  const first = rawText.indexOf("{");
  const last = rawText.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) candidates.push(rawText.slice(first, last + 1));
  return candidates;
}

function tryParseAiJson(rawText) {
  if (!rawText || !rawText.trim()) return { ok: false, reason: "붙여넣은 내용이 없습니다." };
  for (const c of extractJsonCandidates(rawText)) {
    try { return { ok: true, data: normalizeAiJson(JSON.parse(c)) }; }
    catch (e) { /* 다음 후보 */ }
  }
  return { ok: false, reason: "JSON 형식을 찾지 못했습니다. AI에게 JSON 형식으로 다시 출력해 달라고 요청하세요." };
}

function tryParseFeedbackJson(rawText) {
  if (!rawText || !rawText.trim()) return { ok: false, reason: "붙여넣은 내용이 없습니다." };
  for (const c of extractJsonCandidates(rawText)) {
    try {
      const p = JSON.parse(c);
      const arr = (v) => Array.isArray(v) ? v : (v ? [v] : []);
      return {
        ok: true,
        data: {
          goodPoint: typeof p.goodPoint === "string" ? p.goodPoint : "",
          improvements: arr(p.improvements).map(toPlainText).filter(Boolean).slice(0, 2),
          followUpQuestions: arr(p.followUpQuestions).map(toPlainText).filter(Boolean).slice(0, 5),
        },
      };
    } catch (e) { /* 다음 후보 */ }
  }
  return { ok: false, reason: "피드백 JSON을 찾지 못했습니다." };
}

function asArray(v) {
  return Array.isArray(v) ? v : (v == null || v === "" ? [] : [v]);
}

function firstText(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of keys) {
    if (typeof obj[key] === "string" && obj[key].trim()) return obj[key].trim();
  }
  return "";
}

function toPlainText(value) {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    return firstText(value, ["question", "text", "summary", "title", "topic", "item", "activity", "record", "content", "detail", "reason"]);
  }
  return String(value).trim();
}

function normalizeCoreRecord(item) {
  if (typeof item === "string") return { title: "", area: "", summary: item.trim(), evidenceQuote: "" };
  const o = item && typeof item === "object" ? item : {};
  return {
    title: firstText(o, ["title", "name"]),
    area: firstText(o, ["area", "section", "evidenceArea", "source"]),
    summary: firstText(o, ["summary", "record", "text", "content", "detail", "title"]),
    evidenceQuote: firstText(o, ["evidenceQuote", "evidence", "quote", "sourceText"]),
  };
}

function normalizeCoreActivity(item) {
  if (typeof item === "string") return { title: item.trim(), area: "", why: "", evidenceQuote: "" };
  const o = item && typeof item === "object" ? item : {};
  return {
    title: firstText(o, ["title", "activity", "name", "summary", "text"]),
    area: firstText(o, ["area", "section", "evidenceArea", "source"]),
    why: firstText(o, ["why", "reason", "detail", "summary"]),
    evidenceQuote: firstText(o, ["evidenceQuote", "evidence", "quote", "sourceText"]),
  };
}

function normalizeQuestion(item) {
  if (typeof item === "string") return { question: item.trim(), evidenceArea: "", evidenceQuote: "", evaluationPoint: "" };
  const o = item && typeof item === "object" ? item : {};
  return {
    question: firstText(o, ["question", "text", "content", "title"]),
    evidenceArea: firstText(o, ["evidenceArea", "area", "section", "source"]),
    evidenceQuote: firstText(o, ["evidenceQuote", "evidence", "quote", "sourceText"]),
    evaluationPoint: firstText(o, ["evaluationPoint", "intent", "point", "reason"]),
  };
}

function normalizeExplanation(item) {
  if (typeof item === "string") return { topic: item.trim(), detail: "", evidenceArea: "", evidenceQuote: "" };
  const o = item && typeof item === "object" ? item : {};
  return {
    topic: firstText(o, ["topic", "title", "item", "summary", "text"]),
    detail: firstText(o, ["detail", "reason", "description", "content"]),
    evidenceArea: firstText(o, ["evidenceArea", "area", "section", "source"]),
    evidenceQuote: firstText(o, ["evidenceQuote", "evidence", "quote", "sourceText"]),
  };
}

function normalizeVerificationPoint(item) {
  if (typeof item === "string") return { topic: item.trim(), reason: "", studentCheck: "", evidenceArea: "", evidenceQuote: "" };
  const o = item && typeof item === "object" ? item : {};
  return {
    topic: firstText(o, ["topic", "title", "item", "summary", "text"]),
    reason: firstText(o, ["reason", "detail", "description"]),
    studentCheck: firstText(o, ["studentCheck", "check", "howToPrepare", "howToVerify"]),
    evidenceArea: firstText(o, ["evidenceArea", "area", "section", "source"]),
    evidenceQuote: firstText(o, ["evidenceQuote", "evidence", "quote", "sourceText"]),
  };
}

function genericFollowUpsFromTopic(topic) {
  const t = String(topic || "이 활동").trim() || "이 활동";
  return [
    `${t}에서 본인이 직접 한 일은 무엇입니까?`,
    `${t}을 진행하면서 가장 중요하게 판단한 기준은 무엇이었습니까?`,
    `${t}의 한계는 무엇이며 다시 한다면 무엇을 보완하겠습니까?`,
  ];
}

function normalizeFollowUpGroup(item) {
  if (typeof item === "string") {
    const q = item.trim();
    if (!q) return { topic: "", evidenceArea: "", evidenceQuote: "", questions: [] };
    if (/[?？]$/.test(q) || /(습니까|인가요|인가|무엇|어떻게|왜|설명해|말해)/.test(q)) {
      return { topic: "", evidenceArea: "", evidenceQuote: "", questions: [q] };
    }
    return { topic: q, evidenceArea: "", evidenceQuote: "", questions: genericFollowUpsFromTopic(q) };
  }
  const o = item && typeof item === "object" ? item : {};
  const topic = firstText(o, ["topic", "title", "activity", "name", "summary"]);
  const rawQs = asArray(o.questions || o.followUps || o.followUpQuestions || o.question);
  let questions = rawQs.map(toPlainText).filter(Boolean);
  if (!questions.length && topic) questions = genericFollowUpsFromTopic(topic);
  return {
    topic,
    evidenceArea: firstText(o, ["evidenceArea", "area", "section", "source"]),
    evidenceQuote: firstText(o, ["evidenceQuote", "evidence", "quote", "sourceText"]),
    questions: questions.slice(0, 6),
  };
}

function normalizeStudentVerification(item) {
  if (typeof item === "string") return { item: item.trim(), reason: "", howToVerify: "" };
  const o = item && typeof item === "object" ? item : {};
  return {
    item: firstText(o, ["item", "topic", "title", "text", "summary"]),
    reason: firstText(o, ["reason", "detail", "description"]),
    howToVerify: firstText(o, ["howToVerify", "studentCheck", "check", "method"]),
  };
}

function cleanObjects(list, normalizer, key) {
  return asArray(list).map(normalizer).filter((x) => {
    if (!x || typeof x !== "object") return false;
    if (key && x[key]) return true;
    return Object.values(x).some((v) => typeof v === "string" ? v.trim() : Array.isArray(v) && v.length);
  });
}

function normalizeAiJson(parsed) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const explanations = cleanObjects(p.needsExplanation, normalizeExplanation, "topic");
  const verificationPattern = /(실제\s*수행|수행\s*범위|고교\s*수준|수준을\s*상회|진위|본인\s*역할|활동\s*수준|관심사.*연결|정합성|일관성|역할\s*범위)/i;
  const movedToVerification = explanations.filter((x) => verificationPattern.test(`${x.topic || ""} ${x.detail || ""}`));
  const objectiveExplanations = explanations.filter((x) => !verificationPattern.test(`${x.topic || ""} ${x.detail || ""}`));
  const explicitVerification = cleanObjects(p.interviewerVerificationPoints || p.verificationPoints || p.interviewerChecks, normalizeVerificationPoint, "topic");
  const inferredVerification = movedToVerification.map((x) => ({
    topic: x.topic,
    reason: x.detail,
    studentCheck: "실제 수행 범위·본인 역할·사용한 근거를 자기 말로 설명할 수 있는지 확인하세요.",
    evidenceArea: x.evidenceArea,
    evidenceQuote: x.evidenceQuote,
  }));
  return {
    coreRecords: cleanObjects(p.coreRecords, normalizeCoreRecord, "summary"),
    coreActivities: cleanObjects(p.coreActivities, normalizeCoreActivity, "title").slice(0, 3),
    priorityA: cleanObjects(p.priorityA, normalizeQuestion, "question"),
    priorityB: cleanObjects(p.priorityB, normalizeQuestion, "question"),
    priorityC: cleanObjects(p.priorityC, normalizeQuestion, "question"),
    needsExplanation: objectiveExplanations,
    interviewerVerificationPoints: [...explicitVerification, ...inferredVerification],
    followUpQuestions: cleanObjects(p.followUpQuestions, normalizeFollowUpGroup),
    needStudentVerification: cleanObjects(p.needStudentVerification, normalizeStudentVerification, "item"),
  };
}

const AI_SECTION_DEFS = [
  { key: "coreRecords", label: "핵심 기록", requireEditBeforeAdopt: false, requireFactVerification: true },
  { key: "coreActivities", label: "핵심 활동 후보 TOP 3", requireEditBeforeAdopt: false, requireFactVerification: true },
  { key: "priorityA", label: "A · 반드시 준비", priority: "A", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "priorityB", label: "B · 준비 권장", priority: "B", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "priorityC", label: "C · 여유가 있으면", priority: "C", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "needsExplanation", label: "설명이 필요한 기록", requireEditBeforeAdopt: false, requireFactVerification: true },
  { key: "interviewerVerificationPoints", label: "면접관 확인 가능성", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "followUpQuestions", label: "꼬리질문", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "needStudentVerification", label: "학생이 직접 확인해야 할 내용", requireEditBeforeAdopt: false, requireFactVerification: false },
];

function makeAiCard(text, extra) {
  const t = toPlainText(text);
  return Object.assign({
    id: uid("aicard"), text: t, originalText: t, edited: false,
    source: "AI 제안", status: "미검토", factVerified: false,
  }, extra || {});
}

function buildAiSections(data) {
  return AI_SECTION_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    requireEditBeforeAdopt: def.requireEditBeforeAdopt,
    requireFactVerification: def.requireFactVerification,
    cards: (data[def.key] || []).map((t) => makeAiCard(t, { priority: def.priority || null })),
  })).filter((s) => s.cards.length > 0);
}

function splitTextIntoCards(rawText) {
  const lines = extractQuestionLikeLines(rawText);
  return lines.map((line) => makeAiCard(line));
}
function buildFallbackSection(rawText) {
  return {
    key: "fallback",
    label: "AI 원문 — 형식을 인식하지 못했습니다",
    requireEditBeforeAdopt: true,
    requireFactVerification: false,
    cards: splitTextIntoCards(rawText),
  };
}
