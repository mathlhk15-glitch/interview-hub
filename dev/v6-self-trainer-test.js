const fs = require('fs');
const vm = require('vm');
let fail = 0;
function ok(name, cond) { if (cond) console.log('PASS:', name); else { console.error('FAIL:', name); fail++; } }

const config = fs.readFileSync('config.js','utf8');
const index = fs.readFileSync('index.html','utf8');
const app = fs.readFileSync('app.js','utf8');
const screens = fs.readFileSync('screens.js','utf8');
const screens2 = fs.readFileSync('screens2.js','utf8');
const prompt = fs.readFileSync('prompt-generator.js','utf8');
const parser = fs.readFileSync('ai-result-parser.js','utf8');
const exp = fs.readFileSync('export.js','utf8');
const trainer = fs.readFileSync('trainer.js','utf8');

ok('version is v6.1 reviewed', /6\.1-reviewed-self-interview-trainer/.test(config));
ok('cache bust is v6.1', /style\.css\?v=6\.1/.test(index) && /screens2\.js\?v=6\.1/.test(index));
ok('new product name', /대입 면접 셀프 트레이너/.test(index));
ok('readiness route exists', /registerRoute\("readiness"/.test(screens2));
ok('university DB picker exists', /openUniDbPicker/.test(screens));
ok('activity focused training exists', /이 활동 연속훈련/.test(screens2));
ok('90 second training exists', /start90/.test(screens2));
ok('answer finish exists', /id="finish-answer"/.test(screens2) && /completePhase\(\)/.test(trainer));
ok('actual answer seconds are saved', /markQuestionPractice\(current\.id, actualSeconds\)/.test(screens2));
ok('route cleanup exists', /setRouteCleanup/.test(app) && /runRouteCleanup/.test(app));
ok('trainer route cleanup stops media', /setRouteCleanup\(\(\) => \{[\s\S]*?trainer\) trainer\.cancel\(\)/.test(screens2));
ok('prompt timer cleanup exists', /modeCleanup=\(\)=>\{ if\(iv\)\{clearInterval\(iv\)/.test(screens2));
ok('crisis helper keeps timer running', /실제 면접처럼 타이머는 멈추지 않습니다/.test(screens2));
ok('MMI followup pattern UI exists', /압박·꼬리질문 패턴/.test(screens2));
ok('MMI requires first answer before completion', /첫 답변을 한 번 완료한 뒤 방 완료/.test(screens2));
ok('privacy review gate exists', /privacy-reviewed/.test(screens2));
ok('auto PII mask exists', /개인정보 후보 자동 가리기/.test(screens2) && /maskPiiCandidates/.test(app));
ok('PII is rechecked before preview', /const remain = findPiiCandidates\(ta\.value\)/.test(screens2));
ok('AI schema has question depth', /"depth": "motive"/.test(prompt));
ok('AI schema has recommendedFrame', /recommendedFrame/.test(prompt));
ok('parser keeps source connections', /sourceConnections/.test(parser));
ok('backup schema v5', /BACKUP_SCHEMA_VERSION = 5/.test(exp));
ok('preparation notes export is selectable', /includePreparationNotes/.test(exp) && /id="opt-notes"/.test(screens2));
ok('import resets existing session', /resetPreparationStateForImport/.test(exp) && /importStateFromJson\(text, \{ reset:true \}\)/.test(screens2));
ok('save-loss banner exists', /자동 저장되지 않습니다/.test(screens));
ok('beforeunload warns without clearing raw data', /beforeunload[\s\S]*hasVolatilePreparationData/.test(app) && !/beforeunload[\s\S]{0,300}recordRawText\s*=\s*""/.test(app));
ok('practice stats exist', /practiceStats/.test(app));

const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync('data.js','utf8'), ctx);
const d = ctx.window.APP_DATA;
ok('seven direction map has 7', Array.isArray(d.sevenDirections) && d.sevenDirections.length === 7);
ok('activity answer frame exists', !!d.answerFrames.activity);
ok('concept answer frame exists', !!d.answerFrames.concept);
ok('mmi answer frame exists', !!d.answerFrames.mmi);
ok('MMI patterns are 6', Array.isArray(d.mmiFollowUpPatterns) && d.mmiFollowUpPatterns.length === 6);
ok('starter university DB >= 10', Array.isArray(d.universityDb) && d.universityDb.length >= 10);
ok('verified blind entries exist', ['경상국립대학교','숭실대학교','부산대학교','아주대학교','서울과학기술대학교'].every((name) => d.universityDb.find((x) => x.name === name)?.blind === '시행'));
ok('Gachon regional blind remains unverified', d.universityDb.find((x) => x.name === '가천대학교')?.blind === '미확인');
ok('Gyeongsang selection multiple fixed', /3배수/.test(d.universityDb.find((x) => x.name === '경상국립대학교')?.ratio || ''));
ok('Soongsil selection multiple fixed', /3~3\.5배수/.test(d.universityDb.find((x) => x.name === '숭실대학교')?.ratio || ''));
ok('mock evaluation has safety', Array.isArray(d.mockEvalItems['안전']));

// Export payload behavior: hidden notes must really be excluded when unchecked.
const exportCtx = {
  console,
  AppState: {},
  Blob: function(){},
  URL: { createObjectURL(){return 'blob:x';}, revokeObjectURL(){} },
  document: { createElement(){ return { click(){}, remove(){}, style:{} }; }, body:{ appendChild(){} } },
  setTimeout,
};
vm.createContext(exportCtx);
vm.runInContext(exp, exportCtx);
const sampleState = {
  universities: [], activeUniversityId: null, records: [], activities: [], questions: [], interviewLogs: [], weaknessEntries: [],
  commonAnswers: { motive:'secret' }, mockEvaluation:{checks:{x:true},good:'g',fix:'f'}, aiVerificationNotes:['n'], practiceStats:{q:{attempts:1}}, mmiPracticeCount:1,
  introKeywords:'intro', lastWord:'last', motiveMoment:'m', motiveActions:['a'], majorCourses:'c', majorSourceLog:'s', favoriteCourseWhy:'f', afterAdmission:'a', motiveOneLine:'o'
};
const payloadNoNotes = exportCtx.buildExportPayload(sampleState, { includePreparationNotes:false });
ok('unchecked preparation notes are excluded from JSON', payloadNoNotes.commonAnswers === undefined && payloadNoNotes.practiceStats === undefined && payloadNoNotes.motivation === undefined);

console.log(`v6.1 self trainer test finished. fail=${fail}`);
process.exitCode = fail ? 1 : 0;
