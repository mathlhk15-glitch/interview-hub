/**
 * screens2.js (2/2)
 */

// ── 생활기록부 빠른 분석 — PDF를 넣으면 자동으로 결과까지 이동 ─────────
registerRoute("record-import", () => {
  const body = el(`<div class="stack">
    <div class="privacy-strip"><strong>개인정보 보호</strong><span>PDF는 서버에 저장하거나 자동 전송하지 않고, 현재 브라우저에서만 읽습니다.</span></div>
    <label class="field file-drop quick-drop" id="drop-zone">
      <span class="drop-icon">PDF</span>
      <strong>생활기록부 PDF를 선택하세요</strong>
      <span class="muted small">또는 이곳에 파일을 끌어다 놓으세요</span>
      <input type="file" accept="application/pdf" id="pdf-input">
    </label>
    <div id="pdf-status" class="analysis-status muted">파일을 넣으면 자동으로 핵심 기록과 예상질문을 생성합니다.</div>
    <button class="btn-ghost" onclick="navigate('no-record-input')">생활기록부 없이 시작</button>
    <details class="optional-panel">
      <summary>PDF 추출이 잘 안 될 때 직접 붙여넣기</summary>
      <div class="stack optional-panel-body">
        <p class="muted small">NEIS 또는 PDF에서 복사한 텍스트를 붙여넣으면 전체 내용을 사용해 분석합니다.</p>
        <textarea id="paste-text" rows="9" placeholder="생활기록부 텍스트를 붙여넣으세요"></textarea>
        <p id="char-count" class="muted small"></p>
        <button class="btn-secondary" id="use-paste-btn">붙여넣은 내용 분석하기</button>
      </div>
    </details>
  </div>`);

  const input = body.querySelector("#pdf-input");
  const status = body.querySelector("#pdf-status");
  const pasteArea = body.querySelector("#paste-text");
  const charCount = body.querySelector("#char-count");
  pasteArea.oninput = () => { charCount.textContent = `${pasteArea.value.length.toLocaleString()}자`; };

  function replaceImportedRecords(drafts, rawText) {
    const oldImportedIds = new Set(AppState.records.filter((r) => r.source === "학생부/붙여넣기").map((r) => r.id));
    AppState.records = AppState.records.filter((r) => !oldImportedIds.has(r.id));
    AppState.questions = AppState.questions.filter((q) => !oldImportedIds.has(q.recordId));
    AppState.activities = AppState.activities.filter((a) => !oldImportedIds.has(a.recordId));
    AppState.recordRawText = rawText || "";
    AppState.records.push(...drafts);
  }

  async function analyzePdf(file) {
    if (!file) return;
    status.innerHTML = `<div class="loading-line"><span class="spinner"></span><span>생활기록부에서 텍스트를 읽고 있습니다…</span></div>`;
    const result = await extractTextFromPdfFile(file);
    if (!result.ok) {
      status.innerHTML = `<span class="error-text">${escapeHtml(result.reason)}</span>`;
      if (result.scanLike) status.innerHTML += `<p class="muted small">스캔 PDF는 자동 OCR하지 않습니다. 아래 '직접 붙여넣기' 또는 '생활기록부 없이 시작'을 이용하세요.</p>`;
      return;
    }
    status.innerHTML = `<div class="loading-line"><span class="spinner"></span><span>${result.pages}페이지를 읽었습니다. 면접 가능성이 높은 기록을 선별하고 있습니다…</span></div>`;
    const drafts = draftRecordsFromText(result.text, null);
    if (!drafts.length) { status.innerHTML = `<span class="error-text">분석할 기록을 찾지 못했습니다. 직접 붙여넣기를 이용해 주세요.</span>`; return; }
    replaceImportedRecords(drafts, result.text);
    runAutomaticInterviewAnalysis();
    status.innerHTML = `<span class="ok-text">분석 완료. 결과 화면으로 이동합니다.</span>`;
    setTimeout(() => navigate("analysis-results"), 250);
  }

  input.onchange = () => analyzePdf(input.files && input.files[0]);

  const dropZone = body.querySelector("#drop-zone");
  ["dragenter", "dragover"].forEach((evt) => dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((evt) => dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name || "")) { toast("PDF 파일만 지원합니다."); return; }
    analyzePdf(file);
  });

  body.querySelector("#use-paste-btn").onclick = () => {
    const text = pasteArea.value.trim();
    if (!text) { toast("텍스트를 붙여넣어 주세요."); return; }
    const drafts = draftRecordsFromText(text, null);
    if (!drafts.length) { toast("분석할 기록을 찾지 못했습니다."); return; }
    replaceImportedRecords(drafts, text);
    runAutomaticInterviewAnalysis();
    navigate("analysis-results");
  };
  body.appendChild(buildFlowNav("start"));
  return screenShell("생활기록부로 바로 시작", "PDF를 넣는 것만으로 기본 면접 분석이 끝나도록 설계했습니다.", body);
});

// ── 추출 내용 확인·수정 + 다중 태그 지정 (§11, 보완: 복수 선택 허용) ──
registerRoute("record-map", () => {
  const body = el(`<div class="stack">
    <div class="notice small">이 화면은 <strong>선택 기능</strong>입니다. 기본 사용자는 자동 분석 결과만 확인하면 됩니다. 자동 분류가 어색할 때만 기록·영역·태그를 수정하세요.</div>
    <button class="btn-primary" id="rerun-analysis-btn">수정한 내용으로 다시 자동 분석</button>
    <div id="rec-list" class="stack"></div>
    <div class="row-gap">
      <button class="btn-ghost small" id="purge-buf-btn">PDF 원문 버퍼만 삭제</button>
      <button class="btn-ghost small danger" id="purge-all-btn">학생부 관련 항목 전체 삭제</button>
    </div>
    <p class="muted small">"버퍼만 삭제"는 원본 텍스트만 지우고 이미 정리한 기록은 남깁니다. "전체 삭제"는 학생부에서 만든 기록·활동·질문까지 모두 지웁니다(직접 입력한 항목은 유지).</p>
  </div>`);
  const list = body.querySelector("#rec-list");
  renderRecordList(list);
  body.querySelector("#rerun-analysis-btn").onclick = () => { runAutomaticInterviewAnalysis(); navigate("analysis-results"); };
  body.querySelector("#purge-buf-btn").onclick = () => purgeRecordRawText();
  body.querySelector("#purge-all-btn").onclick = () => {
    if (confirm("학생부에서 가져온 원문·기록·관련 활동·질문을 모두 삭제합니다. 계속할까요?")) {
      purgeAllRecordData();
      renderRecordList(list);
    }
  };
  body.appendChild(buildFlowNav("record"));
  return screenShell("상세 분석 수정", "자동 분석 결과를 교정하고 싶을 때만 사용합니다.", body);
});

function autoTagsFromText(text, section) {
  return inferRecordTags({ text: text || "", section: section || "", tags: [] });
}

function renderRecordList(list) {
  list.innerHTML = "";
  if (!AppState.records.length) { list.appendChild(el(`<p class="muted">아직 기록이 없습니다. 이전 화면에서 추가하세요.</p>`)); return; }
  AppState.records.forEach((r) => {
    if (!r.tagsInitialized) { r.tags = autoTagsFromText(r.text, r.section); r.tagsInitialized = true; }
    const card = el(`<div class="card">
      <div class="tag-checks"></div>
      <select class="section-select">
        <option value="">영역 미지정</option>
        ${window.APP_DATA.recordSections.map((s) => `<option ${r.section===s?"selected":""}>${s}</option>`).join("")}
      </select>
      <textarea class="rec-text" rows="2">${escapeHtml(r.text)}</textarea>
      <button class="btn-ghost small danger">삭제</button>
    </div>`);
    const tagBox = card.querySelector(".tag-checks");
    window.APP_DATA.recordTags.forEach((t) => {
      const label = el(`<label><input type="checkbox" ${recordHasTag(r, t.id) ? "checked" : ""}> ${t.mark} ${escapeHtml(t.label)}</label>`);
      label.querySelector("input").onchange = (e) => toggleRecordTag(r, t.id, e.target.checked);
      tagBox.appendChild(label);
    });
    card.querySelector(".section-select").onchange = (e) => {
      r.section = e.target.value || "미지정";
      AppState.questions.filter((q) => q.recordId === r.id).forEach((q) => { q.evidenceSection = r.section; });
    };
    card.querySelector(".rec-text").oninput = (e) => {
      r.text = e.target.value;
      AppState.questions.filter((q) => q.recordId === r.id).forEach((q) => { q.evidenceText = r.text; q.evidenceSection = r.section; });
    };
    card.querySelector(".danger").onclick = () => {
      const qCount = AppState.questions.filter((q) => q.recordId === r.id).length;
      const aCount = AppState.activities.filter((a) => a.recordId === r.id).length;
      const msg = qCount || aCount ? `이 기록에서 만든 질문 ${qCount}개·핵심활동 ${aCount}개도 함께 삭제합니다. 계속할까요?` : "이 기록을 삭제할까요?";
      if (!confirm(msg)) return;
      AppState.records = AppState.records.filter((x) => x.id !== r.id);
      AppState.questions = AppState.questions.filter((q) => q.recordId !== r.id);
      AppState.activities = AppState.activities.filter((a) => a.recordId !== r.id);
      renderRecordList(list);
    };
    list.appendChild(card);
  });
}


// ── 자동 분석 결과 — 기본 학생이 가장 오래 머무는 핵심 화면 ───────────
function tagBadgesHtml(tags) {
  const map = { career: "◎ 진로·전공", academic: "■ 학업·탐구", community: "▲ 공동체", explain: "✕ 설명 필요" };
  return (tags || []).map((t) => map[t] ? `<span class="mini-tag tag-${t}">${map[t]}</span>` : "").join(" ");
}

function questionResultCard(q, compact) {
  const evidence = q.evidenceText ? `<div class="evidence-box"><span class="label">근거 · ${escapeHtml(q.evidenceSection || "학생부")}</span><p>${escapeHtml(String(q.evidenceText).slice(0, compact ? 120 : 220))}${String(q.evidenceText).length > (compact ? 120 : 220) ? "…" : ""}</p></div>` : "";
  const priLabel = q.priority === "A" ? "A · 반드시 준비" : q.priority === "B" ? "B · 준비 권장" : q.priority === "C" ? "C · 여유가 있으면" : "추가 질문";
  const card = el(`<div class="card result-question ${q.priority === "A" ? "priority-a" : "priority-b"}">
    <div class="row-between"><span class="priority-pill">${priLabel}</span><span class="muted small">${escapeHtml(q.directionLabel || "")}</span></div>
    <h3>${escapeHtml(q.text)}</h3>
    ${evidence}
    <div class="row-gap">
      <button class="btn-primary small train-btn">30·60초 연습</button>
      <button class="btn-ghost small follow-btn">꼬리질문 3층</button>
    </div>
  </div>`);
  card.querySelector(".train-btn").onclick = () => navigate("trainer", { qid: q.id });
  card.querySelector(".follow-btn").onclick = () => navigate("followups", { qid: q.id });
  return card;
}

registerRoute("analysis-results", () => {
  let result = AppState.analysisResult;
  if (!result && AppState.records.length) result = runAutomaticInterviewAnalysis();
  if (!result) {
    const body = el(`<div class="stack"><div class="notice">분석할 자료가 없습니다. 생활기록부 PDF를 넣거나 활동을 직접 입력해 주세요.</div><button class="btn-primary" onclick="navigate('record-import')">생활기록부 PDF 넣기</button><button class="btn-secondary" onclick="navigate('no-record-input')">직접 입력하기</button></div>`);
    return screenShell("자동 면접 분석 결과", "자료를 넣으면 핵심 질문을 자동으로 정리합니다.", body);
  }

  const uni = getActiveUniversity();
  const body = el(`<div class="stack">
    <div class="analysis-hero">
      <div><span class="hero-kicker">자동 분석 완료</span><h2>${result.universityLabel ? escapeHtml(result.universityLabel) + " 기준" : "생활기록부 기준"} 면접 준비 지도</h2></div>
      <div class="stat-grid">
        <div class="stat-card"><strong>${result.coreRecords.length}</strong><span>핵심 기록</span></div>
        <div class="stat-card"><strong>${result.mandatoryQuestions.length}</strong><span>필수 질문</span></div>
        <div class="stat-card"><strong>${result.recommendedQuestions.length}</strong><span>권장 질문</span></div>
        <div class="stat-card"><strong>${result.explainRecords.length}</strong><span>설명 필요</span></div>
      </div>
      <p class="muted small">이 결과는 학생부 문장·영역·활동 키워드를 바탕으로 선별한 규칙 기반 분석입니다. 실제 면접 질문을 보장하지 않으며, 대학 공식 면접 안내가 있으면 그 내용을 우선합니다.</p>
    </div>

    ${!uni ? `<div class="notice small"><strong>실제 지원 대학이 정해졌다면</strong> 대학·학과만 입력해도 전공 연결 질문을 더 맞춤화할 수 있습니다. <button class="inline-link-btn" onclick="navigate('student-dashboard')">선택 입력하기</button></div>` : (!effectiveInterviewType(uni) ? `<div class="notice small"><strong>${escapeHtml(uni.name || "지원 대학")} 면접 전 확인:</strong> 학생부 질문은 이미 생성했습니다. 실제 면접 전에는 모집요강·입학처에서 면접유형과 평가요소를 확인하세요. <button class="inline-link-btn" onclick="navigate('type-helper')">면접유형 확인하기</button></div>` : ``)}

    <section class="result-section">
      <div class="section-head"><div><span class="section-no">1</span><h2>면접에서 가장 먼저 준비할 활동</h2></div><button class="btn-ghost small" onclick="navigate('activities')">활동카드 자세히 쓰기</button></div>
      <div id="core-activity-results" class="stack"></div>
    </section>

    <section class="result-section">
      <div class="section-head"><div><span class="section-no">2</span><h2>반드시 준비할 질문</h2></div><span class="badge">A</span></div>
      <p class="muted small">먼저 아래 질문부터 실제로 소리 내어 답해 보세요. 답을 외우기보다 근거가 된 경험을 자기 말로 설명하는 것이 중요합니다.</p>
      <div id="mandatory-results" class="stack"></div>
      <button class="btn-secondary" onclick="navigate('questions')">전체 예상질문 보기</button>
    </section>

    <section class="result-section" id="explain-section">
      <div class="section-head"><div><span class="section-no">3</span><h2>설명을 준비해 둘 기록</h2></div></div>
      <div id="explain-results" class="stack"></div>
    </section>

    <div id="analysis-ai-entry"></div>

    <details class="optional-panel">
      <summary>기타 상세 도구 <span class="muted small">(선택)</span></summary>
      <div class="tool-grid optional-panel-body">
        <button class="btn-ghost small" onclick="navigate('record-map')">자동 분석 결과 직접 수정</button>
        <button class="btn-ghost small" onclick="navigate('universities')">대학 면접정보 상세 입력</button>
        <button class="btn-ghost small" onclick="navigate('blind-check')">블라인드 점검</button>
      </div>
    </details>
  </div>`);

  const aiEntry = body.querySelector("#analysis-ai-entry");
  if (hasImportedStudentRecord()) {
    aiEntry.appendChild(el(`<section class="ai-highlight-card result-ai-highlight" aria-label="생활기록부 기반 AI 심화분석">
      <div class="ai-highlight-icon" aria-hidden="true">✨</div>
      <div class="ai-highlight-copy">
        <span class="ai-highlight-kicker">선택 기능 · 무료</span>
        <h3>생활기록부 기반 AI 심화분석</h3>
        <p>방금 분석한 생활기록부 기록을 바탕으로 더 깊은 질문과 꼬리질문을 받습니다. 생기부 전체가 자동 전송되지는 않습니다.</p>
        <div class="ai-meta-row"><span>API 없음</span><span>전송 범위 직접 선택</span><span>ChatGPT · Claude · Gemini</span></div>
      </div>
      <button class="btn-ai-strong" onclick="navigateAiMode('record')">생기부 기반 AI 분석</button>
    </section>`));
  }
  if (hasDirectActivityRecords()) {
    aiEntry.appendChild(el(`<section class="ai-highlight-card result-ai-highlight" aria-label="내 활동 기반 AI 심화분석">
      <div class="ai-highlight-icon" aria-hidden="true">✨</div>
      <div class="ai-highlight-copy">
        <span class="ai-highlight-kicker">생활기록부 없이도 가능 · 무료</span>
        <h3>내 활동으로 AI 심화분석</h3>
        <p>직접 입력한 활동만 골라 AI에 보낼 프롬프트를 만듭니다. 생활기록부와는 별개의 분석 경로입니다.</p>
        <div class="ai-meta-row"><span>API 없음</span><span>직접 입력 활동만 사용</span><span>원하는 AI 사용</span></div>
      </div>
      <button class="btn-ai-strong" onclick="navigateAiMode('activity')">내 활동 AI 분석</button>
    </section>`));
  }

  const actBox = body.querySelector("#core-activity-results");
  if (!result.coreRecords.length) actBox.appendChild(el(`<p class="muted">핵심 활동을 선별하지 못했습니다.</p>`));
  result.coreRecords.slice(0, 3).forEach((item, idx) => {
    const ev = shortEvidenceLabel(item.record);
    actBox.appendChild(el(`<div class="card core-record-card">
      <div class="row-between"><span class="rank-badge">TOP ${idx + 1}</span><div>${tagBadgesHtml(item.tags)}</div></div>
      <strong>${escapeHtml(ev.section)}</strong>
      <p>${escapeHtml(ev.snippet)}</p>
      <p class="muted small">선정 근거: ${escapeHtml(item.reasons.join(" · ") || "활동의 구체성과 면접 활용도")}</p>
    </div>`));
  });

  const qBox = body.querySelector("#mandatory-results");
  const showQs = result.mandatoryQuestions.slice(0, 8);
  showQs.forEach((q) => qBox.appendChild(questionResultCard(q, true)));
  if (!showQs.length) qBox.appendChild(el(`<p class="muted">필수 질문을 만들지 못했습니다.</p>`));

  const explainBox = body.querySelector("#explain-results");
  if (!result.explainRecords.length) {
    body.querySelector("#explain-section").classList.add("soft-section");
    explainBox.appendChild(el(`<p class="muted">자동 분석에서 별도로 설명을 준비해야 할 기록은 두드러지지 않았습니다. 실제 출결·성적·진로변경 등은 본인이 다시 확인하세요.</p>`));
  } else {
    result.explainRecords.forEach((item) => {
      const ev = shortEvidenceLabel(item.record);
      explainBox.appendChild(el(`<div class="card warn"><strong>${escapeHtml(ev.section)}</strong><p>${escapeHtml(ev.snippet)}</p><p class="muted small">면접에서는 사실을 숨기기보다 원인 → 바꾼 노력 → 현재 변화 순으로 준비하세요.</p></div>`));
    });
    explainBox.appendChild(el(`<button class="btn-ghost small" onclick="navigate('weakness')">설명 4단계로 정리하기</button>`));
  }

  body.appendChild(buildFlowNav("results"));
  return screenShell("자동 면접 분석 결과", "학생은 체크보다 질문에 답하는 데 시간을 쓰도록 구성했습니다.", body);
});

// ── STEP7 핵심활동 TOP3 (§16, 보완: "내가 직접 한 일" 필드 추가) ───────
registerRoute("activities", () => {
  const body = el(`<div class="stack">
    <div class="notice small">최대 3개까지 고르세요. 후보는 추천만 하고, 최종 선택은 학생이 합니다.</div>
    <div id="candidate-list" class="stack"></div>
    <hr class="divider">
    <p class="label">선택된 핵심활동 (최대 3)</p>
    <div id="chosen-list" class="stack"></div>
  </div>`);
  const candBox = body.querySelector("#candidate-list");
  const chosenBox = body.querySelector("#chosen-list");
  const candidates = AppState.records.filter((r) => ["career", "academic", "community"].some((t) => recordHasTag(r, t)));
  if (!candidates.length) candBox.appendChild(el(`<p class="muted">추천 후보가 없습니다. 학생부 근거 지도에서 태그를 지정하세요.</p>`));
  candidates.forEach((r) => {
    const already = AppState.activities.some((a) => a.recordId === r.id);
    const btn = el(`<button class="candidate-card" ${already ? "disabled" : ""}>
      <span>${escapeHtml(r.text.slice(0, 60))}</span><span class="add-mark">${already ? "선택됨" : "+ 선택"}</span>
    </button>`);
    btn.onclick = () => {
      if (AppState.activities.length >= 3) { toast("핵심활동은 최대 3개입니다."); return; }
      AppState.activities.push({
        id: uid("act"), recordId: r.id, name: r.text.slice(0, 20), situation: "", role: "",
        action: "", process: "", result: "", limit: "", link: "", summary: "",
      });
      renderRoute();
    };
    candBox.appendChild(btn);
  });
  AppState.activities.forEach((a, idx) => {
    const card = el(`<div class="card activity-card">
      <div class="row-between"><strong>카드 ${idx + 1} · ${escapeHtml(a.name)}</strong><button class="btn-ghost small danger">삭제</button></div>
      <label class="field"><span>상황(언제·어디서)</span><input class="a-situation" value="${escapeHtml(a.situation)}"></label>
      <label class="field"><span>맡은 역할</span><input class="a-role" value="${escapeHtml(a.role)}"></label>
      <label class="field"><span>내가 직접 한 일 (가장 중요 — 가장 길게)</span><textarea class="a-action" rows="4" placeholder="구체적인 행동을 동사로 적으세요">${escapeHtml(a.action)}</textarea></label>
      <label class="field"><span>막힌 지점·해결 과정</span><textarea class="a-process" rows="2">${escapeHtml(a.process)}</textarea></label>
      <label class="field"><span>결과·달라진 점</span><input class="a-result" value="${escapeHtml(a.result)}"></label>
      <label class="field"><span>한계 / 다시 한다면</span><input class="a-limit" value="${escapeHtml(a.limit)}"></label>
      <label class="field"><span>전공과의 연결</span><input class="a-link" value="${escapeHtml(a.link)}"></label>
    </div>`);
    const bind = (sel, key) => card.querySelector(sel).addEventListener("input", (e) => {
      a[key] = e.target.value;
      a.summary = (a.action || a.process || a.result || "").slice(0, 40);
    });
    bind(".a-situation", "situation"); bind(".a-role", "role"); bind(".a-action", "action");
    bind(".a-process", "process"); bind(".a-result", "result"); bind(".a-limit", "limit"); bind(".a-link", "link");
    card.querySelector(".danger").onclick = () => { AppState.activities = AppState.activities.filter((x) => x.id !== a.id); renderRoute(); };
    chosenBox.appendChild(card);
  });
  body.appendChild(buildFlowNav("activities"));
  return screenShell("핵심 활동 TOP 3", "빈칸으로 남은 자리가 곧 면접에서 질문이 들어올 자리입니다. '내가 직접 한 일'을 가장 자세히 쓰세요.", body);
});

// ── 핵심 예상질문 — 자동생성 결과를 우선순위별로 바로 보여줍니다 ─────────
registerRoute("questions", () => {
  if (!AppState.questions.length && AppState.records.length) runAutomaticInterviewAnalysis();
  const body = el(`<div class="stack">
    <div class="notice small">질문은 학생부의 실제 기록을 근거로 자동 선별했습니다. A부터 먼저 연습하고, B는 여유가 있을 때 준비하세요.</div>
    <div class="tab-bar">
      <button class="btn-primary small" data-filter="A">A · 반드시 준비</button>
      <button class="btn-ghost small" data-filter="B">B · 준비 권장</button>
      <button class="btn-ghost small" data-filter="ALL">전체</button>
    </div>
    <div id="q-list" class="stack"></div>
    <details class="optional-panel"><summary>기록별 6방향 질문을 더 만들기 <span class="muted small">(선택)</span></summary><div id="extra-q-sources" class="stack optional-panel-body"></div></details>
  </div>`);
  const list = body.querySelector("#q-list");
  let filter = "A";
  function renderList() {
    list.innerHTML = "";
    const pool = AppState.questions.filter((q) => filter === "ALL" || q.priority === filter);
    if (!pool.length) list.appendChild(el(`<p class="muted">해당 우선순위의 질문이 없습니다.</p>`));
    pool.forEach((q) => list.appendChild(questionResultCard(q, false)));
    body.querySelectorAll("[data-filter]").forEach((b) => {
      b.className = b.dataset.filter === filter ? "btn-primary small" : "btn-ghost small";
    });
  }
  body.querySelectorAll("[data-filter]").forEach((b) => b.onclick = () => { filter = b.dataset.filter; renderList(); });
  renderList();

  const extra = body.querySelector("#extra-q-sources");
  AppState.records.filter((r) => r.text && !isLikelyLowValueRecord(r)).slice(0, 20).forEach((r) => {
    const row = el(`<div class="card"><p class="muted small">${escapeHtml(r.section)}</p><p>${escapeHtml(String(r.text).slice(0, 110))}${String(r.text).length>110?"…":""}</p><button class="btn-ghost small">6방향 질문 추가</button></div>`);
    row.querySelector("button").onclick = () => {
      const existing = new Set(AppState.questions.filter((q) => q.recordId === r.id).map((q) => q.direction));
      generateSixDirectionQuestions(r).filter((q) => !existing.has(q.direction)).forEach((q) => { q.priority = "B"; AppState.questions.push(q); });
      toast("추가 질문을 B 목록에 넣었습니다."); filter = "B"; renderList();
    };
    extra.appendChild(row);
  });
  body.appendChild(buildFlowNav("questions"));
  return screenShell("핵심 예상질문", "많이 만드는 것보다, 중요한 질문을 깊게 준비하는 데 초점을 둡니다.", body);
});

function buildQuestionCard(q) {
  const uni = getActiveUniversity();
  const record = AppState.records.find((r) => r.id === q.recordId) || null;
  const reason = estimatePriorityReason(record, uni?.evalWeights ? [uni.evalWeights] : []);
  const card = el(`<div class="card q-card">
    <div class="row-between"><strong>${escapeHtml(q.directionLabel)}</strong><span class="badge source-${q.source==='AI 제안'?'ai':'rule'}">${escapeHtml(q.source)}</span></div>
    <p>${escapeHtml(q.text)}</p>
    <p class="muted small">${escapeHtml(q.hint || "")}</p>
    <label class="field"><span>우선순위</span>
      <select class="pri-select">
        <option value="" ${!q.priority?"selected":""}>미지정</option>
        <option value="A" ${q.priority==='A'?"selected":""}>A · 반드시 준비</option>
        <option value="B" ${q.priority==='B'?"selected":""}>B · 준비 권장</option>
        <option value="C" ${q.priority==='C'?"selected":""}>C · 여유가 있으면</option>
      </select>
    </label>
    <p class="muted small">참고: ${escapeHtml(reason)}</p>
    <button class="btn-ghost small">꼬리질문 3층 열기</button>
  </div>`);
  card.querySelector(".pri-select").onchange = (e) => { q.priority = e.target.value || null; };
  card.querySelector(".btn-ghost").onclick = () => navigate("followups", { qid: q.id });
  return card;
}

// ── STEP6 꼬리질문 3층 (§15) ──────────────────────────────────────────
registerRoute("followups", (params) => {
  const q = AppState.questions.find((x) => x.id === params.qid) || AppState.questions[0];
  if (!q) {
    const body = el(`<p class="muted">질문을 먼저 만들어주세요.</p>`);
    body.appendChild ? null : null;
    const wrap = el(`<div class="stack"></div>`); wrap.appendChild(body);
    wrap.appendChild(el(`<button class="btn-ghost" onclick="navigate('questions')">질문 목록으로</button>`));
    return screenShell("꼬리질문 3층", "", wrap);
  }
  const body = el(`<div class="stack">
    <div class="card"><p>${escapeHtml(q.text)}</p><p class="muted small">근거: ${escapeHtml(q.evidenceText || "")}</p></div>
    <div id="layers" class="stack"></div>
    <button class="btn-ghost" onclick="navigate('questions')">← 질문 목록으로 돌아가기</button>
  </div>`);
  const layers = body.querySelector("#layers");
  (q.followUps || (q.followUps = buildFollowUpChecklist())).forEach((layer) => {
    const row = el(`<div class="card layer-row">
      <label class="field checkbox"><input type="checkbox" ${layer.done?"checked":""}> ${escapeHtml(layer.label)}</label>
      <p class="muted small">${escapeHtml(layer.prompt)}</p>
      <textarea rows="2" placeholder="키워드로 메모">${escapeHtml(layer.note || "")}</textarea>
    </div>`);
    row.querySelector("input").onchange = (e) => { layer.done = e.target.checked; };
    row.querySelector("textarea").oninput = (e) => { layer.note = e.target.value; };
    layers.appendChild(row);
  });
  return screenShell("꼬리질문 3층", "사실 → 과정·판단 → 근거·한계", body);
});

// ── 설명이 필요한 기록 대응 4단계 ──────────────────────────────────────
registerRoute("weakness", () => {
  if (!AppState.weaknessEntries) AppState.weaknessEntries = [];
  const body = el(`<div class="stack">
    <p class="muted small">${escapeHtml(window.APP_DATA.weaknessFrame.desc)}</p>
    <div id="weak-list" class="stack"></div>
    <button class="btn-primary" id="add-weak-btn">+ 새 항목 추가</button>
  </div>`);
  const list = body.querySelector("#weak-list");
  function render() {
    list.innerHTML = "";
    AppState.weaknessEntries.forEach((entry, idx) => {
      const card = el(`<div class="card">
        <div class="row-between">
          <select class="w-cat">${window.APP_DATA.weaknessFrame.weaknessCategories.map((c) => `<option ${entry.category===c?"selected":""}>${c}</option>`).join("")}</select>
          <button class="btn-ghost small danger">삭제</button>
        </div>
        ${window.APP_DATA.weaknessFrame.steps.map((s) => `
          <label class="field"><span>${escapeHtml(s.label)}</span>
          <textarea rows="2" data-key="${s.key}" placeholder="${escapeHtml(s.hint)}">${escapeHtml(entry[s.key] || "")}</textarea></label>
        `).join("")}
      </div>`);
      card.querySelector(".w-cat").onchange = (e) => { entry.category = e.target.value; };
      card.querySelectorAll("textarea").forEach((t) => t.oninput = (e) => {
        entry[e.target.dataset.key] = e.target.value;
        AppState.weaknessSummary = AppState.weaknessEntries.map((w) => `${w.category}: ${w.accept||""}`).join(" / ");
      });
      card.querySelector(".danger").onclick = () => { AppState.weaknessEntries.splice(idx, 1); render(); };
      list.appendChild(card);
    });
  }
  body.querySelector("#add-weak-btn").onclick = () => {
    AppState.weaknessEntries.push({ category: window.APP_DATA.weaknessFrame.weaknessCategories[0], accept: "", cause: "", effort: "", result: "" });
    render();
  };
  render();
  body.appendChild(buildFlowNav("weakness"));
  return screenShell("설명이 필요한 기록 대응", "인정 → 원인 분석 → 바꾼 노력 → 현재 결과·변화", body);
});

// ── STEP8 지원동기·학과 이해 ──────────────────────────────────────────
registerRoute("motivation", () => {
  const s = AppState;
  const body = el(`<div class="stack">
    <label class="field"><span>계기가 된 순간(하나만)</span><textarea id="m1" rows="2">${escapeHtml(s.motiveMoment||"")}</textarea></label>
    <label class="field"><span>그래서 실제로 한 일 (최대 3개, 줄바꿈으로 구분)</span><textarea id="m2" rows="3">${escapeHtml((s.motiveActions||[]).join("\n"))}</textarea></label>
    <label class="field"><span>학과에서 배우는 것 (대학 공식 페이지에서 확인한 과목/주제 1~3개)</span><textarea id="m3" rows="2">${escapeHtml(s.majorCourses||"")}</textarea></label>
    <label class="field"><span>확인 출처·확인일</span><input id="m3s" placeholder="예: OO대 학과 홈페이지 교육과정, 2026-03-01" value="${escapeHtml(s.majorSourceLog||"")}"></label>
    <label class="field"><span>가장 배우고 싶은 과목과 이유</span><textarea id="m4" rows="2">${escapeHtml(s.favoriteCourseWhy||"")}</textarea></label>
    <label class="field"><span>입학 후 하고 싶은 것</span><textarea id="m5" rows="2">${escapeHtml(s.afterAdmission||"")}</textarea></label>
    <label class="field"><span>지원동기 한 줄 (인쇄용, 80자 이내)</span><input id="m6" maxlength="80" value="${escapeHtml(s.motiveOneLine||"")}"></label>
    <div class="notice small">학과 교육과정 등 최신 정보를 이 앱이 임의로 만들지 않습니다. 반드시 대학 홈페이지에서 확인 후 입력하세요.</div>
    <button class="btn-primary" id="save-m-btn">저장</button>
  </div>`);
  body.querySelector("#save-m-btn").onclick = () => {
    s.motiveMoment = body.querySelector("#m1").value;
    s.motiveActions = body.querySelector("#m2").value.split("\n").filter(Boolean);
    s.majorCourses = body.querySelector("#m3").value;
    s.majorSourceLog = body.querySelector("#m3s").value;
    s.favoriteCourseWhy = body.querySelector("#m4").value;
    s.afterAdmission = body.querySelector("#m5").value;
    s.motiveOneLine = body.querySelector("#m6").value;
    toast("저장했습니다.");
  };
  body.appendChild(buildFlowNav("motivation"));
  return screenShell("지원동기·학과 이해", "계기 → 한 일 → 학과 이해 → 하고 싶은 것.", body);
});

// ── AI 면접 코치 (§18~26, 보완: 단일기록 실선택 + feedback도 동일 안전절차 + 전체 필드 노출) ──
registerRoute("ai-coach", (params) => {
  const requested = params && params.mode ? params.mode : "";
  const validModes = ["record", "activity", "single", "feedback"];
  const directMode = validModes.includes(requested) ? requested : "";
  const titles = {
    record: ["생활기록부 기반 AI 심화분석", "불러온 생활기록부 중 필요한 기록만 골라 더 깊은 예상질문과 꼬리질문을 만듭니다."],
    activity: ["내 활동으로 AI 심화분석", "생활기록부 없이 직접 입력한 경험만 이용해 더 정교한 면접질문을 만듭니다."],
    single: ["선택 기록 AI 집중분석", "기록 하나만 골라 개인정보 전송 범위를 최소화하면서 깊게 분석합니다."],
    feedback: ["내 답변 AI 피드백", "내가 작성한 답변을 AI가 대신 고쳐 쓰지 않고, 잘된 점·보완점·꼬리질문만 점검합니다."],
  };
  const body = el(`<div class="stack">
    <div class="notice">AI API를 쓰지 않습니다. 프롬프트를 만들어 복사한 뒤, 평소 쓰는 AI에 붙여넣고 결과를 다시 이 화면에 붙여넣습니다.</div>
    <div class="menu-grid three" id="ai-mode-menu">
      <button class="menu-card small" data-mode="record"><span class="menu-title">생활기록부 기반 AI 심화분석</span><span class="menu-desc">불러온 생기부 기록만 사용</span></button>
      <button class="menu-card small" data-mode="activity"><span class="menu-title">내 활동으로 AI 심화분석</span><span class="menu-desc">직접 입력한 활동만 사용</span></button>
      <button class="menu-card small" data-mode="feedback"><span class="menu-title">내 답변 AI 피드백</span><span class="menu-desc">답변의 잘된 점·보완점·꼬리질문</span></button>
      <button class="menu-card small" data-mode="single"><span class="menu-title">기록 하나만 집중분석</span><span class="menu-desc">전송 범위를 최소화한 고급 기능</span></button>
    </div>
    <div id="ai-wizard"></div>
  </div>`);
  const mount = body.querySelector("#ai-wizard");
  const menu = body.querySelector("#ai-mode-menu");
  body.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => {
    renderAiWizard(mount, b.dataset.mode);
    menu.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("selected", x === b));
  });
  if (directMode) {
    menu.style.display = "none";
    renderAiWizard(mount, directMode);
    const switchBtn = el(`<button class="btn-ghost small">다른 AI 도구 보기</button>`);
    switchBtn.onclick = () => { menu.style.display = "grid"; switchBtn.remove(); };
    body.insertBefore(switchBtn, mount);
  }
  body.appendChild(buildFlowNav("ai-coach"));
  const copy = titles[directMode] || ["AI 면접 코치 활용하기", "학생 답을 AI가 대신 만드는 것이 아니라, AI가 더 좋은 질문을 던지게 합니다."];
  return screenShell(copy[0], copy[1], body);
});

function renderAiWizard(mount, mode) {
  mount.innerHTML = "";
  const state = { step: 1, selectedSectionKeys: {}, selectedRecordId: null, selectedRecordIds: {}, redactedText: "", answerDraft: "" };
  const wizard = el(`<div class="card wizard"></div>`);
  mount.appendChild(wizard);

  function renderStep() {
    wizard.innerHTML = "";
    if (state.step === 1) renderSelectStep();
    else if (state.step === 2) renderRedactStep();
    else if (state.step === 3) renderPreviewStep();
    else if (state.step === 4) renderGenerateStep();
  }

  function recordsForMode() {
    if (mode === "record") return AppState.records.filter((r) => r.source === "학생부/붙여넣기");
    if (mode === "activity") return AppState.records.filter((r) => r.source === "직접 입력");
    return AppState.records;
  }
  function bySectionMap(records) {
    const bySection = {};
    (records || recordsForMode()).forEach((r) => { (bySection[r.section] = bySection[r.section] || []).push(r); });
    return bySection;
  }

  function renderSelectStep() {
    if (mode === "feedback") {
      wizard.appendChild(el(`<h3>단계 1 · 점검받을 답변 입력</h3>`));
      const ta = el(`<textarea rows="6" placeholder="점검받고 싶은 답변을 입력하세요">${escapeHtml(state.answerDraft)}</textarea>`);
      wizard.appendChild(ta);
      const next = el(`<button class="btn-primary">다음</button>`);
      next.onclick = () => { state.answerDraft = ta.value; state.step = 2; renderStep(); };
      wizard.appendChild(next);
      return;
    }
    if (mode === "single") {
      wizard.appendChild(el(`<h3>단계 1 · 집중분석할 기록 정확히 1개 선택</h3>`));
      if (!AppState.records.length) wizard.appendChild(el(`<p class="muted">선택할 기록이 없습니다. 활동을 먼저 등록하세요.</p>`));
      const listBox = el(`<div class="stack"></div>`);
      AppState.records.forEach((r) => {
        const row = el(`<label class="field checkbox">
          <input type="radio" name="single-record" value="${r.id}" ${state.selectedRecordId===r.id?"checked":""}>
          <span>[${escapeHtml(r.section)}] ${escapeHtml(r.text.slice(0, 70))}</span>
        </label>`);
        row.querySelector("input").onchange = () => { state.selectedRecordId = r.id; };
        listBox.appendChild(row);
      });
      wizard.appendChild(listBox);
      const next = el(`<button class="btn-primary">다음</button>`);
      next.onclick = () => {
        if (!state.selectedRecordId) { toast("기록을 하나 선택하세요."); return; }
        state.step = 2; renderStep();
      };
      wizard.appendChild(next);
      return;
    }
    const records = recordsForMode();
    const sourceLabel = mode === "record" ? "생활기록부 기록" : mode === "activity" ? "직접 입력한 활동" : "학생 자료";
    wizard.appendChild(el(`<h3>단계 1 · AI에 보낼 ${sourceLabel} 선택</h3>`));
    if (mode === "activity") {
      if (!records.length) wizard.appendChild(el(`<div class="notice small">직접 입력한 활동이 없습니다. 먼저 [생활기록부 없이 시작]에서 활동을 입력하세요.</div>`));
      records.forEach((r) => {
        const row = el(`<label class="field checkbox"><input type="checkbox" data-record-id="${r.id}" checked> <span>[${escapeHtml(r.section)}] ${escapeHtml(r.text.slice(0, 110))}</span></label>`);
        wizard.appendChild(row);
      });
      const next = el(`<button class="btn-primary" ${records.length ? "" : "disabled"}>다음</button>`);
      next.onclick = () => {
        state.selectedRecordIds = {};
        wizard.querySelectorAll("[data-record-id]").forEach((cb) => { state.selectedRecordIds[cb.dataset.recordId] = cb.checked; });
        if (!Object.values(state.selectedRecordIds).some(Boolean)) { toast("활동을 하나 이상 선택하세요."); return; }
        state.step = 2; renderStep();
      };
      wizard.appendChild(next);
      return;
    }
    const bySection = bySectionMap(records);
    Object.keys(bySection).forEach((section) => {
      const checked = !SENSITIVE_BY_DEFAULT_OFF.includes(section);
      const row = el(`<label class="field checkbox"><input type="checkbox" data-section="${escapeHtml(section)}" ${checked?"checked":""}> ${escapeHtml(section)} (${bySection[section].length}건)${SENSITIVE_BY_DEFAULT_OFF.includes(section)?' <span class="muted small">— 민감도가 높아 기본 해제</span>':''}</label>`);
      wizard.appendChild(row);
    });
    if (!Object.keys(bySection).length) wizard.appendChild(el(`<div class="notice small">${mode === "record" ? "불러온 생활기록부 기록이 없습니다. 먼저 생활기록부 PDF를 넣어주세요." : "선택할 기록이 없습니다."}</div>`));
    const next = el(`<button class="btn-primary" ${Object.keys(bySection).length ? "" : "disabled"}>다음</button>`);
    next.onclick = () => {
      state.selectedSectionKeys = {};
      wizard.querySelectorAll("[data-section]").forEach((cb) => { state.selectedSectionKeys[cb.dataset.section] = cb.checked; });
      if (!Object.values(state.selectedSectionKeys).some(Boolean)) { toast("보낼 영역을 하나 이상 선택하세요."); return; }
      state.step = 2; renderStep();
    };
    wizard.appendChild(next);
  }

  function collectSelectedText() {
    if (mode === "feedback") return state.answerDraft;
    if (mode === "single") {
      const r = AppState.records.find((x) => x.id === state.selectedRecordId);
      return r ? `[${r.section}]\n- ${r.text}` : "";
    }
    if (mode === "activity") {
      return recordsForMode().filter((r) => state.selectedRecordIds[r.id]).map((r) => `[${r.section}]\n- ${r.text}`).join("\n\n");
    }
    const bySection = bySectionMap(recordsForMode());
    let text = "";
    Object.keys(state.selectedSectionKeys).forEach((section) => {
      if (state.selectedSectionKeys[section] && bySection[section]) {
        text += `[${section}]\n` + bySection[section].map((r) => "- " + r.text).join("\n") + "\n\n";
      }
    });
    return text.trim();
  }

  function renderRedactStep() {
    wizard.appendChild(el(`<h3>단계 2 · 개인정보 제거</h3>`));
    const raw = collectSelectedText();
    const hits = findPiiCandidates(raw);
    wizard.appendChild(el(`<p class="muted small">제거 후보 목록: ${window.APP_DATA.piiRedactionHints.join(", ")}</p>`));
    if (hits.length) wizard.appendChild(el(`<div class="notice small">자동 탐지된 후보: ${hits.map(escapeHtml).join(" / ")}</div>`));
    const ta = el(`<textarea id="redact-ta" rows="8">${escapeHtml(raw)}</textarea>`);
    wizard.appendChild(el(`<p class="label">아래에서 이름·학교명 등을 직접 지우거나 [ ]로 바꾸세요</p>`));
    wizard.appendChild(ta);
    const next = el(`<button class="btn-primary">다음 · 전송 내용 미리보기</button>`);
    next.onclick = () => { state.redactedText = ta.value; state.step = 3; renderStep(); };
    wizard.appendChild(next);
  }

  function renderPreviewStep() {
    wizard.appendChild(el(`<h3>단계 3 · 전송 내용 미리보기</h3>`));
    wizard.appendChild(el(`<div class="notice">AI 프롬프트를 외부 AI 서비스에 붙여넣으면 선택한 내용이 해당 서비스로 전송됩니다. 보내기 전 개인정보와 전송 범위를 반드시 확인하세요.</div>`));
    wizard.appendChild(el(`<pre class="preview-box">${escapeHtml(state.redactedText || "(내용 없음)")}</pre>`));
    const confirmLabel = el(`<label class="field checkbox"><input type="checkbox" id="confirm-cb"> 확인했습니다</label>`);
    wizard.appendChild(confirmLabel);
    const next = el(`<button class="btn-primary" disabled>다음 · 프롬프트 생성</button>`);
    confirmLabel.querySelector("input").onchange = (e) => { next.disabled = !e.target.checked; };
    next.onclick = () => { state.step = 4; renderStep(); };
    wizard.appendChild(next);
  }

  function renderGenerateStep() {
    wizard.appendChild(el(`<h3>단계 4-5 · 프롬프트 생성 및 복사</h3>`));
    const uni = getActiveUniversity();
    const prompt = buildAiPrompt({ university: uni, mode, redactedPreviewText: state.redactedText });
    const ta = el(`<textarea rows="12" readonly>${escapeHtml(prompt)}</textarea>`);
    wizard.appendChild(ta);
    const copyBtn = el(`<button class="btn-primary">프롬프트 복사하기</button>`);
    copyBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(prompt); toast("복사했습니다. 사용하는 AI에 붙여넣으세요."); }
      catch (e) { ta.select(); toast("자동 복사에 실패했습니다. 직접 선택해 복사해주세요."); }
    };
    wizard.appendChild(copyBtn);
    wizard.appendChild(el(`<ol class="usage-steps">
      <li>프롬프트를 복사합니다.</li>
      <li>평소 사용하는 ChatGPT, Claude, Gemini 등 AI를 엽니다.</li>
      <li>복사한 프롬프트를 붙여넣습니다.</li>
      <li>AI가 분석한 결과를 전체 복사합니다.</li>
      <li>아래 [AI 분석 결과 가져오기]에 붙여넣습니다.</li>
    </ol>`));
    const resultTa = el(`<textarea id="ai-result-ta" rows="8" placeholder="AI 분석 결과 붙여넣기"></textarea>`);
    wizard.appendChild(resultTa);
    const importBtn = el(`<button class="btn-secondary">AI 결과 붙여넣고 정리하기</button>`);
    const resultBox = el(`<div id="ai-result-box" class="stack"></div>`);
    importBtn.onclick = () => {
      AppState.aiResultRaw = resultTa.value;
      resultBox.innerHTML = "";
      if (mode === "feedback") {
        const feedback = tryParseFeedbackJson(resultTa.value);
        if (feedback.ok) {
          renderAiFeedbackResult(resultBox, feedback.data);
          toast("답변 피드백 형식으로 정상 인식했습니다.");
        } else {
          resultBox.appendChild(el(`<div class="notice small">피드백 JSON을 인식하지 못했습니다. AI 결과를 참고해 직접 읽어주세요. 잘한 점·보완점은 질문은행에 자동 저장하지 않습니다.</div>`));
          resultBox.appendChild(el(`<pre class="preview-box">${escapeHtml(resultTa.value)}</pre>`));
        }
        return;
      }
      const parsed = tryParseAiJson(resultTa.value);
      if (parsed.ok) {
        toast("AI 심화분석 결과를 정리했습니다.");
        renderAiAnalysisResult(resultBox, parsed.data);
      } else {
        renderAiUnparsedResult(resultBox, resultTa.value);
      }
    };
    wizard.appendChild(importBtn);
    wizard.appendChild(resultBox);
    wizard.appendChild(el(`<div class="notice small">AI 분석 결과는 참고자료입니다. 학생부 원문과 대학 모집요강을 기준으로 직접 확인하세요.</div>`));
  }

  renderStep();
}


function countAiArray(data, key) {
  return Array.isArray(data && data[key]) ? data[key].length : 0;
}

function aiDisplayText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "object") {
    const preferred = ["question", "text", "record", "activity", "content", "title", "reason"];
    for (const k of preferred) if (typeof value[k] === "string" && value[k].trim()) return value[k].trim();
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function findOrCreateAiQuestion(text, priority) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  let q = AppState.questions.find((x) => x.source === "AI 제안" && String(x.text || "").trim() === clean);
  if (!q) q = pushAiQuestion(clean, priority);
  else if (priority && !q.priority) q.priority = priority;
  return q;
}

function aiQuestionCleanCard(text, priority, label) {
  const clean = aiDisplayText(text);
  const card = el(`<div class="card ai-clean-card ai-question-card">
    <div class="row-between"><span class="priority-pill">${escapeHtml(label)}</span><span class="badge source-ai">AI 제안</span></div>
    <h3>${escapeHtml(clean)}</h3>
    <div class="row-gap ai-action-row">
      <button class="btn-primary small practice-btn">30·60초 연습</button>
      <button class="btn-ghost small save-btn">질문 저장</button>
    </div>
  </div>`);
  const saveBtn = card.querySelector(".save-btn");
  const syncSaved = () => {
    const exists = AppState.questions.some((x) => x.source === "AI 제안" && String(x.text || "").trim() === clean.trim());
    if (exists) { saveBtn.textContent = "저장됨"; saveBtn.disabled = true; }
  };
  saveBtn.onclick = () => { findOrCreateAiQuestion(clean, priority); syncSaved(); toast("질문을 저장했습니다."); };
  card.querySelector(".practice-btn").onclick = () => {
    const q = findOrCreateAiQuestion(clean, priority);
    if (q) navigate("trainer", { qid: q.id });
  };
  syncSaved();
  return card;
}

function aiFactCleanCard(text, kind) {
  const clean = aiDisplayText(text);
  const labels = {
    coreRecords: { badge: "핵심 기록", button: "내 기록으로 저장", confirm: "이 내용이 실제 생활기록부 또는 본인의 실제 경험과 일치합니까? 확인한 경우에만 저장해 주세요." },
    coreActivities: { badge: "핵심 활동 후보", button: "핵심 활동으로 저장", confirm: "이 활동이 실제 생활기록부 또는 본인의 실제 경험과 일치합니까? 확인한 경우에만 저장해 주세요." },
    needsExplanation: { badge: "설명 필요", button: "설명 준비에 추가", confirm: "이 내용이 실제 생활기록부 또는 본인의 실제 상황과 일치합니까? 확인한 경우에만 추가해 주세요." },
  };
  const meta = labels[kind] || labels.coreRecords;
  const card = el(`<div class="card ai-clean-card">
    <div class="row-between"><span class="mini-tag">${escapeHtml(meta.badge)}</span><span class="badge source-ai">AI 제안</span></div>
    <p class="ai-clean-text">${escapeHtml(clean)}</p>
    <div class="row-gap ai-action-row"><button class="btn-ghost small adopt-btn">${escapeHtml(meta.button)}</button></div>
  </div>`);
  const btn = card.querySelector(".adopt-btn");
  btn.onclick = () => {
    if (kind === "coreActivities" && AppState.activities.length >= 3) {
      toast("핵심활동은 최대 3개입니다. 기존 활동을 정리한 뒤 다시 시도하세요.");
      return;
    }
    if (!confirm(meta.confirm)) return;
    const handler = AI_ADOPT_HANDLERS[kind];
    if (handler) handler(clean, null);
    btn.textContent = "저장됨";
    btn.disabled = true;
    toast("확인한 내용을 저장했습니다.");
  };
  return card;
}

function aiVerificationCard(text) {
  const clean = aiDisplayText(text);
  return el(`<div class="card ai-clean-card ai-check-card">
    <div class="row-between"><span class="mini-tag tag-explain">직접 확인</span><span class="badge source-ai">AI 제안</span></div>
    <p class="ai-clean-text">${escapeHtml(clean)}</p>
    <p class="muted small">학생부 원문, 실제 활동 내용 또는 대학 공식자료에서 직접 확인하세요.</p>
  </div>`);
}

function appendAiCleanSection(box, title, subtitle, items, renderer, collapsed) {
  if (!Array.isArray(items) || !items.length) return;
  const section = el(`<section class="ai-result-section ${collapsed ? "is-collapsible" : ""}"></section>`);
  if (collapsed) {
    const details = el(`<details class="optional-panel"><summary>${escapeHtml(title)} <span class="muted small">${items.length}개</span></summary><div class="optional-panel-body stack"></div></details>`);
    if (subtitle) details.querySelector(".optional-panel-body").appendChild(el(`<p class="muted small">${escapeHtml(subtitle)}</p>`));
    items.forEach((item) => details.querySelector(".optional-panel-body").appendChild(renderer(item)));
    section.appendChild(details);
  } else {
    section.appendChild(el(`<div class="section-head"><div><h2>${escapeHtml(title)}</h2></div><span class="rank-badge">${items.length}개</span></div>`));
    if (subtitle) section.appendChild(el(`<p class="muted small ai-section-subtitle">${escapeHtml(subtitle)}</p>`));
    const list = el(`<div class="stack"></div>`);
    items.forEach((item) => list.appendChild(renderer(item)));
    section.appendChild(list);
  }
  box.appendChild(section);
}

function renderAiAnalysisResult(box, data) {
  const counts = {
    coreActivities: countAiArray(data, "coreActivities"),
    priorityA: countAiArray(data, "priorityA"),
    priorityB: countAiArray(data, "priorityB"),
    needsExplanation: countAiArray(data, "needsExplanation"),
  };
  const hero = el(`<div class="ai-result-hero">
    <div><span class="hero-kicker">AI 심화분석 완료</span><h2>면접 준비에 필요한 결과만 정리했습니다</h2></div>
    <div class="stat-grid ai-result-stats">
      <div class="stat-card"><strong>${counts.coreActivities}</strong><span>핵심 활동</span></div>
      <div class="stat-card"><strong>${counts.priorityA}</strong><span>필수 질문</span></div>
      <div class="stat-card"><strong>${counts.priorityB}</strong><span>권장 질문</span></div>
      <div class="stat-card"><strong>${counts.needsExplanation}</strong><span>설명 필요</span></div>
    </div>
    <p class="muted small">먼저 결과를 읽고 질문 연습을 시작하세요. AI가 제안한 사실성 내용은 저장할 때만 실제 학생부·경험과 일치하는지 확인합니다.</p>
  </div>`);
  box.appendChild(hero);
  if (counts.priorityA > 0) {
    const firstA = aiDisplayText(data.priorityA[0]);
    const startBtn = el(`<button class="btn-primary big ai-start-practice">A급 필수 질문부터 연습하기</button>`);
    startBtn.onclick = () => {
      const q = findOrCreateAiQuestion(firstA, "A");
      if (q) navigate("trainer", { qid: q.id });
    };
    box.appendChild(startBtn);
  }

  appendAiCleanSection(box, "핵심 활동 후보 TOP 3", "면접에서 깊게 설명하기 좋은 활동 후보입니다. 실제 경험과 일치하는 활동만 저장하세요.", data.coreActivities, (x) => aiFactCleanCard(x, "coreActivities"), false);
  appendAiCleanSection(box, "핵심 기록", "면접관이 확인하거나 꼬리질문으로 확장할 가능성이 있는 기록입니다.", data.coreRecords, (x) => aiFactCleanCard(x, "coreRecords"), false);
  appendAiCleanSection(box, "A · 반드시 준비할 질문", "가장 먼저 30초·60초로 말해보세요.", data.priorityA, (x) => aiQuestionCleanCard(x, "A", "A · 반드시 준비"), false);
  appendAiCleanSection(box, "B · 준비 권장 질문", "A 질문을 준비한 뒤 이어서 연습하세요.", data.priorityB, (x) => aiQuestionCleanCard(x, "B", "B · 준비 권장"), false);
  appendAiCleanSection(box, "설명이 필요한 부분", "성적 변화·진로 변화·선택과목·출결 등 실제 사실과 일치하는 경우에만 설명 준비에 추가하세요.", data.needsExplanation, (x) => aiFactCleanCard(x, "needsExplanation"), false);
  appendAiCleanSection(box, "예상 꼬리질문", "질문을 더 깊게 이어갈 때 대비할 항목입니다.", data.followUpQuestions, (x) => aiQuestionCleanCard(x, null, "꼬리질문"), false);
  appendAiCleanSection(box, "C · 여유가 있으면", "시간이 남을 때 확인하세요.", data.priorityC, (x) => aiQuestionCleanCard(x, "C", "C · 여유가 있으면"), true);
  appendAiCleanSection(box, "학생이 직접 확인할 내용", "AI가 단정할 수 없는 부분입니다. 원문과 공식자료를 직접 확인하세요.", data.needStudentVerification, (x) => aiVerificationCard(x), true);

  if (counts.priorityA > 0) {
    const action = el(`<div class="card ai-next-action"><strong>A급 질문부터 바로 연습하세요.</strong><p class="muted small">각 질문의 ‘30·60초 연습’을 누르면 자동으로 질문은행에 저장되고 말하기 훈련으로 이동합니다.</p></div>`);
    box.appendChild(action);
  }
}

function renderAiUnparsedResult(box, raw) {
  box.appendChild(el(`<div class="notice"><strong>AI 결과 형식을 자동으로 구분하지 못했습니다.</strong><br>분석 내용이 틀렸다는 뜻은 아닙니다. AI에게 “마지막에 요청한 JSON 형식으로 다시 출력해줘”라고 요청하면 결과를 항목별로 정리할 수 있습니다.</div>`));
  const details = el(`<details class="optional-panel"><summary>붙여넣은 AI 원문 보기</summary><div class="optional-panel-body"><pre class="preview-box">${escapeHtml(raw || "(내용 없음)")}</pre></div></details>`);
  box.appendChild(details);
}

function renderAiFeedbackResult(box, data) {
  box.appendChild(el(`<div class="card"><p class="label">잘한 점 1개</p><p>${escapeHtml(data.goodPoint || "(없음)")}</p></div>`));
  box.appendChild(el(`<div class="card"><p class="label">보완할 점 최대 2개</p><ul>${(data.improvements || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("") || "<li>(없음)</li>"}</ul></div>`));
  const follow = el(`<div class="card"><p class="label">예상 꼬리질문</p><div class="stack"></div></div>`);
  const inner = follow.querySelector(".stack");
  (data.followUpQuestions || []).forEach((q) => {
    const row = el(`<div class="row-between"><span>${escapeHtml(q)}</span><button class="btn-ghost small">질문은행에 추가</button></div>`);
    row.querySelector("button").onclick = () => { pushAiQuestion(q, null); row.querySelector("button").disabled = true; toast("꼬리질문을 질문은행에 추가했습니다."); };
    inner.appendChild(row);
  });
  if (!(data.followUpQuestions || []).length) inner.appendChild(el(`<p class="muted">꼬리질문이 없습니다.</p>`));
  box.appendChild(follow);
  box.appendChild(el(`<div class="notice small">잘한 점과 보완점은 피드백으로만 보여주며 질문은행에 자동 저장하지 않습니다.</div>`));
}

function buildAiResultCard(c, sectionKey, requireEditBeforeAdopt, requireFactVerification) {
  const card = el(`<div class="card ai-card">
    <div class="row-between"><span class="badge source-ai">AI 제안</span>
      <select class="status-select">
        <option ${c.status==='미검토'?'selected':''}>미검토</option>
        <option value="채택" ${c.status==='채택'?'selected':''} ${(requireEditBeforeAdopt && !c.edited) || (requireFactVerification && !c.factVerified) ? "disabled" : ""}>채택</option>
        <option ${c.status==='삭제'?'selected':''}>삭제</option>
      </select>
    </div>
    <textarea rows="2" class="ai-text">${escapeHtml(c.text)}</textarea>
    ${requireEditBeforeAdopt ? `<p class="muted small edit-hint">${c.edited ? "편집 완료 — 이제 채택할 수 있습니다." : "먼저 내용을 확인·수정해야 채택할 수 있습니다."}</p>` : ""}
    ${requireFactVerification ? `<label class="field checkbox fact-confirm"><input type="checkbox" ${c.factVerified ? "checked" : ""}> 학생부 원문 또는 내 실제 경험에서 사실임을 확인했습니다</label>` : ""}
  </div>`);
  const statusSelect = card.querySelector(".status-select");
  const textArea = card.querySelector(".ai-text");
  const refreshAdoptEnabled = () => {
    const opt = statusSelect.querySelector('option[value="채택"]');
    if (opt) opt.disabled = (requireEditBeforeAdopt && !c.edited) || (requireFactVerification && !c.factVerified);
  };
  const factCb = card.querySelector(".fact-confirm input");
  if (factCb) factCb.onchange = (e) => { c.factVerified = e.target.checked; refreshAdoptEnabled(); };
  textArea.oninput = (e) => {
    c.text = e.target.value;
    if (requireEditBeforeAdopt && !c.edited && c.text !== c.originalText) {
      c.edited = true;
      refreshAdoptEnabled();
      const hint = card.querySelector(".edit-hint");
      if (hint) hint.textContent = "편집 완료 — 이제 채택할 수 있습니다.";
    }
  };
  statusSelect.onchange = (e) => {
    c.status = e.target.value;
    if (c.status === "채택") {
      if ((requireEditBeforeAdopt && !c.edited) || (requireFactVerification && !c.factVerified)) { c.status = "미검토"; statusSelect.value = "미검토"; toast("채택 전 확인 조건을 완료하세요."); return; }
      const handler = AI_ADOPT_HANDLERS[sectionKey] || AI_ADOPT_HANDLERS.default;
      handler(c.text, c.priority);
      toast("채택했습니다.");
    }
  };
  return card;
}

function pushAiQuestion(text, priority) {
  const q = {
    id: uid("q"), recordId: null, direction: "ai", directionLabel: "AI 제안", text, hint: "",
    evidenceText: "", evidenceSection: "", source: "AI 제안", priority: priority || null,
    followUps: window.APP_DATA.followUpLayers.map((l) => ({ ...l, done: false, note: "" })),
  };
  AppState.questions.push(q);
  return q;
}
const AI_ADOPT_HANDLERS = {
  coreRecords: (text) => { AppState.records.push({ id: uid("rec"), section: "AI 확인 기록", text, tags: autoTagsFromText(text), tagsInitialized: true, source: "AI 제안(학생 확인)" }); },
  coreActivities: (text) => {
    if (AppState.activities.length >= 3) { toast("핵심활동은 이미 3개입니다. 기존 활동을 정리한 뒤 다시 시도하세요."); return; }
    AppState.activities.push({ id: uid("act"), recordId: null, name: text.slice(0, 20), situation: "", role: "", action: text, process: "", result: "", limit: "", link: "", summary: text.slice(0, 40) });
  },
  priorityA: (text) => pushAiQuestion(text, "A"),
  priorityB: (text) => pushAiQuestion(text, "B"),
  priorityC: (text) => pushAiQuestion(text, "C"),
  needsExplanation: (text) => { AppState.weaknessEntries.push({ category: "기타", accept: text, cause: "", effort: "", result: "" }); },
  followUpQuestions: (text) => pushAiQuestion(text, null),
  needStudentVerification: (text) => { AppState.aiVerificationNotes.push(text); },
  fallback: (text) => pushAiQuestion(text, null),
  default: (text) => pushAiQuestion(text, null),
};

// ── STEP9 30초·60초 훈련 (STAR/OREO, iOS 대응 녹음, 정직한 반복 카운터) ─
registerRoute("trainer", (params) => {
  const pool = AppState.questions.length ? AppState.questions : [{ text: "질문을 먼저 만들어주세요.", directionLabel: "" }];
  let current = (params && params.qid && pool.find((q) => q.id === params.qid)) || pool[Math.floor(Math.random() * pool.length)];
  let frame = "star";
  const attemptsByQuestion = new Map();
  const questionKey = () => current.id || current.text;
  const currentAttemptCount = () => attemptsByQuestion.get(questionKey()) || 0;

  const body = el(`<div class="stack">
    <div class="card">
      <p class="label">현재 질문</p>
      <p id="cur-q">${escapeHtml(current.text)}</p>
      <button class="btn-ghost small" id="random-btn">질문 랜덤 선택</button>
    </div>
    <label class="field"><span>프레임 선택</span>
      <select id="frame-select">
        <option value="star">${escapeHtml(window.APP_DATA.answerFrames.star.label)}</option>
        <option value="oreo">${escapeHtml(window.APP_DATA.answerFrames.oreo.label)}</option>
      </select>
    </label>
    <div id="frame-desc" class="notice small"></div>
    <div id="frame-steps" class="stack"></div>
    <div class="row-gap">
      <label class="field"><span>준비시간(초)</span><input id="prep-sec" type="number" value="10" min="0"></label>
    </div>
    <div class="timer-box">
      <div id="phase-label" class="phase-label">대기 중</div>
      <div id="timer-display" class="timer-display">--</div>
    </div>
    <div class="row-gap">
      <button class="btn-primary" id="start30">30초 훈련 시작</button>
      <button class="btn-primary" id="start60">60초 훈련 시작</button>
      <button class="btn-ghost" id="cancel-btn">중지</button>
    </div>
    <div id="rec-status" class="muted small"></div>
    <audio id="playback" controls style="display:none;width:100%"></audio>
    <p class="muted small" id="attempt-count">같은 질문 시도: 0회</p>
    <div class="notice small">세 번 모두 정확히 같은 문장을 외우려 하지 마세요. 키워드는 같아도 문장은 매번 달라져도 됩니다(이 앱은 실제 발화를 텍스트로 옮기지 않으므로, 문장이 똑같은지는 자동으로 판정하지 않습니다).</div>
    <section class="ai-highlight-card compact-ai-card" aria-label="내 답변 AI 피드백">
      <div class="ai-highlight-icon" aria-hidden="true">✨</div>
      <div class="ai-highlight-copy"><span class="ai-highlight-kicker">선택 기능 · 무료</span><h3>내 답변 AI 피드백</h3><p>연습한 답변을 직접 입력하면 AI가 답을 대신 써주지 않고 잘된 점 1개, 보완점 최대 2개, 꼬리질문을 제안합니다.</p></div>
      <button class="btn-ai-strong" onclick="navigateAiMode('feedback')">내 답변 점검</button>
    </section>
  </div>`);

  function renderFrame() {
    const f = window.APP_DATA.answerFrames[frame];
    body.querySelector("#frame-desc").textContent = f.desc;
    const stepsBox = body.querySelector("#frame-steps");
    stepsBox.innerHTML = "";
    f.steps.forEach((s) => stepsBox.appendChild(el(`<div class="field"><span class="chip">${escapeHtml(s.label)}</span> <span class="muted small">${escapeHtml(s.hint)}</span></div>`)));
  }
  renderFrame();
  body.querySelector("#frame-select").onchange = (e) => { frame = e.target.value; renderFrame(); };
  body.querySelector("#random-btn").onclick = () => {
    current = pool[Math.floor(Math.random() * pool.length)];
    body.querySelector("#cur-q").textContent = current.text;
    body.querySelector("#attempt-count").textContent = `같은 질문 시도: ${currentAttemptCount()}회`;
  };

  let trainer = null;
  let trainingActive = false;
  const setTrainingLocked = (locked) => {
    trainingActive = locked;
    body.querySelector("#start30").disabled = locked;
    body.querySelector("#start60").disabled = locked;
    body.querySelector("#random-btn").disabled = locked;
    body.querySelector("#frame-select").disabled = locked;
  };
  // 중요: getUserMedia는 버튼 클릭 이벤트의 첫 비동기 동작으로 바로 호출합니다.
  // 준비시간 타이머를 먼저 기다린 뒤에 마이크를 요청하면 iOS Safari 등에서
  // "사용자 제스처 직후"라는 조건이 깨져 권한 요청이 막힐 수 있습니다.
  async function runTraining(mainSeconds) {
    if (trainingActive) return;
    setTrainingLocked(true);
    trainer = new SpeakingTrainer({
      onTick: (remaining) => { body.querySelector("#timer-display").textContent = remaining + "s"; },
      onPhaseChange: (phase, seconds) => { body.querySelector("#phase-label").textContent = phase; body.querySelector("#timer-display").textContent = seconds + "s"; },
      onRecordingBlob: (blob) => {
        const url = URL.createObjectURL(blob);
        const audio = body.querySelector("#playback");
        audio.src = url; audio.style.display = "block";
      },
      onFallback: (msg) => { body.querySelector("#rec-status").textContent = msg; },
    });
    const recorded = await trainer.acquireStream(); // ← 클릭 직후 즉시 호출 (제스처 보존)
    if (trainer.cancelled) { trainer.releaseStream(); setTrainingLocked(false); return; }
    body.querySelector("#rec-status").textContent = recorded ? "마이크 확보됨. 준비시간 뒤 녹음이 시작됩니다." : "스톱워치 모드로 진행합니다.";

    try {
      const prepSec = parseInt(body.querySelector("#prep-sec").value, 10) || 0;
      if (prepSec > 0) {
        const prepDone = await trainer.runPhase(prepSec, "준비 시간");
        if (!prepDone) return;
      }

      let recordingStarted = false;
      if (recorded) {
        recordingStarted = trainer.beginRecording();
        body.querySelector("#rec-status").textContent = recordingStarted
          ? "녹음 중… (메모리에만 저장되며 새로고침 시 사라집니다)"
          : "녹음 시작에 실패하여 스톱워치 모드로 진행합니다.";
      }
      const mainDone = await trainer.runPhase(mainSeconds, mainSeconds === 30 ? "30초 답변" : "60초 답변");
      if (!mainDone) return;
      trainer.stopRecording();
      body.querySelector("#phase-label").textContent = "완료";
      const key = questionKey();
      const count = currentAttemptCount() + 1;
      attemptsByQuestion.set(key, count);
      body.querySelector("#attempt-count").textContent = `같은 질문 시도: ${count}회`;
    } finally {
      setTrainingLocked(false);
    }
  }
  body.querySelector("#start30").onclick = () => runTraining(30);
  body.querySelector("#start60").onclick = () => runTraining(60);
  body.querySelector("#cancel-btn").onclick = () => { if (trainer) trainer.cancel(); body.querySelector("#phase-label").textContent = "중지됨"; setTrainingLocked(false); };

  body.appendChild(buildFlowNav("trainer"));
  return screenShell("30초·60초 말하기 훈련", "키워드는 같아도 문장은 매번 달라져도 됩니다.", body);
});

// ── STEP10 모의면접 자가평가 (§30, 보완: 실제 상태 저장) ───────────────
registerRoute("mock-eval", () => {
  if (!AppState.mockEvaluation) AppState.mockEvaluation = { checks: {}, good: "", fix: "" };
  const me = AppState.mockEvaluation;
  const body = el(`<div class="stack"></div>`);
  Object.entries(window.APP_DATA.mockEvalItems).forEach(([cat, items]) => {
    const card = el(`<div class="card"><h3>${escapeHtml(cat)}</h3></div>`);
    items.forEach((it) => {
      const key = cat + "::" + it;
      const row = el(`<label class="field checkbox"><input type="checkbox" ${me.checks[key] ? "checked" : ""}> ${escapeHtml(it)}</label>`);
      row.querySelector("input").onchange = (e) => { me.checks[key] = e.target.checked; };
      card.appendChild(row);
    });
    body.appendChild(card);
  });
  const goodTa = el(`<label class="field"><span>잘한 점 1개</span><textarea rows="2">${escapeHtml(me.good)}</textarea></label>`);
  goodTa.querySelector("textarea").oninput = (e) => { me.good = e.target.value; };
  const fixTa = el(`<label class="field"><span>고칠 점 (최대 2개)</span><textarea rows="2">${escapeHtml(me.fix)}</textarea></label>`);
  fixTa.querySelector("textarea").oninput = (e) => { me.fix = e.target.value; };
  body.appendChild(goodTa); body.appendChild(fixTa);
  body.appendChild(el(`<button class="btn-primary" onclick="navigate('print-sheet')">저장하고 인쇄용으로 이동</button>`));
  body.appendChild(buildFlowNav("mock-eval"));
  return screenShell("모의면접 자가평가", "체크와 메모는 자동으로 저장됩니다. 피드백은 잘한 점 1개 + 고칠 점 최대 2개까지만.", body);
});

// ── 블라인드 위험표현 점검 (§31) ──────────────────────────────────────
registerRoute("blind-check", () => {
  const body = el(`<div class="stack">
    <div class="notice small">${escapeHtml(window.APP_DATA.blindRiskNote)}</div>
    <textarea id="blind-input" rows="6" placeholder="점검할 답변을 붙여넣으세요"></textarea>
    <button class="btn-primary" id="check-btn">위험 후보 점검</button>
    <div id="blind-result" class="stack"></div>
  </div>`);
  body.querySelector("#check-btn").onclick = () => {
    const text = body.querySelector("#blind-input").value;
    const result = body.querySelector("#blind-result");
    result.innerHTML = "";
    const patterns = {
      school: [/[가-힣A-Za-z0-9]+(?:고등학교|고교)/g, /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별자치도|특별자치시|광역시|도|시)?/g],
      score: [/\d+(?:\.\d+)?\s*등급/g, /전교\s*\d+\s*등/g, /백분위\s*\d+/g, /모의고사\s*\d+/g],
      award: [/[가-힣A-Za-z0-9]+(?:학원|대회|센터|기관)/g, /(?:대상|금상|은상|동상|최우수상|우수상)/g],
      name: [/[가-힣]{2,4}\s*(?:선생님|교사|교수님|교수)/g],
    };
    window.APP_DATA.blindRiskCategories.forEach((cat) => {
      const regs = patterns[cat.id] || [];
      const hits = regs.flatMap((re) => Array.from(text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))).map((m) => m[0]));
      if (hits.length) {
        const uniq = Array.from(new Set(hits)).slice(0, 5);
        result.appendChild(el(`<div class="card">
          <p><strong>블라인드 규정 확인 필요</strong> — ${escapeHtml(cat.label)}</p>
          <p class="muted small">탐지 예: ${escapeHtml(uniq.join(" / "))}</p>
          <label class="field checkbox"><input type="checkbox"> 대학별 블라인드 안내문에서 확인했다</label>
        </div>`));
      }
    });
    if (!result.children.length) result.appendChild(el(`<p class="muted">뚜렷한 위험 후보가 발견되지 않았습니다. (탐지되지 않았다고 안전이 보장되는 것은 아닙니다)</p>`));
  };
  body.appendChild(buildFlowNav("blind-check"));
  return screenShell("블라인드 위험표현 점검", "'위반'이라 단정하지 않습니다. 확인이 필요한 후보만 보여줍니다.", body);
});

// ── 위기 대응 카드 (§32) ──────────────────────────────────────────────
registerRoute("crisis-card", () => {
  const body = el(`<div class="stack">${window.APP_DATA.crisisCards.map((c) => `
    <div class="card"><p class="label">${escapeHtml(c.situation)}</p><p class="crisis-line">${escapeHtml(c.line)}</p></div>
  `).join("")}</div>`);
  return screenShell("위기 대응 카드", "언제든 열어보세요.", body);
});

// ── 빈출 12유형 (§33, 보완: 실제 상태 저장) ────────────────────────────
registerRoute("common12", () => {
  if (!AppState.commonAnswers) AppState.commonAnswers = {};
  const body = el(`<div class="stack">${window.APP_DATA.common12.map((c) => `
    <div class="card" data-id="${c.id}">
      <p class="label">${escapeHtml(c.label)} ${c.optional ? '<span class="badge">선택</span>' : ""}</p>
      ${c.note ? `<p class="muted small">${escapeHtml(c.note)}</p>` : ""}
      <textarea rows="2" placeholder="키워드로 적기">${escapeHtml(AppState.commonAnswers[c.id] || "")}</textarea>
    </div>`).join("")}
    <button class="btn-ghost" onclick="navigate('student-dashboard')">학생 홈으로</button>
  </div>`);
  body.querySelectorAll(".card[data-id]").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector("textarea").addEventListener("input", (e) => { AppState.commonAnswers[id] = e.target.value; });
  });
  return screenShell("빈출 공통질문 12유형", "문장이 아니라 키워드로 적습니다(자동 저장됩니다). 자기소개·마지막 할 말은 묻지 않는 대학도 많습니다.", body);
});

// ── 특수 면접 / 제시문 모드 (§34) ─────────────────────────────────────
registerRoute("special-track", () => {
  const uni = getActiveUniversity();
  const trackId = uni?.specialTrack && uni.specialTrack !== "none" ? uni.specialTrack : null;
  const body = el(`<div class="stack"></div>`);
  const effectiveType = effectiveInterviewType(uni);
  if (effectiveType === "제시문 기반") {
    body.appendChild(el(`<div class="notice">${escapeHtml(window.APP_DATA.presentationModeNote)}</div>`));
    body.appendChild(el(`<label class="field"><span>내가 찾은 기출 제시문 붙여넣기</span><textarea rows="6" id="prompt-paste"></textarea></label>`));
    body.appendChild(el(`<label class="field"><span>준비시간(초)</span><input type="number" id="prep-timer-sec" value="600"></label>`));
    const timerDisplay = el(`<div class="timer-display" id="prompt-timer">--</div>`);
    body.appendChild(timerDisplay);
    const startBtn = el(`<button class="btn-primary">준비시간 타이머 시작</button>`);
    let iv = null;
    startBtn.onclick = () => {
      let remain = parseInt(body.querySelector("#prep-timer-sec").value, 10) || 0;
      clearInterval(iv);
      iv = setInterval(() => { remain--; timerDisplay.textContent = remain + "s"; if (remain <= 0) clearInterval(iv); }, 1000);
    };
    body.appendChild(startBtn);
    body.appendChild(el(`<div class="card"><h3>제시문 메모 3단계</h3>
      <label class="field"><span>① 비교 · 무엇이 같고 다른가</span><textarea rows="2" placeholder="공통점/차이점 키워드"></textarea></label>
      <label class="field"><span>② 적용 · 제시문의 관점을 새 상황에 적용</span><textarea rows="2" placeholder="어떤 기준을 어디에 적용할지"></textarea></label>
      <label class="field"><span>③ 확장 · 한계·반론·새로운 맥락</span><textarea rows="2" placeholder="반론, 한계, 추가 조건"></textarea></label>
      <p class="muted small">문장을 완성해서 외우기보다 준비실에서 쓸 키워드 메모처럼 적어보세요.</p>
    </div>`));
  }
  const trackData = trackId ? window.APP_DATA.specialTrackQuestions[trackId] : null;
  if (trackData) {
    body.appendChild(el(`<div class="card"><h3>${escapeHtml(trackData.label)}</h3>
      <p class="muted small">프레임: ${trackData.framework.join(" · ")}</p>
      <ul>${trackData.samples.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
      <p class="notice small">대학별 실제 문항을 이 앱이 임의로 만들지 않습니다. 예시일 뿐입니다.</p>
    </div>`));
  } else if (effectiveType !== "제시문 기반" && effectiveType !== "다중 미니(MMI)") {
    body.appendChild(el(`<p class="muted">해당 계열이 지정되지 않았습니다(기본값은 "해당 없음"). 유형 판별 화면에서 계열 태그를 지정하세요.</p>`));
  }
  if (effectiveType === "집단·토론") {
    body.appendChild(el(`<div class="notice">${escapeHtml(window.APP_DATA.groupDiscussionNote)}</div>`));
  }
  if (effectiveType === "다중 미니(MMI)") {
    body.appendChild(el(`<div class="card"><h3>MMI 방 이동 훈련</h3>
      <p class="muted small">각 방은 새 평가라고 생각하고 이전 방의 실수를 다음 방으로 끌고 가지 않는 연습을 합니다.</p>
      <label class="field"><span>문 앞 준비 · 상황의 핵심</span><textarea rows="2" placeholder="누가, 어떤 문제에 놓였는가"></textarea></label>
      <label class="field"><span>내 판단</span><textarea rows="2" placeholder="먼저 무엇을 하겠는가"></textarea></label>
      <label class="field"><span>판단 근거와 상대 관점</span><textarea rows="2" placeholder="왜 그렇게 판단했는가 / 상대는 어떻게 볼 수 있는가"></textarea></label>
      <label class="field checkbox"><input type="checkbox"> 이 방을 마치고 5초 안에 리셋하고 다음 방으로 넘어가는 연습을 했다</label>
    </div>`));
  }
  body.appendChild(el(`<button class="btn-ghost" onclick="navigate('student-dashboard')">학생 홈으로</button>`));
  return screenShell("특수 면접 / 제시문 대비", "해당하는 학생에게만 필요한 화면입니다.", body);
});

// ── 면접 직전 모드 / 인쇄 한 장 (§35, §36) ────────────────────────────
registerRoute("print-sheet", () => {
  const uni = getActiveUniversity();
  const dd = uni ? daysUntil(uni.interviewDate) : null;
  const s = AppState;
  const body = el(`<div class="stack">
    ${dd !== null && dd <= 3 ? '<div class="notice">면접 직전 모드입니다. 새 예상질문을 많이 만들기보다, 이미 준비한 것을 점검하세요.</div>' : ''}
    <label class="field"><span>30초 자기소개 키워드 (60자 이내)</span><input id="p-intro" maxlength="60" value="${escapeHtml(s.introKeywords||"")}"></label>
    <label class="field"><span>마지막 할 말 (60자 이내)</span><input id="p-last" maxlength="60" value="${escapeHtml(s.lastWord||"")}"></label>
    <button class="btn-primary" id="save-print-btn">저장</button>
    <button class="btn-secondary" id="open-print-btn">면접장에 가져갈 한 장 열기 (인쇄)</button>
    <p class="muted small">학생부 원문 전체는 인쇄물에 넣지 않습니다. 실전 면접실 반입 가능 여부는 대학 안내를 확인하세요. 브라우저·프린터 여백 설정에 따라 실제 출력 결과를 한 번 확인해 보세요.</p>
  </div>`);
  body.querySelector("#save-print-btn").onclick = () => {
    s.introKeywords = body.querySelector("#p-intro").value;
    s.lastWord = body.querySelector("#p-last").value;
    toast("저장했습니다.");
  };
  body.querySelector("#open-print-btn").onclick = () => openPrintView(s);
  body.appendChild(buildFlowNav("print-sheet"));
  return screenShell("면접 직전 모드", "", body);
});

// ── 학부모 모드 (§37) ────────────────────────────────────────────────
registerRoute("parent-mode", () => {
  const g = window.APP_DATA.parentGuide;
  const near = nearestUniversity();
  const body = el(`<div class="stack">
    <div class="card">
      <h3>가장 가까운 면접</h3>
      <p>${near ? `${escapeHtml(near.name)} — ${escapeHtml(fmtDday(daysUntil(near.interviewDate)))}` : "등록된 일정이 없습니다."}</p>
    </div>
    <div class="card"><h3>부모가 할 일</h3><ul>${g.todo.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>
    <div class="card"><h3>도움이 되는 말</h3><ul>${g.goodLines.map((t) => `<li>"${escapeHtml(t)}"</li>`).join("")}</ul></div>
    <div class="card warn"><h3>피해야 할 말</h3><ul>${g.avoidLines.map((t) => `<li>"${escapeHtml(t)}"</li>`).join("")}</ul></div>
    <button class="btn-secondary" onclick="window.print()">이 화면 인쇄하기 (A4 앞뒤 약 2쪽)</button>
    <button class="btn-ghost" onclick="navigate('roadmap')">D-Day 로드맵 보기</button>
  </div>`);
  return screenShell("학부모 면접 가이드", "가정에서 무엇을, 어떻게 도울지.", body);
});

// ── 면접 후기 기록 (§38~39) ──────────────────────────────────────────
registerRoute("interview-log", () => {
  const body = el(`<div class="stack">
    <div class="notice small">이름·학번·학교명 입력은 요구하지 않습니다.</div>
    <label class="field"><span>대학</span><input id="l-uni"></label>
    <label class="field"><span>학과</span><input id="l-major"></label>
    <label class="field"><span>전형</span><input id="l-track"></label>
    <label class="field"><span>면접유형</span><input id="l-type"></label>
    <label class="field"><span>면접관 수</span><input id="l-count"></label>
    <label class="field"><span>실제 받은 질문 (줄바꿈으로 구분)</span><textarea id="l-questions" rows="4"></textarea></label>
    <label class="field"><span>가장 어려웠던 꼬리질문</span><textarea id="l-followup" rows="2"></textarea></label>
    <label class="field"><span>예상과 달랐던 운영</span><textarea id="l-unexpected" rows="2"></textarea></label>
    <label class="field"><span>가장 아쉬웠던 답</span><textarea id="l-regret" rows="2"></textarea></label>
    <label class="field"><span>다음에 바꿀 점 (최대 2개, 줄바꿈)</span><textarea id="l-changes" rows="2"></textarea></label>
    <button class="btn-primary" id="save-log-btn">기록 저장</button>
    <hr class="divider">
    <div id="log-list" class="stack"></div>
    <div class="row-gap">
      <button class="btn-secondary" id="export-csv">CSV 내보내기</button>
      <button class="btn-ghost" id="export-anon">학교 공유용(익명) 내보내기</button>
    </div>
    <div id="submit-area"></div>
  </div>`);
  body.querySelector("#save-log-btn").onclick = () => {
    const g = (id) => body.querySelector(id).value;
    AppState.interviewLogs.push({
      id: uid("log"), university: g("#l-uni"), major: g("#l-major"), track: g("#l-track"), type: g("#l-type"),
      interviewerCount: g("#l-count"), questions: g("#l-questions").split("\n").filter(Boolean),
      hardestFollowUp: g("#l-followup"), unexpected: g("#l-unexpected"), regret: g("#l-regret"),
      changes: g("#l-changes").split("\n").filter(Boolean).slice(0, 2),
    });
    toast("면접 후기를 저장했습니다.");
    renderLogList();
  };
  function renderLogList() {
    const box = body.querySelector("#log-list");
    box.innerHTML = "";
    AppState.interviewLogs.forEach((l) => box.appendChild(el(`<div class="card"><strong>${escapeHtml(l.university)} ${escapeHtml(l.major)}</strong><p class="muted small">${escapeHtml((l.questions||[]).join(" / "))}</p></div>`)));
  }
  renderLogList();
  body.querySelector("#export-csv").onclick = () => exportInterviewLogsCsv(AppState.interviewLogs);
  body.querySelector("#export-anon").onclick = () => exportInterviewLogsAnonymized(AppState.interviewLogs);

  const submitArea = body.querySelector("#submit-area");
  if (window.APP_CONFIG.AFTER_INTERVIEW_FORM_URL) {
    const btn = el(`<button class="btn-primary">면접 후기 학교에 제출하기</button>`);
    btn.onclick = () => {
      const ok = confirm("제출 전 확인: 학교명·학생 이름·다른 학생을 특정할 수 있는 표현이 없는지 확인하셨습니까? 외부 폼의 개인정보 처리방침은 학교가 별도 안내합니다.");
      if (ok) window.open(window.APP_CONFIG.AFTER_INTERVIEW_FORM_URL, "_blank");
    };
    submitArea.appendChild(btn);
  }
  return screenShell("면접 후기 기록", "끝나자마자 적으세요. 하루만 지나도 기억이 사라집니다.", body);
});

// ── 데이터 저장/불러오기 (보완: 항목별 포함 여부 선택 + 근거문장 기본 제외) ──
registerRoute("data-io", () => {
  const body = el(`<div class="stack">
    <div class="notice">이 파일에는 대학 정보·활동·질문·후기 등 준비 데이터가 담깁니다. 공용 기기·공용 클라우드에 저장하지 마세요.</div>
    <p class="label">내보낼 항목 선택</p>
    <div class="notice small">생활기록부 없이 직접 입력한 활동·기록은 작업 복원을 위해 기본 백업됩니다. 학생부에서 파생된 정리 기록은 아래에서 별도로 선택해야 포함됩니다.</div>
    <label class="field checkbox"><input type="checkbox" id="opt-uni" checked> 대학 정보(대학명·학과·면접일 등)</label>
    <label class="field checkbox"><input type="checkbox" id="opt-record-derived"> 학생부에서 파생된 정리 기록까지 포함 (기본 해제 — 학생부 내용 일부가 들어갑니다)</label>
    <label class="field checkbox"><input type="checkbox" id="opt-act" checked> 핵심활동</label>
    <label class="field checkbox"><input type="checkbox" id="opt-q" checked> 질문·우선순위</label>
    <label class="field checkbox"><input type="checkbox" id="opt-log" checked> 면접 후기</label>
    <label class="field checkbox"><input type="checkbox" id="opt-weak" checked> 설명이 필요한 기록</label>
    <label class="field checkbox"><input type="checkbox" id="opt-evidence"> 질문의 학생부 근거 문장까지 포함 (기본 해제 — 세특 등 학생부 실제 문장이 그대로 담깁니다)</label>
    <button class="btn-primary" id="export-btn">내 준비 데이터 저장 (JSON)</button>
    <hr class="divider">
    <label class="field"><span>JSON 파일 불러오기</span><input type="file" accept="application/json" id="import-file"></label>
    <div id="import-status" class="muted small"></div>
  </div>`);
  body.querySelector("#export-btn").onclick = () => {
    exportStateAsJson(AppState, {
      includeUniversities: body.querySelector("#opt-uni").checked,
      includeRecordDerived: body.querySelector("#opt-record-derived").checked,
      includeActivities: body.querySelector("#opt-act").checked,
      includeQuestions: body.querySelector("#opt-q").checked,
      includeLogs: body.querySelector("#opt-log").checked,
      includeWeakness: body.querySelector("#opt-weak").checked,
      includeEvidence: body.querySelector("#opt-evidence").checked,
    });
  };
  body.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    const result = importStateFromJson(text);
    body.querySelector("#import-status").textContent = result.ok ? "불러오기 완료." : result.reason;
    if (result.ok) toast("데이터를 불러왔습니다.");
  });
  return screenShell("내 준비 데이터", "", body);
});
