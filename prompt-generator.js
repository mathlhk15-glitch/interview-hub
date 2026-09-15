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
    ? `당신은 대학입학 서류기반 면접을 준비시키는 전문 코치입니다.
가장 중요한 목표는 '핵심 3개만 뽑는 것'이 아니라, 먼저 아래 학생 자료 전체에서 면접에 의미가 있는 활동을 가능한 한 빠짐없이 찾아내는 것입니다.

반드시 다음 순서로 분석하세요.
1) 전체 자료를 처음부터 끝까지 훑어 의미 있는 활동 인벤토리를 작성합니다.
2) 각 활동을 사실 → 동기 → 과정 → 역할 → 개념 → 한계 → 확장의 7단계 깊이 지도에서 분석합니다. 모든 활동에 7개 질문을 강제로 만들지는 마세요.
3) 중요도에 따라 질문 깊이를 조절합니다. A급 활동은 5~7개, B급은 3~4개, C급은 1~2개의 핵심 질문을 권장합니다.
4) 각 활동에서 필요한 꼬리질문을 1~3개 만듭니다. A급 핵심활동은 가능하면 ① 개념·진위 ② 과정·시행착오 ③ 조건변형·응용 순으로 구성합니다.
5) 전체 질문을 다시 검토하여 A(반드시 준비) / B(준비 권장) / C(여유가 있으면)로 분류합니다.
6) 그 다음에야 면접에서 가장 깊게 준비할 핵심활동 TOP 3를 선정합니다.
7) 마지막으로 누락된 활동이 없는지 스스로 점검합니다.

활동 수를 임의로 3개, 5개, 10개로 제한하지 마세요. 학생부에 의미 있는 활동이 18개라면 18개 모두 activityInventory에 넣으세요.`
    : `당신은 대학입학 면접을 준비시키는 전문 코치입니다. 아래에 제공된 핵심 활동 또는 선택 기록을 깊게 분석하세요.
사실 → 동기 → 과정 → 본인 역할 → 개념·방법 → 한계·반론 → 확장·전공연결 순으로 깊이를 높이세요.`;

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
      "sourceConnections": ["도서", "기사", "실험"],
      "reverseMap": {
        "concept": "학생이 쉬운 말로 설명해야 할 핵심 개념. 원문 근거가 없으면 학생 확인 필요",
        "why": "학생부에서 확인되는 실제 계기 또는 학생 확인 필요",
        "processLimit": "시행착오·수정·한계. 원문에 없으면 학생 확인 필요",
        "sourceOwnership": "자료 출처·신뢰성·한계와 본인이 직접 한 범위. 원문에 없으면 학생 확인 필요"
      },
      "importance": "A",
      "questions": [
        {"type": "동기", "depth": "motive", "question": "실제 면접 질문?", "evaluationPoint": "확인하려는 역량/과정", "recommendedFrame": "activity", "verificationFocus": "학생이 직접 확인할 핵심"},
        {"type": "개념", "depth": "concept", "question": "실제 면접 질문?", "evaluationPoint": "개념 이해", "recommendedFrame": "concept", "verificationFocus": "핵심 개념을 쉬운 말로 설명 가능한지"},
        {"type": "진정성·소유권", "depth": "role", "question": "참고한 자료와 본인이 직접 수행·판단한 부분을 구분해 설명하는 질문?", "evaluationPoint": "활동 진위·학업적 정직성", "recommendedFrame": "activity", "verificationFocus": "자료 출처와 본인 기여 범위"}
      ],
      "followUpQuestions": ["STAGE 1 개념·진위 질문?", "STAGE 2 과정·시행착오 질문?", "STAGE 3 조건변형·응용 질문?"]
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
      "sourceConnections": ["도서", "기사", "실험"],
      "reverseMap": {
        "concept": "학생이 쉬운 말로 설명해야 할 핵심 개념. 원문 근거가 없으면 학생 확인 필요",
        "why": "학생부에서 확인되는 실제 계기 또는 학생 확인 필요",
        "processLimit": "시행착오·수정·한계. 원문에 없으면 학생 확인 필요",
        "sourceOwnership": "자료 출처·신뢰성·한계와 본인이 직접 한 범위. 원문에 없으면 학생 확인 필요"
      },
      "importance": "A",
      "questions": [
        {"type": "사실", "depth": "fact", "question": "활동 자체를 설명하는 질문?", "evaluationPoint": "활동 이해", "recommendedFrame": "activity", "verificationFocus": "활동의 실제 목적과 범위"},
        {"type": "동기", "depth": "motive", "question": "왜 시작했는지 묻는 질문?", "evaluationPoint": "탐구 동기", "recommendedFrame": "activity", "verificationFocus": "구체적인 계기"},
        {"type": "과정·역할", "depth": "process", "question": "과정과 본인 역할을 묻는 질문?", "evaluationPoint": "주도성", "recommendedFrame": "activity", "verificationFocus": "본인이 직접 한 행동"},
        {"type": "진정성·소유권", "depth": "role", "question": "참고한 자료와 본인이 직접 수행·판단한 부분을 구분해 설명하는 질문?", "evaluationPoint": "활동 진위·학업적 정직성", "recommendedFrame": "activity", "verificationFocus": "자료 출처·신뢰성과 본인 기여 범위"},
        {"type": "개념·방법", "depth": "concept", "question": "핵심 개념·방법을 설명하는 질문?", "evaluationPoint": "학업 이해", "recommendedFrame": "concept", "verificationFocus": "기초 개념과 원리"},
        {"type": "한계·확장", "depth": "limit", "question": "한계와 보완을 묻는 질문?", "evaluationPoint": "성찰·확장", "recommendedFrame": "activity", "verificationFocus": "한계 인식과 후속 탐구"}
      ],
      "followUpQuestions": ["STAGE 1 개념·진위 질문?", "STAGE 2 과정·시행착오 질문?", "STAGE 3 조건변형·응용 질문?"]
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

  return `${mission}\n\n중요 규칙:\n${principles}\n\n추가 절대 규칙:\n- 제공 자료에 없는 활동·역할·성과·수치·도구·데이터셋을 만들어내지 마세요.\n- 학생부의 행정표, 출결 숫자, 페이지 머리말, 표 깨짐처럼 활동이 아닌 문자열은 활동으로 만들지 마세요.\n- 문장이 잘려 있거나 표 순서가 뒤섞여 의미가 불확실하면 추정하지 말고 needStudentVerification에 넣으세요.\n- 질문은 반드시 학생이 말로 답할 수 있는 의문문으로 작성하세요.\n- evidenceQuote는 아래 자료에 실제로 존재하는 표현만 사용하세요.\n- 완성 모범답안을 작성하지 마세요.\n- 각 질문에는 depth를 fact/motive/process/role/concept/limit/extend 중 하나로 표시하세요.\n- recommendedFrame은 activity/star/oreo/concept/mmi 중 하나를 선택하세요. 학생부 탐구는 보통 activity, 개념 검증은 concept, 갈등·협업은 star, 가치판단은 oreo를 우선합니다.\n- verificationFocus에는 학생이 반드시 본인 경험이나 교과 개념으로 확인해야 할 한 가지를 짧게 적으세요.\n- reverseMap은 결과 문장을 사고 과정으로 되짚는 보조지도입니다. concept/why/processLimit/sourceOwnership을 학생부 근거에 따라 짧게 채우되, 원문으로 확정할 수 없는 칸은 "학생 확인 필요"라고 적으세요.\n- 학생부에 도서·기사·강연·실험·데이터·영상 등 자료와 연결된 활동이 명시되어 있으면 sourceConnections에 유형을 넣으세요. 단, 자료에 없는 연결은 만들지 마세요.\n- 자료·데이터·참고문헌이 있는 활동은 출처를 왜 신뢰했는지, 어떤 한계가 있는지, 참고한 내용과 학생이 직접 수행·판단한 부분을 구분할 수 있는 질문을 포함하세요.\n- 전문용어가 있는 활동은 단순 정의 암기보다 쉬운 말과 기본 교과 원리로 설명하도록 질문하세요.\n- A급 핵심활동의 followUpQuestions는 가능하면 ① 개념·진위 ② 과정·시행착오 ③ 조건변형·응용 순으로 작성하세요. 조건변형은 변수·전제·반론 하나를 바꾸어 묻는 방식입니다.\n- 출력이 길어질 경우 일반 보기용 설명은 짧게 줄여도 되지만 JSON의 activityInventory와 각 활동의 질문은 누락하지 마세요.\n- ${isFull ? "전체 활동을 먼저 수집한 뒤 중요도를 판단하세요. 중요도 판단을 이유로 활동 자체를 누락하지 마세요." : "핵심 활동은 넓게 늘리지 말고 깊이 있게 파고드세요."}\n\n${uniInfo}\n\n분석할 학생 자료:\n"""\n${redactedPreviewText || "(선택된 자료 없음)"}\n"""\n\n## 일반 보기용\n${isFull ? "- 전체 활동 인벤토리(학년/영역 순)\n- 활동별 예상질문\n- A/B/C 우선순위\n- 핵심활동 TOP 3\n- 설명 필요 기록\n- 면접관 확인 가능 지점\n- 누락 점검" : "- 핵심활동별 심층 질문 세트\n- 개념·진위→과정·시행착오→조건변형·응용 꼬리질문\n- 학생이 직접 확인해야 할 부분"}\n\n## JSON\n반드시 마지막에 아래 구조를 정확히 지켜 별도의 \`\`\`json 코드블록 안에 JSON만 넣으세요.\n${isFull ? fullSchema : deepSchema}\n\nJSON 작성 규칙:\n1. activityInventory는 ${isFull ? "의미 있는 활동 전체" : "분석 대상 핵심 활동"}를 담습니다.\n2. activityInventory.questions는 각 활동에 직접 연결된 질문만 넣고, 각 질문에 depth/recommendedFrame/verificationFocus를 함께 넣습니다. 활동에 자료·데이터·전문용어가 있으면 진정성·소유권·출처 검증 질문도 고려합니다.\n3. importance는 A/B/C 중 하나입니다. A급은 7단계 깊이를 넓게, B/C는 핵심 단계만 골라 질문 수를 조절합니다.\n4. coreActivities는 전체 인벤토리를 만든 다음 TOP3를 선택합니다.\n5. needsExplanation에는 성적·출결·진로 변경·선택과목 같은 객관적 설명 필요사항만 넣습니다.\n6. 실제 수행 범위·고교 수준을 넘어 보이는 활동·역할 진위는 interviewerVerificationPoints에 넣습니다.\n7. coverageCheck.analyzedActivityCount는 activityInventory의 실제 개수와 일치해야 합니다.\n8. 분석 마지막에 원문을 다시 훑어 activityInventory에서 빠진 의미 있는 활동이 없는지 확인하세요.`;
}
