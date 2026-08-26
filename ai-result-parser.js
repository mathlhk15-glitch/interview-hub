/**
 * ai-result-parser.js
 * 외부 AI의 분석 결과를 구조화합니다. API 호출은 없습니다.
 */

function extractJsonCandidates(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const candidates = [];
  const fenced = rawText.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);
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
  return { ok: false, reason: "JSON 형식을 찾지 못했습니다. 아래 텍스트 카드 변환을 사용하세요." };
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
          improvements: arr(p.improvements).map(String).slice(0, 2),
          followUpQuestions: arr(p.followUpQuestions).map(String).slice(0, 5),
        },
      };
    } catch (e) { /* 다음 후보 */ }
  }
  return { ok: false, reason: "피드백 JSON을 찾지 못했습니다." };
}

function normalizeAiJson(parsed) {
  const arr = (v) => Array.isArray(v) ? v : (v ? [v] : []);
  return {
    coreRecords: arr(parsed.coreRecords),
    coreActivities: arr(parsed.coreActivities),
    priorityA: arr(parsed.priorityA),
    priorityB: arr(parsed.priorityB),
    priorityC: arr(parsed.priorityC),
    needsExplanation: arr(parsed.needsExplanation),
    followUpQuestions: arr(parsed.followUpQuestions),
    needStudentVerification: arr(parsed.needStudentVerification),
  };
}

const AI_SECTION_DEFS = [
  { key: "coreRecords", label: "핵심 기록", requireEditBeforeAdopt: false, requireFactVerification: true },
  { key: "coreActivities", label: "핵심 활동 후보 TOP 3", requireEditBeforeAdopt: false, requireFactVerification: true },
  { key: "priorityA", label: "A · 반드시 준비", priority: "A", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "priorityB", label: "B · 준비 권장", priority: "B", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "priorityC", label: "C · 여유가 있으면", priority: "C", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "needsExplanation", label: "설명이 필요한 기록", requireEditBeforeAdopt: false, requireFactVerification: true },
  { key: "followUpQuestions", label: "꼬리질문", requireEditBeforeAdopt: false, requireFactVerification: false },
  { key: "needStudentVerification", label: "학생이 직접 확인해야 할 내용", requireEditBeforeAdopt: false, requireFactVerification: false },
];

function makeAiCard(text, extra) {
  const t = typeof text === "string" ? text : JSON.stringify(text);
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
    label: "AI 원문 — 형식을 인식하지 못해 줄 단위로 나눴습니다 (편집 후에만 채택 가능)",
    requireEditBeforeAdopt: true,
    requireFactVerification: false,
    cards: splitTextIntoCards(rawText),
  };
}
