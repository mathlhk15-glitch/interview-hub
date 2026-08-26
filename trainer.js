/**
 * trainer.js — 30/60초 타이머와 선택적 녹음.
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
      this.onPhaseChange(phaseLabel, remaining);
      if (remaining <= 0) { resolve(true); return; }
      this.phaseResolve = resolve;
      this.timer = setInterval(() => {
        remaining -= 1;
        this.onTick(remaining, phaseLabel);
        if (remaining <= 0) {
          clearInterval(this.timer); this.timer = null;
          const done = this.phaseResolve; this.phaseResolve = null;
          if (done) done(true);
        }
      }, 1000);
    });
  }

  cancel() {
    this.cancelled = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.phaseResolve) { const done = this.phaseResolve; this.phaseResolve = null; done(false); }
    this.stopRecording();
  }
}
