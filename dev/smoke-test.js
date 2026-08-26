const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>\s*/g, '');
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => console.error('JSDOM ERROR:', e.message));
const dom = new JSDOM(html, {url:'http://localhost/index.html', runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc});
const { window } = dom;
window.navigator.clipboard = { writeText: async () => {} };
window.scrollTo = () => {};
function load(file){ const el = window.document.createElement('script'); el.textContent = fs.readFileSync(path.join(root,file),'utf8'); window.document.body.appendChild(el); }
['config.js','data.js','app.js','record-parser.js','question-engine.js','prompt-generator.js','ai-result-parser.js','trainer.js','print.js','export.js','screens.js','screens2.js'].forEach(load);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
let failed = 0;
function check(cond, msg){ if(!cond){ console.error('FAIL:',msg); failed++; } else console.log('PASS:',msg); }

const routes = ['home','student-dashboard','record-import','no-record-input','analysis-results','questions','trainer','print-sheet','record-map','universities','type-helper','roadmap','ai-coach','ai-results','parent-mode','interview-log'];
for(const route of routes){
  try{ window.location.hash = '#/' + route; window.renderRoute(); check(window.document.getElementById('view').textContent.trim().length > 0, `route ${route} renders`); }
  catch(e){ console.error('ERROR route', route, e); failed++; }
}

window.location.hash = '#/student-dashboard'; window.renderRoute();
check(window.document.body.textContent.includes('AI가 전체 활동을 빠짐없이 훑게 하세요'), 'AI-first start message');
check(window.document.querySelector('#quick-pdf-btn'), 'quick PDF button exists');
check(window.document.querySelector('#quick-no-record-btn'), 'no-record button exists');
const flow = window.eval('FLOW_STEPS.map(x => x.route)');
check(JSON.stringify(flow) === JSON.stringify(['student-dashboard','ai-coach','trainer','print-sheet']), 'AI-first main flow');

window.eval(`
AppState.recordRawText = '1학년 진로활동 NPU 탐구\\n2학년 동아리 압전소자 실험';
AppState.records = [{id:'r1',section:'진로활동',text:'NPU 탐구',tags:[],tagsInitialized:false,source:'학생부/붙여넣기'}];
`);
window.location.hash = '#/student-dashboard'; window.renderRoute();
check(window.document.body.textContent.includes('생활기록부 전체 면접문항 AI 분석'), 'full AI analysis entry visible');

window.location.hash = '#/ai-coach?mode=record-full'; window.renderRoute();
check(window.document.body.textContent.includes('전체 생활기록부'), 'record-full wizard renders');

console.log(`\nSmoke test finished. failed=${failed}`);
process.exitCode = failed ? 1 : 0;
