// BREACHLINE — audio.js
// Every sound is synthesized with WebAudio: no audio files ship with the
// game. The context is created on the first user gesture (the browser
// requires it), and every effect is a short envelope over an oscillator or
// a burst of filtered noise.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.42;
      master.connect(ctx.destination);
      // A low room hum that starts with the match and never quite leaves.
      const hum = ctx.createOscillator();
      const humGain = ctx.createGain();
      hum.type = 'sine';
      hum.frequency.value = 52;
      humGain.gain.value = 0.015;
      hum.connect(humGain);
      humGain.connect(master);
      hum.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shot(kind) {
      if (kind === 'lance') {
        noise(0.28, 0.5, 900);
        tone(160, 0.22, 'sawtooth', 0.28, 55);
      } else if (kind === 'rifle') {
        noise(0.12, 0.34, 2400, 'bandpass');
        tone(220, 0.09, 'square', 0.16, 90);
      } else {
        noise(0.09, 0.28, 3000, 'bandpass');
        tone(320, 0.07, 'square', 0.13, 140);
      }
    },
    botShot() {
      noise(0.1, 0.16, 1800, 'bandpass');
      tone(180, 0.08, 'square', 0.07, 80);
    },
    hit() {
      tone(1250, 0.05, 'sine', 0.22);
    },
    kill() {
      tone(880, 0.09, 'sine', 0.22);
      setTimeout(() => tone(1320, 0.12, 'sine', 0.2), 70);
    },
    hurt() {
      tone(140, 0.16, 'sawtooth', 0.22, 70);
      noise(0.1, 0.14, 500);
    },
    reload() {
      tone(500, 0.05, 'square', 0.1);
      setTimeout(() => tone(700, 0.05, 'square', 0.1), 180);
      setTimeout(() => tone(900, 0.06, 'square', 0.12), 380);
    },
    dryFire() {
      tone(1100, 0.03, 'square', 0.08);
    },
    plantTick() {
      tone(980, 0.06, 'sine', 0.16);
    },
    planted() {
      tone(660, 0.12, 'sine', 0.2);
      setTimeout(() => tone(990, 0.18, 'sine', 0.2), 120);
    },
    defuseTick() {
      tone(720, 0.05, 'sine', 0.12);
    },
    explosion() {
      noise(0.9, 0.6, 300);
      tone(90, 0.7, 'sine', 0.4, 30);
    },
    roundWin() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 110));
    },
    roundLose() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.26, 'triangle', 0.18), i * 130));
    },
    buy() {
      tone(1047, 0.07, 'sine', 0.16);
      setTimeout(() => tone(1319, 0.09, 'sine', 0.14), 60);
    },
    denied() {
      tone(220, 0.14, 'square', 0.14, 160);
    },
    step() {
      noise(0.04, 0.05, 700);
    },
    click() {
      tone(800, 0.04, 'sine', 0.12);
    },
  };
}
