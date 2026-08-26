/**
 * screens.js (1/2)
 * 각 화면을 만들어 반환하는 함수들을 라우터에 등록합니다.
 */

function screenShell(title, subtitle, bodyEl, opts) {
  opts = opts || {};
  const wrap = el(`<div class="screen"></div>`);
  if (!opts.noBack) {
    wrap.appendChild(el(`<button class="link-back" onclick="history.back()">← 뒤로</button>`));
  }
  if (title) wrap.appendChild(el(`<h1 class="screen-title">${escapeHtml(title)}</h1>`));
  if (subtitle) wrap.appendChild(el(`<p class="screen-subtitle">${escapeHtml(subtitle)}</p>`));
  const routeName = currentRoute().name;
  if (typeof FLOW_STEPS !== "undefined" && FLOW_STEPS.some((s) => s.route === routeName) && AppState.universities.length) {
    const active = getActiveUniversity();
    if (active) wrap.appendChild(el(`<div class="active-uni-banner"><span>현재 준비 대학</span><strong>${escapeHtml(active.name || "(대학명 미입력)")} · ${escapeHtml(active.major || "")}</strong></div>`));
  }
  wrap.appendChild(bodyEl);
  return wrap;
}

// ── 홈 ──────────────────────────────────────────────────────────────
registerRoute("home", () => {
  const body = el(`<div class="menu-grid">
    <button class="menu-card primary-menu" onclick="navigate('student-dashboard')">
      <span class="menu-emoji" aria-hidden="true">🎯</span>
      <span class="menu-title">학생 면접 준비</span>
      <span class="menu-desc">생활기록부 전체를 AI로 분석해 활동별 면접문항까지</span>
    </button>
    <button class="menu-card" onclick="navigate('parent-mode')">
      <span class="menu-emoji" aria-hidden="true">🏠</span>
      <span class="menu-title">학부모 면접 가이드</span>
      <span class="menu-desc">가정에서 도울 일과 하지 말아야 할 일</span>
    </button>
    <button class="menu-card" onclick="navigate('interview-log')">
      <span class="menu-emoji" aria-hidden="true">📝</span>
      <span class="menu-title">면접 후기 기록</span>
      <span class="menu-desc">실제 받은 질문을 간단히 남기기</span>
    </button>
  </div>
  <div class="home-footer">
    <button class="btn-ghost small" onclick="navigate('data-io')">내 준비 데이터 저장/불러오기</button>
    <button class="btn-ghost small" onclick="navigate('crisis-card')">위기 대응 카드</button>
    <button class="btn-ghost small" id="theme-toggle-btn" onclick="toggleTheme()">🌙 어둡게</button>
  </div>`);
  return screenShell(window.APP_CONFIG.APP_NAME,
    "복잡한 체크 없이 자료를 넣고, 원하는 AI로 생활기록부 전체 활동과 면접문항을 분석합니다.",
    body, { noBack: true });
});

// ── 학생 빠른 시작 — 기본 사용자는 여기서 체크박스를 만지지 않습니다 ─────
registerRoute("student-dashboard", () => {
  const body = el(`<div class="stack"></div>`);
  body.appendChild(el(`<div class="hero-card ai-first-hero">
    <div class="hero-kicker">AI 분석 중심 · 무료 · API 없음</div>
    <h2>생활기록부를 넣고, AI가 전체 활동을 빠짐없이 훑게 하세요</h2>
    <p>프로그램이 짧은 규칙으로 질문을 억지로 만들지 않습니다. 생활기록부 텍스트를 안전하게 추출한 뒤, 사용자가 선택한 AI가 <strong>전체 활동 목록 → 활동별 예상질문 → A급 필수질문 → 핵심활동 심화</strong> 순으로 분석하도록 프롬프트를 만듭니다.</p>
    <button class="btn-primary big" id="quick-pdf-btn">1. 생활기록부 PDF 넣기</button>
    <button class="btn-secondary" id="quick-no-record-btn">생활기록부 없이 내 활동으로 시작</button>
    <div class="ai-meta-row"><span>서버 저장 없음</span><span>ChatGPT · Claude · Gemini</span><span>프롬프트 복사 방식</span></div>
  </div>`));
  body.querySelector("#quick-pdf-btn").onclick = () => navigate("record-import");
  body.querySelector("#quick-no-record-btn").onclick = () => navigate("no-record-input");

  const hasRecordAi = hasImportedStudentRecord();
  const hasActivityAi = hasDirectActivityRecords();
  if (AppState.aiResultSections) {
    body.appendChild(el(`<button class="btn-primary big" onclick="navigate('ai-results')">최근 AI 전체 분석 결과 다시 보기</button>`));
  }
  if (hasRecordAi) {
    body.appendChild(el(`<section class="ai-highlight-card ai-primary-card" aria-label="생활기록부 전체 AI 면접문항 분석">
      <div class="ai-highlight-icon" aria-hidden="true">AI</div>
      <div class="ai-highlight-copy">
        <span class="ai-highlight-kicker">가장 먼저 할 일</span>
        <h3>생활기록부 전체 면접문항 AI 분석</h3>
        <p>TOP3부터 고르지 않습니다. 먼저 생활기록부의 의미 있는 수업·세특·진로·자율·동아리·공동체 활동을 <strong>가능한 한 모두 찾아 목록화</strong>하고, 활동마다 기본질문과 심화질문을 만든 뒤 중요도를 A/B/C로 분류합니다.</p>
        <div class="ai-meta-row"><span>전체 활동 인벤토리</span><span>활동별 질문</span><span>누락 점검</span></div>
      </div>
      <button class="btn-ai-strong" onclick="navigateAiMode('record-full')">전체 AI 분석 시작</button>
    </section>`));

    if (AppState.aiResultSections) {
      body.appendChild(el(`<section class="ai-highlight-card" aria-label="핵심활동 AI 심화분석">
        <div class="ai-highlight-icon" aria-hidden="true">深</div>
        <div class="ai-highlight-copy">
          <span class="ai-highlight-kicker">전체 분석 다음 단계</span>
          <h3>핵심활동 TOP 3 심화분석</h3>
          <p>전체 활동을 먼저 확인한 뒤, 면접에서 가장 중요한 활동 몇 개만 사실 → 과정·판단 → 개념 → 역할 → 한계 → 전공연결까지 깊게 파고듭니다.</p>
        </div>
        <button class="btn-secondary" onclick="navigateAiMode('record-deep')">핵심활동 심화분석</button>
      </section>`));
    }
  }
  if (hasActivityAi) {
    body.appendChild(el(`<section class="ai-highlight-card ai-primary-card" aria-label="내 활동 전체 AI 분석">
      <div class="ai-highlight-icon" aria-hidden="true">AI</div>
      <div class="ai-highlight-copy">
        <span class="ai-highlight-kicker">생활기록부 없이 사용</span>
        <h3>내 활동 전체 AI 면접문항 분석</h3>
        <p>직접 적은 활동을 빠짐없이 훑어 활동별 예상질문과 꼬리질문을 만들고, 반드시 준비할 질문을 다시 골라줍니다.</p>
      </div>
      <button class="btn-ai-strong" onclick="navigateAiMode('activity-full')">내 활동 전체 AI 분석</button>
    </section>`));
  }

  const active = getActiveUniversity();
  const opt = el(`<details class="optional-panel" ${active ? "open" : ""}>
    <summary>지원 대학·학과 입력 <span class="muted small">(선택)</span></summary>
    <div class="stack optional-panel-body">
      <p class="muted small">대학·학과를 입력하면 AI가 전공 연결과 평가요소를 조금 더 맞춤화합니다. 몰라도 전체 생활기록부 분석은 가능합니다.</p>
      <div class="grid-2">
        <label class="field"><span>대학명</span><input id="quick-uni-name" value="${escapeHtml(active?.name || "")}" placeholder="예: ○○대학교"></label>
        <label class="field"><span>학과명</span><input id="quick-uni-major" value="${escapeHtml(active?.major || "")}" placeholder="예: 기계공학과"></label>
      </div>
      <label class="field"><span>전형명</span><input id="quick-uni-track" value="${escapeHtml(active?.track || "")}" placeholder="알고 있으면 입력"></label>
      <button class="btn-secondary" id="save-quick-uni">저장</button>
      <button class="btn-ghost small" onclick="navigate('universities')">면접시간·평가요소 등 상세정보 입력</button>
    </div>
  </details>`);
  opt.querySelector("#save-quick-uni").onclick = () => {
    const name = opt.querySelector("#quick-uni-name").value.trim();
    const major = opt.querySelector("#quick-uni-major").value.trim();
    const track = opt.querySelector("#quick-uni-track").value.trim();
    let uni = getActiveUniversity();
    if (!uni) {
      uni = { id: uid("uni"), name, major, track, interviewDate:"", checkInTime:"", location:"", duration:"", prepTime:"", interviewerCount:"", ratio:"", stageType:"일괄합산", evalWeights:"", blind:"미확인", promptBased:"미확인", docBased:"미확인", memoAllowed:"미확인", officialChecked:false, schoolViolenceNote:"", typeGuess:"", typeGuessOverride:"", specialTrack:"none", memo:"", sourceLog:[] };
      AppState.universities.push(uni); AppState.activeUniversityId = uni.id;
    } else { uni.name = name; uni.major = major; uni.track = track; }
    toast("지원 정보를 저장했습니다.");
  };
  body.appendChild(opt);

  const advanced = el(`<details class="optional-panel">
    <summary>추가 면접 준비 도구 <span class="muted small">(선택)</span></summary>
    <div class="optional-panel-body stack">
      <div class="notice small"><strong>면접문항 생성은 AI 전체분석이 담당합니다.</strong> 아래 도구는 일정·블라인드·공통질문처럼 분석 이후에 필요한 보조 기능입니다.</div>
      <div class="tool-grid">
        <button class="btn-ghost small" onclick="navigate('type-helper')">면접유형 확인</button>
        <button class="btn-ghost small" onclick="navigate('roadmap')">D-Day 로드맵</button>
        <button class="btn-ghost small" onclick="navigate('blind-check')">블라인드 점검</button>
        <button class="btn-ghost small" onclick="navigate('common12')">빈출 12유형</button>
      </div>
    </div>
  </details>`);
  body.appendChild(advanced);
  return screenShell("학생 면접 준비", "AI 전체 분석을 중심으로, 사용자는 생활기록부를 넣고 결과를 연습하면 됩니다.", body, { noBack: true });
});

function startWithoutRecord() { navigate("no-record-input"); }

registerRoute("no-record-input", () => {
  const compactPrompts = [
    "가장 의미 있었던 수업·탐구·프로젝트는 무엇이었나요?",
    "내가 직접 맡아서 한 일이 분명한 활동은 무엇인가요?",
    "예상대로 되지 않아 수정·보완했던 경험이 있나요?",
    "친구들과 협력하거나 갈등을 조정했던 경험이 있나요?",
    "진로·전공과 연결해 이야기하고 싶은 경험이 있나요?",
  ];
  const body = el(`<div class="stack" id="no-record-form">
    <div class="notice small">모든 칸을 채울 필요는 없습니다. 기억나는 활동만 짧게 적어도 면접질문을 만들 수 있습니다.</div>
  </div>`);
  compactPrompts.forEach((p, i) => body.appendChild(el(`<label class="field"><span>${i+1}. ${escapeHtml(p)}</span><textarea rows="2" data-idx="${i}" placeholder="키워드나 짧은 문장으로 적어도 됩니다"></textarea></label>`)));
  const saveBtn = el(`<button class="btn-primary big">입력한 활동 전체를 AI로 분석하기</button>`);
  saveBtn.onclick = () => {
    const values = Array.from(body.querySelectorAll("textarea")).map((t) => t.value.trim()).filter(Boolean);
    if (!values.length) { toast("활동을 한 가지 이상 적어주세요."); return; }
    // 이전 직접입력 기록은 유지하되 완전히 동일한 문장은 중복 추가하지 않습니다.
    values.forEach((v) => {
      if (!AppState.records.some((r) => r.source === "직접 입력" && r.text === v)) {
        AppState.records.push({ id: uid("rec"), section: "직접 입력", text: v, tags: [], tagsInitialized: false, source: "직접 입력" });
      }
    });
    navigateAiMode("activity-full");
  };
  body.appendChild(saveBtn);
  return screenShell("생활기록부 없이 시작", "기억나는 활동을 적으면 AI가 전체 활동을 훑어 면접질문으로 정리합니다.", body);
});

// ── STEP1 대학별 면접정보 ────────────────────────────────────────────
registerRoute("universities", () => {
  const body = el(`<div class="stack"></div>`);
  const listBox = el(`<div class="stack" id="uni-list"></div>`);
  body.appendChild(listBox);
  renderUniList(listBox);
  const addBtn = el(`<button class="btn-primary">+ 대학 추가</button>`);
  addBtn.onclick = () => { openUniEditor(null, () => renderUniList(listBox)); };
  body.appendChild(addBtn);
  body.appendChild(buildFlowNav("universities"));
  return screenShell("내 면접 정보", "지원한 대학 가운데 면접이 있는 전형만 등록하세요. 복수 등록 가능합니다.", body);
});

function renderUniList(box) {
  box.innerHTML = "";
  if (!AppState.universities.length) {
    box.appendChild(el(`<p class="muted">아직 등록된 대학이 없습니다.</p>`));
  }
  AppState.universities.forEach((u) => {
    const dd = daysUntil(u.interviewDate);
    const card = el(`<div class="card uni-card">
      <div class="uni-card-head">
        <strong>${escapeHtml(u.name || "(대학명 미입력)")}</strong>
        <span class="badge">${escapeHtml(fmtDday(dd))}</span>
      </div>
      <p>${escapeHtml(u.major || "")} · ${escapeHtml(u.track || "")}</p>
      <p class="muted small">면접유형: ${escapeHtml(effectiveInterviewType(u) || "미판별")}</p>
      <div class="row-actions">
        <button class="btn-ghost small">수정</button>
        <button class="btn-ghost small danger">삭제</button>
      </div>
    </div>`);
    card.querySelector(".danger").onclick = () => {
      AppState.universities = AppState.universities.filter((x) => x.id !== u.id);
      if (AppState.activeUniversityId === u.id) AppState.activeUniversityId = AppState.universities[0]?.id || null;
      renderUniList(box);
    };
    card.querySelectorAll(".btn-ghost")[0].onclick = () => openUniEditor(u, () => renderUniList(box));
    box.appendChild(card);
  });
}

function openUniEditor(existing, onDone) {
  const isNew = !existing;
  const u = existing || {
    id: uid("uni"), name: "", major: "", track: "", interviewDate: "", checkInTime: "",
    location: "", duration: "", prepTime: "", interviewerCount: "", ratio: "",
    stageType: "일괄합산", evalWeights: "", blind: "미확인", promptBased: "미확인",
    docBased: "미확인", memoAllowed: "미확인", officialChecked: false, schoolViolenceNote: "",
    typeGuess: "", typeGuessOverride: "", specialTrack: "none", memo: "",
    sourceLog: [], // {label, checkedDate}
  };
  if (!u.specialTrack) u.specialTrack = "none"; // 기본값을 코드에서도 한 번 더 강제
  const modal = el(`<div class="modal-backdrop"><div class="modal card">
    <h2>${isNew ? "대학 추가" : "대학 정보 수정"}</h2>
    <div class="grid-2">
      <label class="field"><span>대학명</span><input id="f-name" value="${escapeHtml(u.name)}"></label>
      <label class="field"><span>학과명</span><input id="f-major" value="${escapeHtml(u.major)}"></label>
      <label class="field"><span>전형명</span><input id="f-track" value="${escapeHtml(u.track)}"></label>
      <label class="field"><span>면접일</span><input type="date" id="f-date" value="${escapeHtml(u.interviewDate)}"></label>
      <label class="field"><span>입실 시각</span><input id="f-checkin" value="${escapeHtml(u.checkInTime)}"></label>
      <label class="field"><span>면접 장소</span><input id="f-loc" value="${escapeHtml(u.location)}"></label>
      <label class="field"><span>면접 진행시간</span><input id="f-duration" placeholder="예: 10분" value="${escapeHtml(u.duration)}"></label>
      <label class="field"><span>별도 준비시간</span><input id="f-prep" placeholder="예: 15분 / 없음" value="${escapeHtml(u.prepTime)}"></label>
      <label class="field"><span>면접관 수</span><input id="f-interviewers" value="${escapeHtml(u.interviewerCount)}"></label>
      <label class="field"><span>면접 반영 비율</span><input id="f-ratio" value="${escapeHtml(u.ratio)}"></label>
      <label class="field"><span>단계형/일괄합산</span>
        <select id="f-stage"><option ${u.stageType === "일괄합산" ? "selected" : ""}>일괄합산</option><option ${u.stageType === "단계형" ? "selected" : ""}>단계형</option></select>
      </label>
      <label class="field"><span>평가요소와 배점</span><input id="f-weights" placeholder="예: 진로40·공동체30·학업30" value="${escapeHtml(u.evalWeights)}"></label>
      <label class="field"><span>블라인드 여부</span>
        <select id="f-blind"><option ${u.blind==="미확인"?"selected":""}>미확인</option><option ${u.blind==="시행"?"selected":""}>시행</option><option ${u.blind==="미시행"?"selected":""}>미시행</option></select>
      </label>
      <label class="field"><span>제시문 여부</span>
        <select id="f-prompt"><option ${u.promptBased==="미확인"?"selected":""}>미확인</option><option ${u.promptBased==="있음"?"selected":""}>있음</option><option ${u.promptBased==="없음"?"selected":""}>없음</option></select>
      </label>
      <label class="field"><span>제출서류 기반 여부</span>
        <select id="f-docbased"><option ${u.docBased==="미확인"?"selected":""}>미확인</option><option ${u.docBased==="예"?"selected":""}>예</option><option ${u.docBased==="아니오"?"selected":""}>아니오</option></select>
      </label>
      <label class="field"><span>메모 허용 여부</span>
        <select id="f-memoallowed"><option ${u.memoAllowed==="미확인"?"selected":""}>미확인</option><option ${u.memoAllowed==="허용"?"selected":""}>허용</option><option ${u.memoAllowed==="불허"?"selected":""}>불허</option></select>
      </label>
      <label class="field"><span>특수계열</span>
        <select id="f-track2">${window.APP_DATA.specialTracks.map((t) => `<option value="${t.id}" ${u.specialTrack===t.id?"selected":""}>${t.label}</option>`).join("")}</select>
      </label>
    </div>
    <label class="field checkbox"><input type="checkbox" id="f-official" ${u.officialChecked ? "checked" : ""}> 모집요강·입학처 안내 등 대학 공식자료를 확인했다</label>
    <label class="field"><span>공식자료 메모 (자료명·확인일)</span><input id="f-sourcelog" placeholder="예: 2027 모집요강 p.12, 2026-03-02 확인" value="${escapeHtml((u.sourceLog||[])[0]?.label||"")}"></label>
    <label class="field"><span>학교폭력 조치사항 반영 여부 메모 (선택)</span><input id="f-swv" value="${escapeHtml(u.schoolViolenceNote)}"></label>
    <label class="field"><span>기타 메모</span><textarea id="f-memo" rows="2">${escapeHtml(u.memo)}</textarea></label>
    <div class="modal-actions">
      <button class="btn-ghost" id="cancel-btn">취소</button>
      <button class="btn-primary" id="save-btn">저장</button>
    </div>
  </div></div>`);
  document.body.appendChild(modal);
  modal.querySelector("#cancel-btn").onclick = () => modal.remove();
  modal.querySelector("#save-btn").onclick = () => {
    const g = (id) => modal.querySelector(id).value;
    Object.assign(u, {
      name: g("#f-name"), major: g("#f-major"), track: g("#f-track"), interviewDate: g("#f-date"),
      checkInTime: g("#f-checkin"), location: g("#f-loc"), duration: g("#f-duration"), prepTime: g("#f-prep"),
      interviewerCount: g("#f-interviewers"), ratio: g("#f-ratio"), stageType: g("#f-stage"),
      evalWeights: g("#f-weights"), blind: g("#f-blind"), promptBased: g("#f-prompt"), docBased: g("#f-docbased"),
      memoAllowed: g("#f-memoallowed"), specialTrack: g("#f-track2"),
      officialChecked: modal.querySelector("#f-official").checked,
      sourceLog: g("#f-sourcelog") ? [{ label: g("#f-sourcelog"), checkedDate: new Date().toISOString().slice(0,10) }] : [],
      schoolViolenceNote: g("#f-swv"), memo: g("#f-memo"),
    });
    if (isNew) AppState.universities.push(u);
    AppState.activeUniversityId = u.id;
    modal.remove();
    onDone && onDone();
    toast("저장했습니다.");
  };
  return u;
}

// ── 유형 판별 도우미 (§6, 결과는 "가능성"으로만) ─────────────────────
registerRoute("type-helper", () => {
  const uni = getActiveUniversity();
  if (!uni) {
    const body = el(`<div class="notice">먼저 대학 정보를 등록하세요.</div>`);
    body.appendChild(el(`<button class="btn-primary" onclick="navigate('universities')">대학 등록하러 가기</button>`));
    body.appendChild(buildFlowNav("type-helper"));
    return screenShell("면접유형 판별 도우미", "", body);
  }
  const guess = computeTypeGuess(uni);
  const resultLine = guess.primary
    ? `가능성 높은 유형: <strong>${escapeHtml(guess.primary)}</strong>`
    : `<strong>판별 보류</strong> — 입력된 정보가 부족합니다. 아래 정보를 더 채우면 추정할 수 있습니다.`;
  const body = el(`<div class="stack">
    <div class="card">
      <p>판별 대상: <strong>${escapeHtml(uni.name)} · ${escapeHtml(uni.major)}</strong></p>
      <p class="result-line">${resultLine}</p>
      ${guess.mixed.length ? `<p class="muted">혼합 가능성: ${escapeHtml(guess.mixed.join(", "))}</p>` : ""}
      <ul class="reason-list">${guess.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      <div class="notice small">이 결과는 참고용 추정입니다. 최종 면접유형과 진행방식은 해당 대학 모집요강 및 입학처 안내에서 다시 확인하세요.</div>
      <div class="notice small">${escapeHtml(window.APP_DATA.autoDetectExcludedNote)}</div>
    </div>
    <label class="field"><span>직접 확정/수정 (자동 추정이 틀렸거나, 집단·토론/MMI라면 여기서 고르세요)</span>
      <select id="override-type">
        <option value="">(자동 추정 유지)</option>
        ${window.APP_DATA.interviewTypes.map((t) => `<option value="${t.id}" ${uni.typeGuessOverride===t.id?"selected":""}>${t.label}</option>`).join("")}
      </select>
    </label>
    <label class="field"><span>추가 계열 태그</span>
      <select id="track-tag">
        ${window.APP_DATA.specialTracks.map((t) => `<option value="${t.id}" ${(uni.specialTrack||"none")===t.id?"selected":""}>${t.label}</option>`).join("")}
      </select>
    </label>
    <div class="notice small">${escapeHtml(window.APP_DATA.groupDiscussionNote)}</div>
    <button class="btn-primary" id="save-type-btn">저장</button>
  </div>`);
  body.querySelector("#save-type-btn").onclick = () => {
    uni.typeGuess = guess.primary || "";
    uni.typeGuessOverride = body.querySelector("#override-type").value;
    uni.specialTrack = body.querySelector("#track-tag").value || "none";
    toast("면접유형을 저장했습니다.");
    navigate("roadmap");
  };
  body.appendChild(buildFlowNav("type-helper"));
  return screenShell("면접유형 판별 도우미", "전형 이름만으로 단정하지 않습니다. 아래 정보를 종합한 추정입니다.", body);
});

function computeTypeGuess(uni) {
  const reasons = [];
  const scores = { doc: 0, trait: 0, prompt: 0 };
  const durationMin = parseInt((uni.duration || "").replace(/[^0-9]/g, ""), 10);

  // "제시문 여부"를 직접 입력했다면 가장 강한 신호로 취급합니다.
  if (uni.promptBased === "있음") { scores.prompt += 3; reasons.push("제시문 여부를 '있음'으로 직접 표시해, 제시문 기반 가능성을 가장 크게 반영했습니다."); }
  else if (uni.promptBased === "없음") { scores.doc += 1; scores.trait += 1; reasons.push("제시문 여부를 '없음'으로 표시해, 구술 문답형(서류/인적성) 쪽에 가점을 두었습니다."); }
  else if (uni.prepTime && uni.prepTime !== "없음") { scores.prompt += 2; reasons.push("별도 준비시간이 있어 제시문 가능성이 있습니다."); }

  if (uni.docBased === "예") { scores.doc += 2; reasons.push("제출서류 기반이라고 표시되어 서류 기반 가능성이 있습니다."); }
  else if (uni.docBased === "아니오") { scores.trait += 1; reasons.push("제출서류 기반이 아니라고 표시되어 인적성·교과 가능성이 있습니다."); }

  if (!isNaN(durationMin) && durationMin > 0 && durationMin <= 12) { scores.trait += 1; scores.doc += 1; reasons.push("진행시간이 10분 안팎이라 구술 문답형(서류/인적성) 가능성이 있습니다."); }
  if (!isNaN(durationMin) && durationMin > 15) { scores.prompt += 1; reasons.push("진행시간이 비교적 길어 제시문 가능성이 있습니다."); }

  const weights = (uni.evalWeights || "");
  if (/진로/.test(weights)) { scores.doc += 1; reasons.push("평가요소에 진로역량이 명시되어 서류 기반 가능성이 있습니다."); }
  if (/논리|종합적\s?사고/.test(weights)) { scores.prompt += 1; reasons.push("평가요소에 논리적·종합적 사고력이 명시되어 제시문 가능성이 있습니다."); }
  if (/인성/.test(weights) && !/진로/.test(weights)) { scores.trait += 1; reasons.push("평가요소가 인성 위주라 인적성·교과 가능성이 있습니다."); }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  if (totalScore === 0) {
    // 신호가 전혀 없으면 "서류 기반"으로 조용히 단정하지 않고 판별을 보류합니다.
    return { primary: null, mixed: [], reasons: ["입력된 정보가 거의 없어 추정할 수 없습니다. 제시문 여부·제출서류 기반 여부·진행시간·평가요소를 채워보세요."] };
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  const mixed = sorted.filter(([k, v]) => k !== top && v > 0 && v >= sorted[0][1] - 1)
    .map(([k]) => window.APP_DATA.interviewTypes.find((t) => t.id === k)?.label).filter(Boolean);
  const primaryLabel = window.APP_DATA.interviewTypes.find((t) => t.id === top)?.label || null;
  return { primary: primaryLabel, mixed, reasons };
}

// ── D-Day 로드맵 (§7, 보완: 여러 대학 구분) ──────────────────────────
registerRoute("roadmap", () => {
  const near = nearestUniversity();
  const body = el(`<div class="stack"></div>`);
  if (AppState.universities.length > 1) {
    body.appendChild(el(`<div class="notice small">등록된 대학이 여러 곳입니다. 아래에서 기준 대학을 골라 로드맵을 보세요.</div>`));
    const select = el(`<select id="roadmap-uni-select">
      <option value="">가장 가까운 면접 기준 (${near ? escapeHtml(near.name) : "-"})</option>
      ${AppState.universities.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(fmtDday(daysUntil(u.interviewDate)))})</option>`).join("")}
    </select>`);
    body.appendChild(select);
    select.onchange = () => renderRoadmapList(body, select.value ? AppState.universities.find((u) => u.id === select.value) : near);
  }
  renderRoadmapList(body, near);
  body.appendChild(buildFlowNav("roadmap"));
  return screenShell("D-Day 로드맵", "면접일 기준으로 지금 해야 할 일을 학생/학부모로 나눠 보여줍니다.", body);
});

function renderRoadmapList(container, uni) {
  container.querySelectorAll(".roadmap-list").forEach((n) => n.remove());
  const list = el(`<div class="roadmap-list stack"></div>`);
  const dd = uni ? daysUntil(uni.interviewDate) : null;
  list.appendChild(el(`<div class="card"><strong>${uni ? escapeHtml(uni.name) : "대학 미선택"}</strong> — ${escapeHtml(fmtDday(dd))}</div>`));
  window.APP_DATA.roadmap.forEach((step) => {
    const isNow = dd !== null && stepMatchesDday(step.day, dd);
    list.appendChild(el(`<div class="card ${isNow ? "highlight" : ""}">
      <h3>${escapeHtml(step.day)} ${isNow ? '<span class="badge">지금</span>' : ""}</h3>
      <div class="two-col">
        <div><p class="label">학생이 할 일</p><ul>${step.student.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>
        <div><p class="label">학부모가 도울 일</p><ul>${step.parent.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>
      </div>
    </div>`));
  });
  // 이 함수는 flow-nav 뒤에 재삽입되면 안 되므로, 기존 flow-nav가 있다면 그 앞에 붙입니다.
  const navEl = container.querySelector(".flow-nav");
  if (navEl) container.insertBefore(list, navEl); else container.appendChild(list);
}
function stepMatchesDday(label, dd) {
  if (label === "당일") return dd === 0;
  const m = label.match(/D-(\d+)/);
  if (!m) return false;
  const n = parseInt(m[1], 10);
  const ranges = { 30: [21, 999], 20: [15, 20], 14: [10, 14], 7: [4, 9], 3: [1, 3], 1: [1, 1] };
  if (label.includes("전후")) return dd >= 21;
  if (n === 1) return dd === 1;
  const range = ranges[n];
  return range ? dd >= range[0] && dd <= range[1] : dd === n;
}
