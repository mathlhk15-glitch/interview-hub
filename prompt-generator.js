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
    record: "당신은 대학입학 면접 준비를 돕는 코치입니다. 아래에 제공된 학교생활기록부 기록만을 근거로 면접 가능성이 높은 지점과 예상질문을 심층 분석하세요.",
    activity: "당신은 대학입학 면접 준비를 돕는 코치입니다. 아래 학생이 직접 입력한 활동과 경험만을 근거로 예상 면접질문과 꼬리질문을 심층 분석하세요.",
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
- 실제 기록상 설명이 필요한 부분
- 면접관이 진위·깊이를 확인할 가능성이 높은 부분
- 활동별 꼬리질문(사실→과정·판단→근거·한계)
- 학생이 직접 확인해야 할 내용

## 2. JSON (이 앱에 다시 붙여넣을 데이터)
반드시 아래 구조를 정확히 지켜 별도의 \`\`\`json 코드블록 안에 JSON만 넣으세요.
문자열 배열만 쓰지 말고, 아래 객체 필드명을 그대로 사용하세요.

{
  "coreRecords": [
    {
      "title": "기록을 한눈에 이해할 짧은 제목",
      "area": "학생부 영역/학년",
      "summary": "학생부에 실제로 적힌 내용만 간결히 요약",
      "evidenceQuote": "제공 자료에서 근거가 되는 원문 일부"
    }
  ],
  "coreActivities": [
    {
      "title": "핵심 활동명",
      "area": "학생부 영역/학년",
      "why": "왜 면접 핵심 활동 후보인지",
      "evidenceQuote": "제공 자료에서 근거가 되는 원문 일부"
    }
  ],
  "priorityA": [
    {
      "question": "반드시 준비할 실제 면접 질문 한 문장",
      "evidenceArea": "근거 학생부 영역/학년",
      "evidenceQuote": "질문의 근거가 되는 제공 자료 원문 일부",
      "evaluationPoint": "면접관이 확인하려는 역량/과정"
    }
  ],
  "priorityB": [
    {
      "question": "준비 권장 실제 면접 질문 한 문장",
      "evidenceArea": "근거 학생부 영역/학년",
      "evidenceQuote": "질문의 근거가 되는 제공 자료 원문 일부",
      "evaluationPoint": "면접관이 확인하려는 역량/과정"
    }
  ],
  "priorityC": [
    {
      "question": "여유가 있으면 준비할 질문 한 문장",
      "evidenceArea": "근거 학생부 영역/학년",
      "evidenceQuote": "질문의 근거가 되는 제공 자료 원문 일부",
      "evaluationPoint": "면접관이 확인하려는 역량/과정"
    }
  ],
  "needsExplanation": [
    {
      "topic": "객관적으로 설명 준비가 필요한 기록",
      "detail": "성적 변화·출결·진로 변경·선택과목 등 기록상 사실과 준비 방향",
      "evidenceArea": "근거 학생부 영역/학년",
      "evidenceQuote": "제공 자료에서 근거가 되는 원문 일부"
    }
  ],
  "interviewerVerificationPoints": [
    {
      "topic": "면접관이 진위·깊이를 확인할 가능성이 높은 부분",
      "reason": "왜 확인 질문이 이어질 수 있는지",
      "studentCheck": "학생이 실제 수행 범위·역할·근거 중 무엇을 확인해야 하는지",
      "evidenceArea": "근거 학생부 영역/학년",
      "evidenceQuote": "제공 자료에서 근거가 되는 원문 일부"
    }
  ],
  "followUpQuestions": [
    {
      "topic": "꼬리질문의 대상 활동/주제",
      "evidenceArea": "근거 학생부 영역/학년",
      "evidenceQuote": "제공 자료에서 근거가 되는 원문 일부",
      "questions": [
        "사실 확인형 꼬리질문?",
        "과정·판단을 확인하는 꼬리질문?",
        "근거·한계를 확인하는 꼬리질문?"
      ]
    }
  ],
  "needStudentVerification": [
    {
      "item": "AI가 자료만으로 확정할 수 없는 내용",
      "reason": "왜 직접 확인해야 하는지",
      "howToVerify": "학생부 원문·본인 실제 경험·대학 공식자료 중 무엇으로 확인할지"
    }
  ]
}

JSON 작성 규칙:
1. 제공된 학생 자료에 없는 활동·역할·성과·수치·도구를 새로 만들지 마세요.
2. evidenceQuote는 반드시 아래 제공 자료에서 확인되는 표현만 쓰세요. 근거 문구가 없으면 빈 문자열로 두고 해당 내용을 needStudentVerification에 넣으세요.
3. priorityA/B/C의 question은 반드시 실제로 말해 답할 수 있는 의문문으로 작성하세요.
4. followUpQuestions의 questions도 반드시 의문문으로 작성하고, topic만 적고 끝내지 마세요.
5. needsExplanation에는 성적 변화·출결·진로 변경·선택과목처럼 기록상 객관적 설명이 필요한 사항만 넣으세요.
6. 고교 수준을 상회해 보이는 탐구, 실제 수행 범위, 역할 진위, 관심사 연결성 같은 항목은 needsExplanation이 아니라 interviewerVerificationPoints에 넣으세요.
7. 학생부에 근거가 없거나 AI 추론이 필요한 내용은 사실처럼 단정하지 마세요.`;

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
