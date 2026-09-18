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
  if (typeof item === "string") return { question: item.trim(), evidenceArea: "", evidenceQuote: "", evaluationPoint: "", depth: "", recommendedFrame: "", verificationFocus: "", activityId: "" };
  const o = item && typeof item === "object" ? item : {};
  const frame = firstText(o, ["recommendedFrame", "frame", "answerFrame"]).toLowerCase();
  return {
    question: firstText(o, ["question", "text", "content", "title"]),
    evidenceArea: firstText(o, ["evidenceArea", "area", "section", "source"]),
    evidenceQuote: firstText(o, ["evidenceQuote", "evidence", "quote", "sourceText"]),
    evaluationPoint: firstText(o, ["evaluationPoint", "intent", "point", "reason"]),
    depth: firstText(o, ["depth", "questionDepth", "level"]).toLowerCase(),
    recommendedFrame: ["activity", "star", "oreo", "concept", "mmi"].includes(frame) ? frame : "",
    verificationFocus: firstText(o, ["verificationFocus", "studentCheck", "check", "verify"]),
    activityId: firstText(o, ["activityId", "activityID"]),
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


function normalizeActivityQuestion(item) {
  if (typeof item === "string") return { type: "", depth: "", question: item.trim(), evaluationPoint: "", recommendedFrame: "", verificationFocus: "" };
  const o = item && typeof item === "object" ? item : {};
  const frame = firstText(o, ["recommendedFrame", "frame", "answerFrame"]).toLowerCase();
  return {
    type: firstText(o, ["type", "kind", "direction", "category"]),
    depth: firstText(o, ["depth", "questionDepth", "level"]).toLowerCase(),
    question: firstText(o, ["question", "text", "content", "title"]),
    evaluationPoint: firstText(o, ["evaluationPoint", "intent", "point", "reason"]),
    recommendedFrame: ["activity", "star", "oreo", "concept", "mmi"].includes(frame) ? frame : "",
    verificationFocus: firstText(o, ["verificationFocus", "studentCheck", "check", "verify"]),
  };
}


function normalizeReverseMap(value) {
  const o = value && typeof value === "object" ? value : {};
  return {
    concept: firstText(o, ["concept", "keyConcept", "coreConcept"]),
    why: firstText(o, ["why", "motive", "personalWhy"]),
    processLimit: firstText(o, ["processLimit", "process", "limit", "trialAndError"]),
    sourceOwnership: firstText(o, ["sourceOwnership", "source", "ownership", "evidenceOwnership"]),
  };
}

function normalizeActivityInventoryItem(item, idx) {
  if (typeof item === "string") {
    return { activityId: `A${String(idx + 1).padStart(2, "0")}`, title: item.trim(), area: "", summary: item.trim(), evidenceQuote: "", tags: [], sourceConnections: [], reverseMap: { concept:"", why:"", processLimit:"", sourceOwnership:"" }, importance: "B", questions: [], followUpQuestions: [] };
  }
  const o = item && typeof item === "object" ? item : {};
  const importanceRaw = firstText(o, ["importance", "priority", "grade"]).toUpperCase();
  const importance = ["A", "B", "C"].includes(importanceRaw) ? importanceRaw : "B";
  return {
    activityId: firstText(o, ["activityId", "id"]) || `A${String(idx + 1).padStart(2, "0")}`,
    title: firstText(o, ["title", "activity", "name", "topic"]),
    area: firstText(o, ["area", "section", "source", "evidenceArea"]),
    summary: firstText(o, ["summary", "detail", "content", "text"]),
    evidenceQuote: firstText(o, ["evidenceQuote", "evidence", "quote", "sourceText"]),
    tags: asArray(o.tags || o.categories).map(toPlainText).filter(Boolean).slice(0, 6),
    sourceConnections: asArray(o.sourceConnections || o.sourcesUsed || o.materialConnections).map(toPlainText).filter(Boolean).slice(0, 6),
    reverseMap: normalizeReverseMap(o.reverseMap || o.reverseEngineering || o.questionMap),
    importance,
    questions: asArray(o.questions).map(normalizeActivityQuestion).filter((q) => q.question).slice(0, 8),
    followUpQuestions: asArray(o.followUpQuestions || o.followUps).map(toPlainText).filter(Boolean).slice(0, 6),
  };
}

function normalizeCoverageCheck(value, activityCount) {
  const o = value && typeof value === "object" ? value : {};
  const omittedItems = asArray(o.omittedItems).map((x) => {
    if (typeof x === "string") return { text: x.trim(), reason: "" };
    const v = x && typeof x === "object" ? x : {};
    return { text: firstText(v, ["text", "item", "title", "content"]), reason: firstText(v, ["reason", "detail", "description"]) };
  }).filter((x) => x.text || x.reason);
  const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  return {
    detectedActivityCount: num(o.detectedActivityCount, activityCount),
    analyzedActivityCount: num(o.analyzedActivityCount, activityCount),
    omittedItems,
    coverageNote: firstText(o, ["coverageNote", "note", "summary"]),
  };
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
  const activityInventory = asArray(p.activityInventory).map(normalizeActivityInventoryItem).filter((x) => x.title || x.summary || x.questions.length);
  return {
    analysisType: firstText(p, ["analysisType"]) || (activityInventory.length ? "full" : "legacy"),
    activityInventory,
    coreRecords: cleanObjects(p.coreRecords, normalizeCoreRecord, "summary"),
    coreActivities: cleanObjects(p.coreActivities, normalizeCoreActivity, "title").slice(0, 3),
    priorityA: cleanObjects(p.priorityA, normalizeQuestion, "question"),
    priorityB: cleanObjects(p.priorityB, normalizeQuestion, "question"),
    priorityC: cleanObjects(p.priorityC, normalizeQuestion, "question"),
    needsExplanation: objectiveExplanations,
    interviewerVerificationPoints: [...explicitVerification, ...inferredVerification],
    followUpQuestions: cleanObjects(p.followUpQuestions, normalizeFollowUpGroup),
    needStudentVerification: cleanObjects(p.needStudentVerification, normalizeStudentVerification, "item"),
    coverageCheck: normalizeCoverageCheck(p.coverageCheck, activityInventory.length),
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

// ── v7.3 RAG-lite: AI evidence quote ↔ original record verification ──────
function normalizeEvidenceText(value) {
  return String(value || '').toLowerCase().replace(/[\s\u00a0]+/g, '').replace(/[“”‘’'"`.,·•:;()\[\]{}<>!?？…\-–—_/\\]/g, '');
}
function charNgrams(text, n = 3) {
  const s = normalizeEvidenceText(text), set = new Set();
  if (s.length < n) { if (s) set.add(s); return set; }
  for (let i = 0; i <= s.length - n; i++) set.add(s.slice(i, i + n));
  return set;
}
function diceSimilarity(a, b) {
  const A = charNgrams(a), B = charNgrams(b); if (!A.size || !B.size) return 0;
  let hit = 0; for (const x of A) if (B.has(x)) hit++;
  return (2 * hit) / (A.size + B.size);
}
function bestEvidenceWindowSimilarity(quote, recordText) {
  const q = normalizeEvidenceText(quote), r = normalizeEvidenceText(recordText);
  if (!q || !r) return 0; if (r.includes(q)) return 1;
  if (r.length <= q.length * 1.45) return diceSimilarity(q, r);
  const sizes = [0.9, 1.0, 1.15, 1.3].map((x) => Math.max(8, Math.round(q.length * x)));
  const step = Math.max(1, Math.floor(q.length / 5)); let best = 0;
  for (const size of sizes) {
    for (let i = 0; i < r.length; i += step) {
      const win = r.slice(i, i + size); if (win.length < Math.min(8, q.length * 0.65)) break;
      best = Math.max(best, diceSimilarity(q, win)); if (best >= 0.94) return best;
    }
  }
  return best;
}
function evidenceSourceLabel(source, status) {
  const isRecord = source === '학생부/붙여넣기';
  if (status === 'verified') return isRecord ? '학생부 원문 확인' : '입력 자료에서 확인';
  if (status === 'similar') return isRecord ? '유사 학생부 원문 확인 - 직접 대조 권장' : '유사 입력 자료 확인 - 직접 대조 권장';
  return '원문에서 확인 안 됨 - 학생 확인 필요';
}
function verifyEvidenceQuote(quote) {
  const q = String(quote || '').trim();
  if (!q) return { status:'missing', score:0, label:'근거 인용 없음', recordId:null, source:null };
  const nq = normalizeEvidenceText(q);
  if (nq.length < 6) return { status:'short', score:0, label:'인용이 너무 짧아 확인 어려움', recordId:null, source:null };
  const records = (typeof AppState !== 'undefined' && Array.isArray(AppState.records))
    ? AppState.records.filter((r) => r && r.text && (r.source === '학생부/붙여넣기' || r.source === '직접 입력')) : [];
  for (const r of records) {
    const nr = normalizeEvidenceText(r.text);
    if (nr && (nr.includes(nq) || (nq.length > nr.length && nq.includes(nr) && nr.length >= 12))) {
      return { status:'verified', score:1, label:evidenceSourceLabel(r.source,'verified'), recordId:r.id, section:r.section||'', source:r.source };
    }
  }
  let best = { score:0, recordId:null, section:'', source:null };
  for (const r of records) {
    const score = bestEvidenceWindowSimilarity(q, r.text);
    if (score > best.score) best = { score, recordId:r.id, section:r.section||'', source:r.source };
  }
  if (best.score >= 0.66) return { status:'similar', score:best.score, label:evidenceSourceLabel(best.source,'similar'), recordId:best.recordId, section:best.section, source:best.source };
  return { status:'unverified', score:best.score, label:evidenceSourceLabel(best.source,'unverified'), recordId:best.recordId, section:best.section, source:best.source };
}

