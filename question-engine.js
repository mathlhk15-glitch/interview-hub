/**
 * question-engine.js
 * 규칙 기반 질문 생성기. "정답"이 아니라 "질문의 초안"을 만듭니다.
 * 학생부에 없는 사실을 전제로 넣지 않도록, 질문 문장은 항상 일반형 프레임(§13)을
 * 그대로 사용하고 기록 원문은 "근거"로만 별도 표시합니다.
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
    source: "규칙 기반 추천", // 출처 배지: 학생 작성 / 규칙 기반 추천 / AI 제안
    priority: null,      // A/B/C — 학생이 직접 정하거나 estimatePriorityReason()로 참고값만 계산
    followUps: window.APP_DATA.followUpLayers.map((l) => ({ ...l, done: false, note: "" })),
  }));
}

// 참고용 우선순위 추정 — 자동 확정이 아니라 "왜 이렇게 추정했는지"를 함께 보여줍니다.
// record.tags(배열, ◎■▲✕ 다중 선택 가능)를 실제로 반영합니다. 활동 반복 횟수나
// 키워드 수만으로 A를 주지 않도록, 근거를 문자열로 남깁니다.
function estimatePriorityReason(record, universityFactors) {
  const reasons = [];
  const tagWeight = {
    career: "전공 연결성이 높은 항목(◎)입니다.",
    academic: "탐구·분석 과정이 드러나는 항목(■)입니다.",
    community: "협력·리더십이 드러나는 항목(▲)입니다.",
    explain: "설명이 필요한 항목(✕)입니다 — 준비 필수.",
  };
  const tags = (record && Array.isArray(record.tags)) ? record.tags : [];
  if (!tags.length) {
    reasons.push("이 기록에는 아직 태그가 없습니다 — 학생부 근거 지도에서 태그를 지정하면 추정이 더 정확해집니다.");
  } else {
    tags.forEach((t) => { if (tagWeight[t]) reasons.push(tagWeight[t]); });
  }
  if (universityFactors && universityFactors.length) {
    reasons.push(`지원 대학이 밝힌 배점 비중이 큰 역량: ${universityFactors.join(", ")}`);
  }
  reasons.push("※ 이 추정은 참고용입니다. 최종 등급(A/B/C)은 학생·교사가 직접 정하고, 바꾼 이유를 남기세요.");
  return reasons.join(" ");
}

function buildFollowUpChecklist() {
  return window.APP_DATA.followUpLayers.map((l) => ({ ...l, done: false, note: "" }));
}

// AI 결과나 사람이 쓴 자유 텍스트에서, 의미 있는 줄만 뽑아 "질문/제안 카드" 초안으로 변환.
// ai-result-parser.js의 폴백 스플리터가 이 함수를 재사용합니다.
function extractQuestionLikeLines(text) {
  if (!text) return [];
  const rawLines = text.split(/\n+/).map((l) => l.replace(/^[-*\u2022\d.\)\s]+/, "").trim()).filter(Boolean);
  return rawLines.filter((l) => l.length >= 4);
}
