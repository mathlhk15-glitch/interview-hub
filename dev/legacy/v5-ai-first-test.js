const fs = require('fs');
const vm = require('vm');

const ctx = {
  console,
  window: {
    APP_DATA: {
      aiPromptPrinciples: ['자료에 없는 사실을 만들지 않는다', '완성 답변을 대신 쓰지 않는다'],
      answerCheckPrinciples: ['질문에 답했는가'],
    },
  },
  effectiveInterviewType: () => '서류 기반',
  uid: (p) => p + '_1',
};
vm.createContext(ctx);
for (const f of ['prompt-generator.js','ai-result-parser.js']) {
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}

const prompt = ctx.buildAiPrompt({
  university: {name:'테스트대',major:'공학',track:'종합',evalWeights:''},
  mode:'record-full',
  redactedPreviewText:'1학년 진로활동 NPU 탐구\n2학년 동아리 압전소자 실험',
});
if (!prompt.includes('전체 활동 인벤토리') || !prompt.includes('activityInventory') || !prompt.includes('누락')) throw new Error('AI-first prompt missing');

const sample = JSON.stringify({
  analysisType:'full',
  activityInventory:[
    {activityId:'A01',title:'NPU 탐구',area:'1학년 진로',summary:'NPU 탐구',evidenceQuote:'NPU 탐구',tags:['진로'],importance:'A',questions:[{type:'동기',question:'왜 탐구했습니까?',evaluationPoint:'동기'}],followUpQuestions:['무엇을 직접 했습니까?']},
    {activityId:'A02',title:'압전소자 실험',area:'2학년 동아리',summary:'압전소자 실험',evidenceQuote:'압전소자 실험',tags:['학업'],importance:'B',questions:[{type:'과정',question:'어떻게 실험했습니까?',evaluationPoint:'과정'}],followUpQuestions:[]},
  ],
  coreActivities:[{title:'NPU 탐구',area:'1학년 진로',why:'전공 관련',evidenceQuote:'NPU 탐구'}],
  priorityA:[{question:'NPU 탐구에서 직접 한 일은?',evidenceArea:'1학년 진로',evidenceQuote:'NPU 탐구',evaluationPoint:'역할'}],
  priorityB:[],priorityC:[],needsExplanation:[],interviewerVerificationPoints:[],needStudentVerification:[],
  coverageCheck:{detectedActivityCount:2,analyzedActivityCount:2,omittedItems:[],coverageNote:'전체 재검토 완료'}
});
const parsed = ctx.tryParseAiJson('```json\n'+sample+'\n```');
if (!parsed.ok) throw new Error('parse failed');
if (parsed.data.activityInventory.length !== 2) throw new Error('inventory lost');
if (parsed.data.activityInventory[0].questions[0].question !== '왜 탐구했습니까?') throw new Error('activity question lost');
if (parsed.data.coverageCheck.analyzedActivityCount !== 2) throw new Error('coverage lost');
console.log('v5 AI-first tests PASS');
