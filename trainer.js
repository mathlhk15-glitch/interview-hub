/**
 * trainer.js — 30/45/60/90초·결론 스퍼트 타이머와 선택적 녹음.
 * 녹음·스트림은 메모리에만 존재하며 서버 전송/자동 저장하지 않습니다.
 */
function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg"];
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch (e) { /* ignore */ }
  }
  return "";
}



// ── v7.3 질문 TTS · STT · 브라우저 지원 감지 ──────────────────────────
function getInterviewBrowserSupport() {
  const ua = navigator.userAgent || "";
  const isIPadDesktopUA = navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || isIPadDesktopUA;
  const isAndroid = /Android/i.test(ua);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isKakao = /KAKAOTALK/i.test(ua);
  const isInstagram = /Instagram/i.test(ua);
  const isInApp = isKakao || isInstagram || /FBAN|FBAV|NAVER\(inapp/i.test(ua);
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  return {
    isIOS, isAndroid, isMobile: isMobile || isIPadDesktopUA, isInApp, secureContext: window.isSecureContext !== false,
    tts: "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined",
    stt: !!SpeechRecognitionCtor,
    recording: typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    SpeechRecognitionCtor,
  };
}

function speakInterviewQuestion(text, rate) {
  const support = getInterviewBrowserSupport();
  if (!support.tts) return Promise.resolve(false);
  try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = "ko-KR";
    u.rate = Math.max(0.6, Math.min(1.6, Number(rate) || 1));
    let settled = false;
    const finish = (value) => { if (settled) return; settled = true; clearTimeout(fallback); resolve(value); };
    const fallback = setTimeout(() => { try { window.speechSynthesis.cancel(); } catch (e) {} finish(false); }, 20000);
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    try { window.speechSynthesis.speak(u); } catch (e) { finish(false); }
  });
}

class SpeechTranscriber {
  constructor({ onText, onStatus }) {
    const support = getInterviewBrowserSupport();
    this.Ctor = support.SpeechRecognitionCtor; this.onText = onText || (()=>{}); this.onStatus = onStatus || (()=>{});
    this.recognition = null; this.finalText = ""; this.interimText = ""; this.active = false;
    this.shouldRun = false; this.restartCount = 0; this.maxRestarts = 2;
  }
  start() {
    if (!this.Ctor || this.active) return false;
    this.shouldRun = true;
    try {
      const r = new this.Ctor(); this.recognition = r;
      r.lang = "ko-KR"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) this.finalText += (this.finalText ? " " : "") + text.trim(); else interim += text;
        }
        this.interimText = interim.trim(); this.onText(this.finalText, this.interimText);
      };
      r.onerror = (e) => {
        const code = e.error || "오류";
        if (["not-allowed","service-not-allowed","audio-capture"].includes(code)) this.shouldRun = false;
        this.onStatus(`받아쓰기 제한: ${code}`);
      };
      r.onend = () => {
        this.active = false;
        if (this.shouldRun && this.restartCount < this.maxRestarts) {
          this.restartCount += 1; this.onStatus(`받아쓰기 재연결 중… (${this.restartCount}/${this.maxRestarts})`);
          setTimeout(() => this.start(), 250);
        } else this.onStatus("받아쓰기 종료");
      };
      r.start(); this.active = true; this.onStatus("받아쓰기 중…"); return true;
    } catch (e) { this.shouldRun = false; this.onStatus("이 브라우저에서는 받아쓰기를 시작할 수 없습니다."); return false; }
  }
  stop() {
    this.shouldRun = false; this.restartCount = 0;
    if (this.recognition && this.active) { try { this.recognition.stop(); } catch (e) {} }
    this.active = false;
  }
  reset() { this.finalText = ""; this.interimText = ""; this.restartCount = 0; this.onText("", ""); }
}

class SpeakingTrainer {
  constructor({ onTick, onPhaseChange, onRecordingBlob, onFallback }) {
    this.onTick = onTick || (() => {});
    this.onPhaseChange = onPhaseChange || (() => {});
    this.onRecordingBlob = onRecordingBlob || (() => {});
    this.onFallback = onFallback || (() => {});
    this.timer = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
    this.phaseResolve = null;
    this.phaseStartedAt = 0;
    this.phaseDuration = 0;
    this.phaseLabel = "";
    this.cancelled = false;
    this.recordingSupported = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  }

  async acquireStream() {
    this.cancelled = false;
    if (!this.recordingSupported) {
      this.onFallback("이 브라우저는 녹음을 지원하지 않습니다. 스톱워치 모드로 진행합니다. (별도 휴대전화 녹화를 권장합니다)");
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (err) {
      console.warn("mic permission unavailable:", err);
      this.onFallback("마이크 권한이 없거나 녹음을 지원하지 않아 스톱워치 모드로 진행합니다.");
      return false;
    }
  }

  beginRecording() {
    if (!this.stream) return false;
    try {
      const mime = pickSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.chunks = [];
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || "audio/webm" });
        if (blob.size) this.onRecordingBlob(blob);
        this.releaseStream();
      };
      this.mediaRecorder.start();
      return true;
    } catch (err) {
      console.warn("recording start failed:", err);
      this.releaseStream();
      this.onFallback("녹음을 시작하지 못해 스톱워치 모드로 전환했습니다.");
      return false;
    }
  }

  releaseStream() {
    if (this.stream) {
      try { this.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
    }
    this.stream = null;
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try { this.mediaRecorder.stop(); } catch (e) { this.releaseStream(); }
    } else {
      this.releaseStream();
    }
  }

  runPhase(seconds, phaseLabel) {
    return new Promise((resolve) => {
      if (this.cancelled) { resolve(false); return; }
      let remaining = Math.max(0, Number(seconds) || 0);
      this.phaseStartedAt = Date.now();
      this.phaseDuration = remaining;
      this.phaseLabel = phaseLabel || "";
      this.onPhaseChange(phaseLabel, remaining);
      if (remaining <= 0) { resolve(true); return; }
      this.phaseResolve = resolve;
      this.timer = setInterval(() => {
        remaining -= 1;
        this.onTick(remaining, phaseLabel);
        if (remaining <= 0) {
          clearInterval(this.timer); this.timer = null;
          const done = this.phaseResolve; this.phaseResolve = null;
          this.phaseStartedAt = 0; this.phaseDuration = 0; this.phaseLabel = "";
          if (done) done(true);
        }
      }, 1000);
    });
  }

  completePhase() {
    if (!this.phaseResolve) return null;
    const elapsed = this.phaseStartedAt ? Math.max(0, Math.round((Date.now() - this.phaseStartedAt) / 1000)) : 0;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const done = this.phaseResolve; this.phaseResolve = null;
    this.phaseStartedAt = 0; this.phaseDuration = 0; this.phaseLabel = "";
    if (done) done(true);
    return elapsed;
  }

  cancel() {
    this.cancelled = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.phaseResolve) { const done = this.phaseResolve; this.phaseResolve = null; done(false); }
    this.phaseStartedAt = 0; this.phaseDuration = 0; this.phaseLabel = "";
    this.stopRecording();
  }
}
