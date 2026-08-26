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

function load(file){
  const el = window.document.createElement('script');
  el.textContent = fs.readFileSync(path.join(root,file),'utf8');
  window.document.body.appendChild(el);
}
['config.js','data.js','app.js','record-parser.js','question-engine.js','prompt-generator.js','ai-result-parser.js','trainer.js','print.js','export.js','screens.js','screens2.js'].forEach(load);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

let failed = 0;
function check(cond, msg){ if(!cond){ console.error('FAIL:',msg); failed++; } else console.log('PASS:',msg); }

const routes = ['home','student-dashboard','record-import','no-record-input','analysis-results','questions','trainer','print-sheet','record-map','universities','type-helper','roadmap','ai-coach','parent-mode','interview-log'];
for(const route of routes){
  try{
    window.location.hash = '#/' + route;
    window.renderRoute();
    check(window.document.getElementById('view').textContent.trim().length > 0, `route ${route} renders`);
  }catch(e){ console.error('ERROR route', route, e); failed++; }
}

// v4 기본 시작 화면: 체크박스 지도가 아니라 PDF 바로 시작이 먼저 보여야 함
window.location.hash = '#/student-dashboard'; window.renderRoute();
check(window.document.body.textContent.includes('생활기록부 PDF를 넣으면 바로 면접문항을 만듭니다'), 'simple student start message');
check(window.document.querySelector('#quick-pdf-btn'), 'quick PDF button exists');
check(window.document.querySelector('#quick-no-record-btn'), 'no-record button exists');
check(!window.document.querySelector('.step-list'), '13-step list is not exposed on default student screen');

// 5단계 메인 흐름 정의 확인
const flow = window.eval('FLOW_STEPS.map(x => x.route)');
check(JSON.stringify(flow) === JSON.stringify(['student-dashboard','analysis-results','questions','trainer','print-sheet']), 'five-step main flow');

// 샘플 기록 자동분석 -> 결과 화면
window.eval(`
AppState.records = [
 {id:'r1',section:'세부능력 및 특기사항',text:'사회문화 수업에서 미디어 이용 격차 자료를 조사하고 통계 자료를 비교 분석하여 발표함.',tags:[],tagsInitialized:false,source:'학생부/붙여넣기'},
 {id:'r2',section:'세부능력 및 특기사항',text:'확률과 통계에서 표본 대표성을 검토하고 자료 해석의 한계를 찾아 보고서를 수정함.',tags:[],tagsInitialized:false,source:'학생부/붙여넣기'},
 {id:'r3',section:'진로활동',text:'미디어커뮤니케이션 분야에 관심을 가지고 뉴스 프레이밍 사례를 조사하여 발표함.',tags:[],tagsInitialized:false,source:'학생부/붙여넣기'},
 {id:'r4',section:'동아리',text:'미디어 동아리에서 역할을 나누어 영상 기획과 인터뷰 질문 제작을 맡음.',tags:[],tagsInitialized:false,source:'학생부/붙여넣기'}
];
runAutomaticInterviewAnalysis();
`);
window.location.hash = '#/analysis-results'; window.renderRoute();
check(window.document.body.textContent.includes('자동 분석 완료'), 'analysis result renders');
check(window.document.body.textContent.includes('반드시 준비할 질문'), 'priority A section renders');
check(window.document.querySelectorAll('.result-question').length > 0, 'question cards render');

console.log(`\nSmoke test finished. failed=${failed}`);
process.exitCode = failed ? 1 : 0;
