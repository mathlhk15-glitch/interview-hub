const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'ai-result-parser.js'), 'utf8'), ctx);

const fixture = {
  coreRecords: [
    { area: '자율활동 2학년 / 동아리활동 2학년', summary: '압전소자 직렬·병렬 연결 실험 및 정류회로 설계' },
  ],
  coreActivities: [
    { title: 'NPU 연산 성능 평가 실험', area: '진로활동 1학년', why: '탐구 과정과 판단을 확인하기 좋음', evidenceQuote: 'NPU 병렬 연산 성능 평가 실험을 설계함' },
  ],
  priorityA: [
    { question: 'NPU의 연산 성능을 어떤 지표로 평가했습니까?', evidenceArea: '진로활동 1학년', evidenceQuote: 'NPU 병렬 연산 성능 평가 실험을 설계함', evaluationPoint: '탐구 과정과 판단 근거' },
  ],
  needsExplanation: [
    { topic: '진로 희망의 변화', detail: '1학년 공학에서 2학년 기계공학으로 변화함' },
    { topic: '고교 수준을 상회하는 학술 탐구의 실제 수행 범위', detail: '실제 본인 수행 범위를 명확히 설명할 필요가 있음' },
  ],
  followUpQuestions: [
    { topic: 'NPU 성능 평가 및 하드웨어 탐구' },
  ],
  needStudentVerification: [
    { item: '실제 사용 데이터셋', reason: '제공 자료에서 명칭이 확인되지 않음', howToVerify: '학생부 원문과 본인 실험 기록 확인' },
  ],
};

const out = ctx.normalizeAiJson(fixture);
const fail = [];
const assert = (cond, msg) => { if (!cond) fail.push(msg); };
assert(out.coreRecords[0].area.includes('자율활동'), 'coreRecords area normalization');
assert(out.coreRecords[0].summary.includes('압전소자'), 'coreRecords summary normalization');
assert(out.priorityA[0].evidenceQuote.includes('NPU'), 'question evidence preservation');
assert(out.needsExplanation.length === 1 && out.needsExplanation[0].topic.includes('진로 희망'), 'objective explanation separation');
assert(out.interviewerVerificationPoints.length === 1 && out.interviewerVerificationPoints[0].topic.includes('고교 수준'), 'verification point separation');
assert(out.followUpQuestions[0].questions.length === 3, 'legacy follow-up topic converted to three questions');
assert(out.followUpQuestions[0].questions.every(q => q.includes('?')), 'generated follow-ups are questions');
assert(out.needStudentVerification[0].howToVerify.includes('학생부'), 'student verification method preservation');

if (fail.length) {
  console.error('FAIL');
  fail.forEach(x => console.error('-', x));
  process.exit(1);
}
console.log('v4.4 AI normalization: PASS');
