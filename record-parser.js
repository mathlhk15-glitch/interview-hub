/**
 * record-parser.js
 * - 텍스트형 PDF: 브라우저 안에서 PDF.js(로컬 vendor 파일)로 텍스트만 추출합니다.
 *   서버 전송이 없습니다. assets/vendor/pdfjs/pdf.min.js + pdf.worker.min.js를
 *   프로젝트에 동봉했으므로 CDN 없이 오프라인·GitHub Pages 정적 배포로 동작합니다.
 * - 스캔 PDF(텍스트가 거의 없음): OCR을 시도하지 않고 "이미지형/스캔 PDF로 보입니다"
 *   안내 후 직접 입력·붙여넣기 경로로 즉시 전환합니다. (README '구현하지 않은 기능' 참고)
 * - 표 구조가 깨지는 경우, 학생이 NEIS에서 복사한 텍스트를 붙여넣고 영역을
 *   라디오 버튼으로 직접 지정하는 수동 매핑 인터페이스를 제공합니다.
 * - 추출된 텍스트는 어떤 경우에도 앞부분만 잘라서 쓰지 않습니다(원문 전체 유지).
 */

const PDFJS_READY = (() => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/vendor/pdfjs/pdf.worker.min.js";
    return true;
  }
  return false;
})();

const MIN_TEXT_CHARS_FOR_TEXT_PDF = 200; // 이보다 적으면 스캔/이미지형으로 간주

// PDF.js는 페이지의 텍스트 조각(item)을 낱개로 돌려줍니다. item.transform의
// [4],[5]가 각각 x, y 좌표입니다. 같은 y(±허용오차) 안의 조각들을 한 줄로 묶고,
// x 순서로 정렬해 이어붙이면 "페이지 전체가 한 줄"이 되는 문제를 피할 수 있습니다.
// 완벽한 표(NEIS) 파싱은 아니지만, 항목을 줄 단위로 분리하는 데는 크게 도움이 됩니다.
function groupTextItemsIntoLines(items) {
  const Y_TOLERANCE = 2.5;
  const rows = [];
  items.forEach((it) => {
    if (!it.str || !it.str.trim()) return;
    const x = it.transform ? it.transform[4] : 0;
    const y = it.transform ? it.transform[5] : 0;
    let row = rows.find((r) => Math.abs(r.y - y) <= Y_TOLERANCE);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, str: it.str });
  });
  // PDF 좌표계는 아래에서 위로 증가하므로, y 내림차순 정렬이 "위에서 아래로" 읽는 순서입니다.
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function extractTextFromPdfFile(file) {
  if (!PDFJS_READY) {
    return { ok: false, reason: "PDF.js 라이브러리를 불러오지 못했습니다. assets/vendor/pdfjs 파일을 확인하세요." };
  }
  try {
    const buf = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: buf });
    const pdf = await loadingTask.promise;
    const pageTexts = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const lines = groupTextItemsIntoLines(content.items);
      pageTexts.push(lines.join("\n"));
    }
    const fullText = pageTexts.join("\n\n").trim();
    if (fullText.length < MIN_TEXT_CHARS_FOR_TEXT_PDF) {
      return { ok: false, scanLike: true, reason: "이미지형 또는 스캔 PDF로 보입니다. 텍스트가 거의 추출되지 않았습니다." };
    }
    // 주의: 여기서 절대 텍스트를 자르지 않습니다. 뒤쪽 페이지(세특 등)가 잘려나가면
    // 면접 준비에서 가장 중요한 부분을 놓칠 수 있습니다.
    return { ok: true, text: fullText, pages: pdf.numPages };
  } catch (err) {
    console.error(err);
    return { ok: false, reason: "PDF를 읽는 중 오류가 발생했습니다. (" + (err.message || err) + ") 직접 입력으로 진행하세요." };
  }
}

// 아주 단순한 규칙 기반 자동 영역 추정 — 어디까지나 "초안"이며 학생이 반드시 확인/수정합니다.
function guessSectionForLine(line) {
  const rules = [
    { section: "출결", re: /(결석|지각|조퇴|무단|미인정|출결)/ },
    { section: "자율·자치", re: /(자율활동|자치|학급)/ },
    { section: "동아리", re: /(동아리)/ },
    { section: "봉사", re: /(봉사)/ },
    { section: "진로활동", re: /(진로활동|진로희망)/ },
    { section: "세부능력 및 특기사항", re: /(세특|교과세특|특기사항)/ },
    { section: "행동특성 및 종합의견", re: /(행동특성|종합의견)/ },
    { section: "교과성적", re: /(등급|원점수|성취도)/ },
  ];
  for (const r of rules) if (r.re.test(line)) return r.section;
  return null;
}

// 붙여넣은 텍스트(전체)를 줄 단위로 쪼개 "초안 기록"으로 변환합니다.
// 인자로 받은 text는 절대 앱 내부에서 잘라서 넘기지 않습니다 — 호출부에서 항상
// 화면에 보이는 textarea의 "전체" 값(=AppState.recordRawText와 동일)을 넘겨야 합니다.
function draftRecordsFromText(text, forcedSection) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 6);
  return lines.map((line) => ({
    id: uid("rec"),
    section: forcedSection || guessSectionForLine(line) || "미지정 (직접 선택 필요)",
    text: line,
    tags: [], // ◎ ■ ▲ ✕ 여러 개를 동시에 지정할 수 있습니다 (학생이 record-map에서 확인)
    tagsInitialized: false,
    source: "학생부/붙여넣기",
  }));
}
