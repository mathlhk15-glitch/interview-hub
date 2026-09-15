const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
let counter = 0;
const ctx = {
  console,
  window: {},
  AppState: {records:[], questions:[], activities:[], analysisResult:null, analysisUpdatedAt:null},
  uid: (p='id') => `${p}_${++counter}`,
  getActiveUniversity: () => ctx.__uni || null,
  __uni: {id:'u1', name:'테스트대', major:'미디어커뮤니케이션학과', track:'학생부종합'},
  setTimeout, clearTimeout,
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['data.js','record-parser.js','question-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'), ctx, {filename:f});
}
const text = [
  '세부능력 및 특기사항',
  '사회문화 수업에서 지역별 미디어 이용 격차 자료를 조사하고 통계 자료를 비교 분석하여 발표함.',
  '확률과 통계에서 표본의 대표성을 검토하고 자료 해석의 한계를 찾아 보고서를 수정함.',
  '진로활동',
  '미디어커뮤니케이션 분야에 관심을 가지고 뉴스 프레이밍 사례를 조사하여 발표함.',
  '동아리활동',
  '미디어 동아리에서 팀원과 역할을 나누어 영상 기획과 인터뷰 질문 제작을 맡음.',
  '출결상황',
  '지각 1회'
].join('\n');
ctx.AppState.records = ctx.draftRecordsFromText(text, null);
const result = ctx.runAutomaticInterviewAnalysis();
const fails = [];
function check(cond, msg){ if(!cond) fails.push(msg); }
check(ctx.AppState.records.length >= 5, 'records parsed');
check(result && result.coreRecords.length >= 3, 'core records');
check(result.mandatoryQuestions.length >= 4, 'mandatory questions');
check(ctx.AppState.questions.some(q => q.priority === 'A'), 'A questions');
check(result.explainRecords.length >= 1, 'explain record');
check(result.coreRecords.some(x => x.tags.includes('academic')), 'academic tag');
check(result.coreRecords.some(x => x.tags.includes('career')), 'career tag');
check(ctx.guessSectionForLine('실험 결과를 분석하여 발표함') !== '출결', 'result word not attendance');
console.log(JSON.stringify({records:ctx.AppState.records.length, core:result.coreRecords.length, A:result.mandatoryQuestions.length, B:result.recommendedQuestions.length, explain:result.explainRecords.length, fails}, null, 2));
if(fails.length) process.exit(1);
