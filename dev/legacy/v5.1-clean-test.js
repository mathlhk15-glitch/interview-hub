const fs = require('fs');
function read(f){ return fs.readFileSync(f,'utf8'); }
let fail = 0;
function ok(c,m){ if(c) console.log('PASS:',m); else { console.error('FAIL:',m); fail++; } }
const app = read('app.js');
const screens = read('screens.js');
const screens2 = read('screens2.js');
const index = read('index.html');
const config = read('config.js');
ok(config.includes('5.1-ai-first-clean'), 'version is 5.1-ai-first-clean');
ok(index.includes('?v=5.1'), 'cache bust is v5.1');
ok(app.includes('LEGACY_ROUTE_REDIRECTS'), 'legacy redirect map exists');
ok(app.includes('"analysis-results"'), 'analysis-results is redirected');
ok(app.includes('"questions"'), 'questions is redirected');
ok(app.includes('"record-map"'), 'record-map is redirected');
ok(!screens.includes('로컬 간단 분석(참고)'), 'student dashboard has no local analysis entry');
ok(!screens.includes('AI 없이 쓰는 보조 도구'), 'student dashboard has no old local-tool section');
ok(screens.includes('면접문항 생성은 AI 전체분석이 담당합니다.'), 'dashboard states AI is the analysis engine');
ok(screens2.includes('AI에 보낼 원문 확인·개인정보 제거'), 'AI wizard includes editable raw-text review');
ok(screens2.includes('PDF 추출이 어색한 부분은 여기서 바로 고치고'), 'raw-text correction guidance exists');
console.log(`v5.1 clean test finished. fail=${fail}`);
process.exitCode = fail ? 1 : 0;
