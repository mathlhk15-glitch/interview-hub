/**
 * rag-engine.js - Interview Hub v7.5 RAG-lite
 * No API / no backend / no vector DB. Browser-only lexical + metadata retrieval.
 * rag-data.js is lazy-loaded only when retrieval is actually requested.
 */
(function () {
  const STOP = new Set([
    '그리고','그러나','때문','대한','대해','관련','학생','지원자','자신','본인','생각','설명','무엇','어떻게','왜','있나요','있습니까','주세요','말해','면접','질문','활동','경우','통해','위해','학년','학생부','기록','지원','대학','학과','전형'
  ]);
  let ragLoadPromise = null;

  function ensureRagDataLoaded() {
    if (window.INTERVIEW_RAG_DATA?.questions?.length) return Promise.resolve(window.INTERVIEW_RAG_DATA);
    if (ragLoadPromise) return ragLoadPromise;
    ragLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'rag-data.js?v=7.5';
      script.async = true;
      script.onload = () => window.INTERVIEW_RAG_DATA?.questions?.length
        ? resolve(window.INTERVIEW_RAG_DATA)
        : reject(new Error('RAG 데이터 형식을 확인할 수 없습니다.'));
      script.onerror = () => reject(new Error('RAG 면접자료를 불러오지 못했습니다. 네트워크/파일 위치를 확인하세요.'));
      document.head.appendChild(script);
    }).catch((err) => { ragLoadPromise = null; throw err; });
    return ragLoadPromise;
  }

  function normalizeText(s) {
    return String(s || '').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function tokens(s) {
    const arr = normalizeText(s).match(/[가-힣]{2,}|[a-z]{3,}|\d+(?:\.\d+)?/g) || [];
    return arr.filter((x) => !STOP.has(x));
  }
  function keyTerms(s, max = 90) {
    const freq = new Map();
    tokens(s).forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));
    return [...freq.entries()]
      .sort((a,b) => (b[1] * Math.min(8,b[0].length)) - (a[1] * Math.min(8,a[0].length)))
      .slice(0,max).map(([t]) => t);
  }
  function inferWantedCategories(text) {
    const t = String(text || ''); const cats = new Set();
    if (/탐구|실험|조사|분석|방법|과정/.test(t)) cats.add('process');
    if (/개념|원리|이론|정의|법칙|함수|알고리즘/.test(t)) cats.add('concept');
    if (/동기|계기|관심|선택/.test(t)) cats.add('motive');
    if (/역할|협력|팀|리더|공동체|갈등|봉사/.test(t)) { cats.add('role'); cats.add('community'); }
    if (/한계|아쉬|보완|개선|오류|실패/.test(t)) cats.add('limit');
    if (/진로|전공|입학 후|확장/.test(t)) cats.add('extend');
    return cats;
  }
  function desiredSourceType(university) {
    const type = String((typeof effectiveInterviewType === 'function' ? effectiveInterviewType(university) : university?.typeGuessOverride || university?.typeGuess) || '').toLowerCase();
    if (/mmi|다중/.test(type)) return 'mmi';
    if (/제시문|prompt/.test(type)) return 'prompt';
    return 'doc';
  }
  function questionLooksBroken(row) {
    const q = String(row?.question || '').trim();
    if (q.length < 15) return true;
    if (/^(?:및\s|들어서|라 생각|세요[?？]?|었나요[?？]?|고 있습니다|있습니다|합니다\.|하는데|해소할|활용했다고|이유와 함께|기 위해|생각한 이유는)/.test(q)) return true;
    if (/답변\s*[☞:]|이 질문과 답변은|설명해주세요\.\s*설명해주세요/.test(q)) return true;
    if (/(?:되었|생각하|한다고|그리고|골라|자료|위해|대한)\s*$/.test(q)) return true;
    return false;
  }
  function qualityAllowed(row, allowUsable) {
    if (questionLooksBroken(row)) return false;
    const q = String(row?.quality || '');
    return q === 'verified' || (allowUsable === true && q === 'usable');
  }
  function feedbackFor(rowId) {
    const fb = (typeof AppState !== 'undefined' && AppState.ragFeedback) ? AppState.ragFeedback[rowId] : null;
    return fb === 'up' || fb === 'down' ? fb : null;
  }
  function setRagFeedback(rowId, value) {
    if (typeof AppState === 'undefined' || !rowId) return;
    AppState.ragFeedback = AppState.ragFeedback || {};
    if (value === 'up' || value === 'down') AppState.ragFeedback[rowId] = value;
    else delete AppState.ragFeedback[rowId];
  }
  function termOverlap(a, b) {
    const A = new Set(tokens(a)), B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    let hit = 0; A.forEach((x) => { if (B.has(x)) hit += 1; });
    return hit / Math.max(1, Math.min(A.size, B.size));
  }
  function scoreRow(row, querySet, queryNorm, wantedCats, sourcePref, university, allowUsable) {
    if (!qualityAllowed(row, allowUsable)) return { score:0, matchedTerms:[], reasons:[] };
    const feedback = feedbackFor(row.id);
    if (feedback === 'down') return { score:0, matchedTerms:[], reasons:['교사 제외'] };
    let score = row.quality === 'verified' ? 1.2 : 0.4;
    let contentScore = 0; const matched = new Set(), reasons = [];
    if (row.quality === 'verified') reasons.push('검증 문항');
    const kws = Array.isArray(row.keywords) ? row.keywords : [];
    let exactKw = 0, partialKw = 0;
    kws.forEach((k) => {
      const kk = normalizeText(k); if (!kk) return;
      if (querySet.has(kk)) { const add = 4 + Math.min(4, kk.length / 2); score += add; contentScore += add; matched.add(kk); exactKw += 1; }
      else for (const q of querySet) if (q.length >= 3 && kk.length >= 3 && (q.includes(kk) || kk.includes(q))) { score += 1.2; contentScore += 1.2; matched.add(q); partialKw += 1; break; }
    });
    if (exactKw) reasons.push(`핵심어 정확일치 ${exactKw}`);
    else if (partialKw) reasons.push(`핵심어 부분일치 ${partialKw}`);
    const catHits = (row.categories || []).filter((c) => wantedCats.has(c));
    if (catHits.length) { score += 1.7 * catHits.length; reasons.push(`질문유형 ${catHits.slice(0,2).join('/')}`); }
    if (sourcePref === 'doc' && row.sourceType === 'doc_based') { score += 2.5; reasons.push('서류기반 자료'); }
    if (sourcePref === 'mmi' && row.sourceType === 'mmi_medical') { score += 5; reasons.push('MMI 자료'); }
    if (sourcePref === 'prompt' && /^prompt_|mixed/.test(row.sourceType || '')) { score += 4; reasons.push('제시문 자료'); }
    const uniName = normalizeText(university?.name || '');
    const major = normalizeText(university?.major || '');
    const hayQuestion = normalizeText(row.question || '');
    const hayContext = normalizeText(row.context || '');
    if (contentScore >= 5 && uniName && (hayQuestion.includes(uniName) || hayContext.includes(uniName))) { score += 1.5; reasons.push('대학명 맥락'); }
    if (major && hayQuestion.includes(major)) { score += 4.5; contentScore += 2.5; matched.add(major); reasons.push('학과명 질문 직접일치'); }
    else if (major && contentScore >= 4 && hayContext.includes(major)) { score += 1.2; reasons.push('학과명 주변맥락'); }
    let directHits = 0;
    for (const q of querySet) if (q.length >= 3 && hayQuestion.includes(q)) { score += 1.0; contentScore += 1.0; matched.add(q); directHits += 1; }
    if (directHits >= 2) reasons.push(`질문본문 일치 ${directHits}`);
    if (feedback === 'up') { score += 2.0; reasons.push('교사 유용 표시'); }
    if (contentScore < 3 && queryNorm.length > 10) return { score:0, matchedTerms:[], reasons:[] };
    return { score, matchedTerms:[...matched].slice(0,8), reasons:reasons.slice(0,5), contentScore };
  }

  function retrieveInterviewKnowledge({ university, studentText, limit = 8 } = {}) {
    const data = window.INTERVIEW_RAG_DATA?.questions || [];
    if (!data.length) return [];
    const lexicalQuery = [university?.major, studentText].filter(Boolean).join(' ');
    const categoryQuery = [studentText, university?.evalWeights].filter(Boolean).join(' ');
    const terms = keyTerms(lexicalQuery, 100), querySet = new Set(terms);
    const wantedCats = inferWantedCategories(categoryQuery), sourcePref = desiredSourceType(university || {}), queryNorm = normalizeText(lexicalQuery);
    const scored = [];
    const scorePass = (allowUsable) => {
      for (const row of data) {
        if (scored.some((x) => x.id === row.id)) continue;
        const result = scoreRow(row, querySet, queryNorm, wantedCats, sourcePref, university || {}, allowUsable);
        if (result.score > 0) scored.push({ ...row, score:Number(result.score.toFixed(2)), matchedTerms:result.matchedTerms, matchReasons:result.reasons || [] });
      }
    };
    scorePass(false); // verified first
    if (scored.length < Math.max(limit * 2, 12)) scorePass(true); // usable is fallback only
    scored.sort((a,b) => b.score - a.score || a.id.localeCompare(b.id));
    const picked = [], sourceCaps = new Map();
    const candidates = scored.slice(0, Math.max(80, limit * 12));
    while (picked.length < limit && candidates.length) {
      let bestIdx = -1, bestAdjusted = -Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const row = candidates[i];
        const cap = sourceCaps.get(row.sourceId) || 0; if (cap >= 3) continue;
        if (picked.some((x) => normalizeText(x.question) === normalizeText(row.question))) continue;
        const redundancy = picked.length ? Math.max(...picked.map((x) => termOverlap(x.question, row.question))) : 0;
        const adjusted = row.score - (redundancy >= 0.72 ? 4 : redundancy >= 0.5 ? 2 : redundancy >= 0.35 ? 0.8 : 0);
        if (adjusted > bestAdjusted) { bestAdjusted = adjusted; bestIdx = i; }
      }
      if (bestIdx < 0) break;
      const row = candidates.splice(bestIdx, 1)[0];
      picked.push({ ...row, adjustedScore:Number(bestAdjusted.toFixed(2)) });
      sourceCaps.set(row.sourceId, (sourceCaps.get(row.sourceId) || 0) + 1);
    }
    return picked;
  }

  function buildRagPromptContext({ university, studentText, limit = 8 } = {}) {
    const rows = retrieveInterviewKnowledge({ university, studentText, limit });
    if (!rows.length) return '';
    const lines = rows.map((r,i) => `${i+1}. [${r.categories?.join('/') || 'general'}] ${r.question}\n   출처: ${r.sourceTitle}, p.${r.page}`);
    return `\n\n## RAG-lite 검색 참고자료\n아래 문항은 제공된 교육청 면접자료에서 현재 학생 자료·지원정보와 관련성이 높은 질문 패턴을 브라우저에서 검색한 결과입니다.\n- 그대로 복사하지 말고, 학생부의 실제 근거와 지원 대학 평가요소에 맞게 질문의 깊이·표현만 참고하세요.\n- 아래 자료를 현재 지원 대학의 최신 공식 기출이라고 단정하지 마세요.\n- 학생부에 근거가 없는 질문은 만들지 마세요.\n\n${lines.join('\n')}`;
  }

  window.ensureRagDataLoaded = ensureRagDataLoaded;
  window.retrieveInterviewKnowledge = retrieveInterviewKnowledge;
  window.setRagFeedback = setRagFeedback;
  window.buildRagPromptContext = buildRagPromptContext;
})();
