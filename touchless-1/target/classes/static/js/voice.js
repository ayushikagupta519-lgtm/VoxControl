// ============================================================
// Voice engine: continuous "VoxControl mode" built on the Web Speech API.
// - listens in short one-shot sessions and restarts itself
// - pauses the mic while the app is speaking (no echo / self-triggering)
// - exposes listenOnce() for dictating into a form field
// ============================================================

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const recognitionSupported = Boolean(SR);
export const speechSupported = 'speechSynthesis' in window;

const LANG = 'en-IN';

export function createVoice({ onState, onInterim, onFinal, onError }) {
  let rec = null;
  let on = false;          // VoxControl mode switched on
  let busy = false;        // handling a command or speaking: don't listen
  let muted = false;
  let failures = 0;
  let restartTimer = null;
  let state = 'off';       // off | listening | thinking | speaking

  const setState = (s) => { if (s !== state) { state = s; onState?.(s); } };

  function build() {
    const r = new SR();
    r.lang = LANG;
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => { if (on && !busy) setState('listening'); };

    r.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      if (interim) onInterim?.(interim);
      if (final.trim()) {
        failures = 0;
        handleFinal(final.trim());
      }
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;      // normal; onend restarts
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stop();
        onError?.('Microphone access is blocked. Allow it in the browser address bar and try again.');
        return;
      }
      if (e.error === 'audio-capture') {
        stop();
        onError?.('No microphone was found.');
        return;
      }
      failures += 1;
      if (failures >= 4) {
        stop();
        onError?.(e.error === 'network'
          ? 'Speech recognition needs an internet connection in this browser.'
          : 'Speech recognition stopped working. Please try again.');
      }
    };

    r.onend = () => {
      if (on && !busy) scheduleRestart(failures ? 900 : 250);
    };
    return r;
  }

  function scheduleRestart(delay) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(startRec, delay);
  }

  function startRec() {
    if (!on || busy) return;
    try {
      rec ??= build();
      rec.start();
    } catch {
      // "already started" - harmless
    }
  }

  async function handleFinal(text) {
    busy = true;
    setState('thinking');
    try { rec?.abort(); } catch { /* ignore */ }
    try {
      await onFinal?.(text);
    } finally {
      busy = false;
      if (on) {
        setState('listening');
        scheduleRestart(350);
      }
    }
  }

  function start() {
    if (!SR) { onError?.('Voice input is not supported in this browser. Try Chrome or Edge - or type a command instead.'); return false; }
    on = true; busy = false; failures = 0;
    setState('listening');
    startRec();
    return true;
  }

  function stop() {
    on = false; busy = false;
    clearTimeout(restartTimer);
    try { rec?.abort(); } catch { /* ignore */ }
    if (speechSupported) speechSynthesis.cancel();
    setState('off');
  }

  /** Speak text; resolves when finished. The mic stays paused meanwhile. */
  function speak(text) {
    if (muted || !speechSupported || !text) return Promise.resolve();
    return new Promise((resolve) => {
      const wasBusy = busy;
      busy = true;
      try { rec?.abort(); } catch { /* ignore */ }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANG;
      const voices = speechSynthesis.getVoices();
      u.voice = voices.find((v) => v.lang === LANG) || voices.find((v) => v.lang?.startsWith('en')) || null;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        busy = wasBusy;
        if (on && !busy) { setState('listening'); scheduleRestart(300); }
        resolve();
      };
      // Some browsers never fire onend; never leave the mic stuck.
      const guard = setTimeout(finish, 2500 + text.length * 90);
      u.onstart = () => { if (on) setState('speaking'); };
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
    });
  }

  /** One-shot dictation for text fields. Resolves with the transcript ('' if nothing heard). */
  function listenOnce(onPartial) {
    if (!SR) return Promise.reject(new Error('Voice input is not supported in this browser.'));
    const wasOn = on;
    if (wasOn) { busy = true; try { rec?.abort(); } catch { /* ignore */ } }
    return new Promise((resolve, reject) => {
      const r = new SR();
      r.lang = LANG;
      r.interimResults = true;
      r.continuous = false;
      let text = '';
      r.onresult = (e) => {
        text = Array.from(e.results).map((x) => x[0].transcript).join(' ').trim();
        onPartial?.(text);
      };
      r.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        reject(new Error(e.error === 'not-allowed' ? 'Microphone access is blocked.' : 'Could not hear you. Try again.'));
      };
      r.onend = () => {
        if (wasOn) { busy = false; scheduleRestart(400); }
        resolve(text);
      };
      try { r.start(); } catch (err) { reject(err); }
    });
  }

  return {
    start, stop, speak, listenOnce,
    toggle: () => (on ? (stop(), false) : start()),
    isOn: () => on,
    setMuted: (m) => { muted = m; if (m && speechSupported) speechSynthesis.cancel(); },
    isMuted: () => muted,
  };
}
