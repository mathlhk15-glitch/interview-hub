/**
 * prompt-generator.js
 * API를 호출하지 않습니다. "복사해서 학생이 쓰는 AI에 붙여넣을 텍스트"를 만들 뿐입니다.
 * 성적·출결·행동특성처럼 민감도가 높은 항목은 기본 체크 해제 상태로 시작합니다.
 */

const SENSITIVE_BY_DEFAULT_OFF = ["교과성적", "출결", "행동특성 및 종합의견"];

function buildAiPrompt({ selectedRecords, university, mode, redactedPreviewText }) {
  const principles = window.APP_DATA.aiPromptPrinciples.map((p) => "- " + p).join("\n");
  const uniInfo = university
    ? `지원 대학: ${university.name || "(미입력)"}\n학과: ${university.major || "(미입력)"}\n전형: ${university.track || "(미입력)"}\n` +
      `면접유형: ${(typeof effectiveInterviewType === "function" ? effectiveInterviewType(university) : (university.typeGuessOverride || university.typeGuess)) || "(미판별)"}\n평가요소와 배점: ${university.evalWeights || "(미입력 — 모집요강 확인 필요)"}`
    : "지원 대학: (미입력)";

  const modeHeader = {
    full: "당신은 대학입학 면접 준비를 돕는 코치입니다. 아래 학생 자료 전체를 분석하세요.",
    single: "당신은 대학입학 면접 준비를 돕는 코치입니다. 아래 학생 자료 중 선택된 기록 하나를 집중 분석하세요.",
    feedback: "당신은 대학입학 면접 준비를 돕는 코치입니다. 아래 학생의 답변 초안을 점검하세요. 학생의 답변을 대신 다시 써주지 마세요.",
  }[mode] || "당신은 대학입학 면접 준비를 돕는 코치입니다.";

  const outputFormat = mode === "feedback"
    ? `아래 두 부분으로 나누어 답하세요.

## 1. 일반 보기용
- 잘된 점 1개
- 보완할 점 최대 2개
- 예상 꼬리질문 2개
(완성된 답변 전체를 새로 써주는 것은 금지합니다.)

## 2. JSON (반드시 별도의 코드블록 \`\`\`json ... \`\`\` 안에만 넣으세요)
{
  "goodPoint": "",
  "improvements": [],
  "followUpQuestions": []
}`
    : `아래 두 부분으로 나누어 답하세요.

## 1. 일반 보기용 (사람이 읽는 설명)
- 핵심 기록
- 핵심 활동 후보 TOP 3
- A — 반드시 준비할 질문 / B — 준비 권장 질문
- 설명이 필요한 기록
- 활동별 꼬리질문(사실→과정·판단→근거·한계)
- 학생이 직접 확인해야 할 내용

## 2. JSON (이 앱에 다시 붙여넣을 데이터 — 반드시 별도의 코드블록 \`\`\`json ... \`\`\` 안에만 넣고,
그 코드블록 안에는 JSON 외의 다른 문장을 절대 섞지 마세요)
{
  "coreRecords": [],
  "coreActivities": [],
  "priorityA": [],
  "priorityB": [],
  "priorityC": [],
  "needsExplanation": [],
  "followUpQuestions": [],
  "needStudentVerification": []
}`;

  const answerCheck = mode === "feedback"
    ? "점검할 항목:\n" + window.APP_DATA.answerCheckPrinciples.map((p) => "- " + p).join("\n")
    : "";

  return `${modeHeader}

중요 규칙:
${principles}

${uniInfo}

${answerCheck}

분석할 학생 자료 (학생이 직접 확인하고 개인정보를 제거한 내용입니다):
"""
${redactedPreviewText || "(선택된 자료 없음)"}
"""

${outputFormat}
`;
}
