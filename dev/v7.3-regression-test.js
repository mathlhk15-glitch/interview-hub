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
const printjs = fs.readFileSync('print.js','utf8');
const trainer = fs.readFileSync('trainer.js','utf8');

ok('version is v7.3', /7\.3-rag-lite/.test(config));
ok('cache bust is v7.3', /style\.css\?v=7\.3/.test(index) && /screens2\.js\?v=7\.3/.test(index));
ok('new product name', /대입 면접 셀프 트레이너/.test(index));
ok('readiness route exists', /registerRoute\("readiness"/.test(screens2));
ok('university DB picker exists', /openUniDbPicker/.test(screens));
ok('activity focused training exists', /이 활동 연속훈련/.test(screens2));
ok('45/90 second training exists', /start45/.test(screens2) && /start90/.test(screens2));
ok('3 second conclusion sprint exists', /sprint-btn/.test(screens2) && /결론 정리 3초/.test(screens2));
ok('easy concept drill exists', /easy-concept-btn/.test(screens2) && /20초 쉬운 말 설명/.test(screens2));
ok('answer finish exists', /id="finish-answer"/.test(screens2) && /completePhase\(\)/.test(trainer));
ok('actual answer seconds are saved', /markQuestionPractice\(current\.id, actualSeconds, practiceKind,/.test(screens2));
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
ok('parser keeps reverse map', /normalizeReverseMap/.test(parser) && /sourceOwnership/.test(parser));
ok('prompt asks source ownership verification', /sourceOwnership/.test(prompt) && /출처를 왜 신뢰/.test(prompt));
ok('backup schema v8', /BACKUP_SCHEMA_VERSION = 8/.test(exp));
ok('preparation notes export is selectable', /includePreparationNotes/.test(exp) && /id="opt-notes"/.test(screens2));
ok('import resets existing session', /resetPreparationStateForImport/.test(exp) && /importStateFromJson\(text, \{ reset:true \}\)/.test(screens2));
ok('save-loss banner exists', /자동 저장되지 않습니다/.test(screens));
ok('beforeunload warns without clearing raw data', /beforeunload[\s\S]*hasVolatilePreparationData/.test(app) && !/beforeunload[\s\S]{0,300}recordRawText\s*=\s*""/.test(app));
ok('practice stats exist', /practiceStats/.test(app));
ok('question file save button exists', /save-questions-file-btn/.test(screens2) && /exportQuestionsAsText/.test(screens2));
ok('question file export builds grouped text', /buildQuestionsTextContent/.test(exp) && /redactCommonPii\(String\(q\.evidenceText\)\)/.test(exp));
ok('print sheet links to full question file save', /질문지 전체 인쇄\] 또는 \[질문지 파일로 저장\]/.test(screens2));
ok('print all questions button exists', /print-questions-btn/.test(screens2) && /openQuestionsPrintView/.test(screens2));
ok('print all questions has no 90-char truncation', /QUESTIONS_PRINT_EVIDENCE_LIMIT = 200/.test(printjs) && !/buildQuestionsPrintHtml[\s\S]*?PRINT_LIMITS\.question/.test(printjs));
ok('print all questions warns if empty', /인쇄할 질문이 없습니다/.test(printjs));

const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync('data.js','utf8'), ctx);
const d = ctx.window.APP_DATA;
ok('seven direction map has 7', Array.isArray(d.sevenDirections) && d.sevenDirections.length === 7);
ok('activity answer frame exists', !!d.answerFrames.activity);
ok('activity optional expansion tip exists', !!d.answerFrames.activity.optionalTip);
ok('followup stages include condition variation', Array.isArray(d.followUpLayers) && d.followUpLayers.length === 3 && /조건변형/.test(d.followUpLayers[2].label));
ok('reverse engineering fields exist', Array.isArray(d.reverseEngineeringFields) && d.reverseEngineeringFields.length === 4);
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

// 질문지 파일 저장: 우선순위별로 묶이고, 근거문장 속 개인정보 후보는 가려져야 함.
exportCtx.getActiveUniversity = () => ({ name: '테스트대학교', major: '테스트학과', track: '테스트전형' });
const questionState = {
  questions: [
    { priority: 'A', directionLabel: '개념', text: 'A급 질문', hint: '힌트A', evidenceText: '010-1234-5678로 연락한 경험', evidenceSection: '동아리', followUps: [{ label: '1층', prompt: '', done: true, note: '메모1' }] },
    { priority: 'B', directionLabel: '과정', text: 'B급 질문' },
  ],
};
const qFileText = exportCtx.buildQuestionsTextContent(questionState);
ok('question file groups by priority', /A · 반드시 준비/.test(qFileText) && /B · 준비 권장/.test(qFileText));
ok('question file includes university info', /테스트대학교/.test(qFileText));
ok('question file redacts phone numbers in evidence', !/010-1234-5678/.test(qFileText) && /\[전화번호 삭제\]/.test(qFileText));
ok('question file keeps followup notes', /메모1/.test(qFileText));

// 질문지 전체 인쇄: 90자 제한 없이, 우선순위별로 나뉘고 개인정보는 가려져야 함.
const printCtx = {
  console,
  window: { addEventListener(){}, },
  document: { getElementById(){ return { innerHTML: '' }; }, body: { classList: { add(){}, remove(){} } }, documentElement: { dataset: {} }, addEventListener(){} },
  localStorage: { getItem(){return null;}, setItem(){} },
  Blob: function(){}, URL: { createObjectURL(){return 'blob:x';}, revokeObjectURL(){} }, setTimeout,
};
vm.createContext(printCtx);
vm.runInContext(app, printCtx);
vm.runInContext(exp, printCtx);
vm.runInContext(printjs, printCtx);
vm.runInContext(`AppState.universities.push({ id: 'u1', name: '테스트대학교', major: '테스트학과', track: '테스트전형' }); AppState.activeUniversityId = 'u1';`, printCtx);
const longEvidence = '가'.repeat(250);
const printState = {
  questions: [
    { priority: 'A', directionLabel: '개념', text: 'A급 인쇄 질문', evidenceText: `010-9999-8888 ${longEvidence}`, evidenceSection: '세특' },
    { priority: 'C', directionLabel: '확장', text: 'C급 인쇄 질문' },
  ],
};
const printHtml = printCtx.buildQuestionsPrintHtml(printState);
ok('print all questions groups by priority', /A · 반드시 준비/.test(printHtml) && /C · 여유가 있으면/.test(printHtml) && !/B · 준비 권장/.test(printHtml));
ok('print all questions includes university info', /테스트대학교/.test(printHtml));
ok('print all questions redacts phone numbers', !/010-9999-8888/.test(printHtml) && /\[전화번호 삭제\]/.test(printHtml));
ok('print all questions truncates only very long evidence, not the question itself', printHtml.includes('A급 인쇄 질문') && !printHtml.includes(longEvidence));


ok('RAG data is not eager loaded', !/src="rag-data\.js/.test(index));
ok('RAG lazy loader exists', /ensureRagDataLoaded/.test(fs.readFileSync('rag-engine.js','utf8')));
ok('RAG quality gate exists', /qualityAllowed/.test(fs.readFileSync('rag-engine.js','utf8')));
ok('nursing is not forced to MMI', !/special === ['"]nursing['"]/.test(fs.readFileSync('rag-engine.js','utf8')));
ok('STT is opt-in', /id="stt-enabled" type="checkbox">/.test(screens2));
ok('transcript backup is opt-in', /includeTranscripts/.test(exp) && /id="opt-transcripts"/.test(screens2));
ok('evidence uses sliding window', /bestEvidenceWindowSimilarity/.test(parser));


const rag = fs.readFileSync('rag-engine.js','utf8');
const trainer2 = fs.readFileSync('trainer.js','utf8');
ok('RAG feedback setter exists', /function setRagFeedback/.test(rag) && /feedbackFor/.test(rag));
ok('RAG down feedback excludes rows', /feedback === 'down'/.test(rag));
ok('RAG diversity rerank exists', /termOverlap/.test(rag) && /adjustedScore/.test(rag));
ok('RAG match reasons exposed', /matchReasons/.test(rag));
ok('iPad desktop UA detection exists', /MacIntel/.test(trainer2) && /maxTouchPoints/.test(trainer2));
ok('backup schema is 8', /BACKUP_SCHEMA_VERSION = 8/.test(exp));
ok('RAG feedback export\/import exists', /ragFeedback/.test(exp));
ok('RAG feedback UI exists', /data-vote=\"up\"/.test(screens2) && /data-vote=\"down\"/.test(screens2));
console.log(`v7.3 self trainer test finished. fail=${fail}`);
process.exitCode = fail ? 1 : 0;
