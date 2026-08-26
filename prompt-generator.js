/**
 * prompt-generator.js — v5 AI-first
 * API를 호출하지 않습니다. 사용자가 복사해 원하는 AI(ChatGPT/Claude/Gemini 등)에 붙여넣을
 * 프롬프트만 만듭니다.
 */

const SENSITIVE_BY_DEFAULT_OFF = ["교과성적", "출결", "행동특성 및 종합의견"];

function buildAiPrompt({ university, mode, redactedPreviewText }) {
  const principles = window.APP_DATA.aiPromptPrinciples.map((p) => "- " + p).join("\n");
  const uniInfo = university
    ? `지원 대학: ${university.name || "(미입력)"}\n학과: ${university.major || "(미입력)"}\n전형: ${university.track || "(미입력)"}\n` +
      `면접유형: ${(typeof effectiveInterviewType === "function" ? effectiveInterviewType(university) : (university.typeGuessOverride || university.typeGuess)) || "(미판별)"}\n평가요소와 배점: ${university.evalWeights || "(미입력 — 모집요강 확인 필요)"}`
    : "지원 대학: (미입력 — 학생 자료 중심으로 분석)";

  const isFull = ["record-full", "activity-full", "full"].includes(mode);
  const isDeep = ["record-deep", "record", "activity", "single"].includes(mode);

  if (mode === "feedback") {
    return `당신은 대학입학 면접 코치입니다. 아래 학생 답변을 점검하되, 학생 대신 완성 답변을 새로 써주지 마세요.\n\n중요 규칙:\n${principles}\n\n${uniInfo}\n\n점검할 항목:\n${window.APP_DATA.answerCheckPrinciples.map((p) => "- " + p).join("\n")}\n\n학생 답변:\n"""\n${redactedPreviewText || "(내용 없음)"}\n"""\n\n반드시 아래 JSON을 마지막에 별도 코드블록으로 출력하세요.\n\n\`\`\`json\n{\n  "goodPoint": "잘된 점 1개",\n  "improvements": ["보완할 점 1", "보완할 점 2"],\n  "followUpQuestions": ["예상 꼬리질문 1?", "예상 꼬리질문 2?"]\n}\n\`\`\``;
  }

  const mission = isFull
    ? `당신은 대학입학 서류기반 면접을 준비시키는 전문 코치입니다.\n가장 중요한 목표는 '핵심 3개만 뽑는 것'이 아니라, 먼저 아래 학생 자료 전체에서 면접에 의미가 있는 활동을 가능한 한 빠짐없이 찾아내는 것입니다.\n\n반드시 다음 순서로 분석하세요.\n1) 전체 자료를 처음부터 끝까지 훑어 의미 있는 활동 인벤토리를 작성합니다.\n2) 각 활동마다 학생에게 실제로 물을 수 있는 질문을 2~4개 만듭니다.\n3) 각 활동에서 필요한 꼬리질문을 1~3개 만듭니다.\n4) 전체 질문을 다시 검토하여 A(반드시 준비) / B(준비 권장) / C(여유가 있으면)로 분류합니다.\n5) 그 다음에야 면접에서 가장 깊게 준비할 핵심활동 TOP 3를 선정합니다.\n6) 마지막으로 누락된 활동이 없는지 스스로 점검합니다.\n\n활동 수를 임의로 3개, 5개, 10개로 제한하지 마세요. 학생부에 의미 있는 활동이 18개라면 18개 모두 activityInventory에 넣으세요.`
    : `당신은 대학입학 면접을 준비시키는 전문 코치입니다. 아래에 제공된 핵심 활동 또는 선택 기록을 깊게 분석하세요.\n사실 확인 → 동기 → 과정·판단 → 개념·방법 → 본인 역할 → 한계·보완 → 전공·진로 연결 순으로 깊이를 높이세요.`;

  const fullSchema = `{
  "analysisType": "full",
  "activityInventory": [
    {
      "activityId": "A01",
      "title": "활동을 구별할 수 있는 짧은 이름",
      "area": "학생부 영역/학년/과목",
      "summary": "제공 자료에 실제로 적힌 활동 내용만 요약",
      "evidenceQuote": "제공 자료에서 확인되는 근거 원문 일부",
      "tags": ["학업", "진로"],
      "importance": "A",
      "questions": [
        {"type": "동기", "question": "실제 면접 질문?", "evaluationPoint": "확인하려는 역량/과정"},
        {"type": "과정·역할", "question": "실제 면접 질문?", "evaluationPoint": "확인하려는 역량/과정"}
      ],
      "followUpQuestions": ["꼬리질문?", "꼬리질문?"]
    }
  ],
  "coreActivities": [
    {"title": "핵심 활동명", "area": "학생부 영역/학년", "why": "TOP3로 선정한 이유", "evidenceQuote": "근거 원문 일부"}
  ],
  "priorityA": [
    {"question": "반드시 준비할 질문?", "evidenceArea": "근거 영역", "evidenceQuote": "근거 원문", "evaluationPoint": "평가 포인트"}
  ],
  "priorityB": [],
  "priorityC": [],
  "needsExplanation": [
    {"topic": "객관적으로 설명 준비가 필요한 기록", "detail": "준비 방향", "evidenceArea": "근거 영역", "evidenceQuote": "근거 원문"}
  ],
  "interviewerVerificationPoints": [
    {"topic": "진위·깊이 확인 가능 지점", "reason": "이유", "studentCheck": "학생이 확인할 것", "evidenceArea": "근거 영역", "evidenceQuote": "근거 원문"}
  ],
  "needStudentVerification": [
    {"item": "AI가 자료만으로 확정할 수 없는 내용", "reason": "이유", "howToVerify": "확인 방법"}
  ],
  "coverageCheck": {
    "detectedActivityCount": 0,
    "analyzedActivityCount": 0,
    "omittedItems": [
      {"text": "면접 활동으로 보기 어려워 제외한 항목", "reason": "제외 이유"}
    ],
    "coverageNote": "전체 자료를 다시 훑어 누락 여부를 점검한 결과"
  }
}`;

  const deepSchema = `{
  "analysisType": "deep",
  "activityInventory": [
    {
      "activityId": "D01",
      "title": "핵심 활동명",
      "area": "학생부 영역/학년",
      "summary": "근거 기반 요약",
      "evidenceQuote": "근거 원문 일부",
      "tags": ["학업", "진로"],
      "importance": "A",
      "questions": [
        {"type": "사실·역할", "question": "본인이 직접 한 일을 확인하는 질문?", "evaluationPoint": "역할 진위"},
        {"type": "동기·판단", "question": "왜 그렇게 했는지 묻는 질문?", "evaluationPoint": "판단 과정"},
        {"type": "개념·방법", "question": "핵심 개념·방법을 설명하는 질문?", "evaluationPoint": "학업 이해"},
        {"type": "한계·확장", "question": "한계와 보완을 묻는 질문?", "evaluationPoint": "성찰·확장"},
        {"type": "전공연결", "question": "전공·진로와 연결하는 질문?", "evaluationPoint": "진로역량"}
      ],
      "followUpQuestions": ["1층 사실 질문?", "2층 과정·판단 질문?", "3층 근거·한계 질문?"]
    }
  ],
  "coreActivities": [],
  "priorityA": [],
  "priorityB": [],
  "priorityC": [],
  "needsExplanation": [],
  "interviewerVerificationPoints": [],
  "needStudentVerification": [],
  "coverageCheck": {"detectedActivityCount": 0, "analyzedActivityCount": 0, "omittedItems": [], "coverageNote": "심화분석"}
}`;

  return `${mission}\n\n중요 규칙:\n${principles}\n\n추가 절대 규칙:\n- 제공 자료에 없는 활동·역할·성과·수치·도구·데이터셋을 만들어내지 마세요.\n- 학생부의 행정표, 출결 숫자, 페이지 머리말, 표 깨짐처럼 활동이 아닌 문자열은 활동으로 만들지 마세요.\n- 문장이 잘려 있거나 표 순서가 뒤섞여 의미가 불확실하면 추정하지 말고 needStudentVerification에 넣으세요.\n- 질문은 반드시 학생이 말로 답할 수 있는 의문문으로 작성하세요.\n- evidenceQuote는 아래 자료에 실제로 존재하는 표현만 사용하세요.\n- 완성 모범답안을 작성하지 마세요.\n- 출력이 길어질 경우 일반 보기용 설명은 짧게 줄여도 되지만 JSON의 activityInventory와 각 활동의 질문은 누락하지 마세요.\n- ${isFull ? "전체 활동을 먼저 수집한 뒤 중요도를 판단하세요. 중요도 판단을 이유로 활동 자체를 누락하지 마세요." : "핵심 활동은 넓게 늘리지 말고 깊이 있게 파고드세요."}\n\n${uniInfo}\n\n분석할 학생 자료:\n"""\n${redactedPreviewText || "(선택된 자료 없음)"}\n"""\n\n## 일반 보기용\n${isFull ? "- 전체 활동 인벤토리(학년/영역 순)\n- 활동별 예상질문\n- A/B/C 우선순위\n- 핵심활동 TOP 3\n- 설명 필요 기록\n- 면접관 확인 가능 지점\n- 누락 점검" : "- 핵심활동별 심층 질문 세트\n- 사실→과정·판단→근거·한계 꼬리질문\n- 학생이 직접 확인해야 할 부분"}\n\n## JSON\n반드시 마지막에 아래 구조를 정확히 지켜 별도의 \`\`\`json 코드블록 안에 JSON만 넣으세요.\n${isFull ? fullSchema : deepSchema}\n\nJSON 작성 규칙:\n1. activityInventory는 ${isFull ? "의미 있는 활동 전체" : "분석 대상 핵심 활동"}를 담습니다.\n2. activityInventory.questions는 각 활동에 직접 연결된 질문만 넣습니다.\n3. importance는 A/B/C 중 하나입니다.\n4. coreActivities는 전체 인벤토리를 만든 다음 TOP3를 선택합니다.\n5. needsExplanation에는 성적·출결·진로 변경·선택과목 같은 객관적 설명 필요사항만 넣습니다.\n6. 실제 수행 범위·고교 수준을 넘어 보이는 활동·역할 진위는 interviewerVerificationPoints에 넣습니다.\n7. coverageCheck.analyzedActivityCount는 activityInventory의 실제 개수와 일치해야 합니다.\n8. 분석 마지막에 원문을 다시 훑어 activityInventory에서 빠진 의미 있는 활동이 없는지 확인하세요.`;
}
