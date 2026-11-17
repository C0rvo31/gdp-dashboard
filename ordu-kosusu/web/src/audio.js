// Tiny synthesized sound effects (no audio files -> small APK, low CPU).
export class Sfx {
  constructor() {
    this.ctx = null;
    this._en = true;
    this.mt = 0; this.step = 0; this.nextT = 0;
    this.last = Object.create(null);
  }

  get enabled() { return this._en; }
  set enabled(v) { this._en = !!v; if (this._en) this.startMusic(); else this.stopMusic(); }

  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
        this.musBus = this.ctx.createGain(); this.musBus.gain.value = 0.16; this.musBus.connect(this.master);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.ctx && this._en) this.startMusic();
  }

  suspend() { this.stopMusic(); if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }

  // ---- very light background loop: bass + soft arpeggio, scheduled 0.5s ahead from a slow timer
  startMusic() {
    if (!this.ctx || this.mt || document.hidden) return;
    this.nextT = this.ctx.currentTime + 0.1;
    this.mt = setInterval(() => this.schedule(), 250);
    this.schedule();
  }
  stopMusic() { if (this.mt) { clearInterval(this.mt); this.mt = 0; } }
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    const CH = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [196, 246.9, 293.7]]; // Am F G G
    const sd = 0.2; // 8th note at 150bpm
    while (this.nextT < c.currentTime + 0.5) {
      const st = this.step++, ch = CH[(st >> 3) & 3], t = this.nextT - c.currentTime;
      if ((st & 3) === 0) this.tone(ch[0] / 2, sd * 3.2, 'triangle', 0.5, 0, t, this.musBus);
      const n = ch[[0, 1, 2, 1, 2, 1, 0, 2][st & 7]] * 2;
      if (st & 1 || (st & 3) === 0) this.tone(n, sd * 1.4, 'sine', 0.35, 0, t, this.musBus);
      this.nextT += sd;
    }
  }

  throttle(name, ms) {
    const t = performance.now();
    if (this.last[name] && t - this.last[name] < ms) return false;
    this.last[name] = t;
    return true;
  }

  tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0, bus = this.sfxBus) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 1200, delay = 0, type = 'lowpass', sweep = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this._en || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'shot': {
        // throttled harder as the fire rate climbs; tiny random pitch so bursts do not machine-gun
        if (!this.throttle(name, 110)) return;
        const f = 1800 + Math.random() * 1200;
        this.noise(0.04, 0.035, f, 0, 'bandpass');
        this.tone(260 + Math.random() * 40, 0.05, 'triangle', 0.03, -120);
        break;
      }
      case 'hit':
        if (!this.throttle(name, 70)) return;
        this.tone(320 + Math.random() * 80, 0.05, 'square', 0.035, -150);
        this.noise(0.03, 0.03, 3500, 0, 'highpass');
        break;
      case 'pop':
        if (!this.throttle(name, 50)) return;
        this.tone(520 + Math.random() * 200, 0.07, 'triangle', 0.08, -300);
        this.noise(0.03, 0.04, 2000, 0, 'highpass');
        break;
      case 'lose1':
        if (!this.throttle(name, 60)) return;
        this.tone(200 + Math.random() * 60, 0.08, 'sawtooth', 0.04, -100);
        break;
      case 'good':
        [523, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.14, 'triangle', 0.12, 0, i * 0.05); this.tone(f * 2, 0.08, 'sine', 0.03, 0, i * 0.05); });
        break;
      case 'bad':
        this.tone(300, 0.25, 'sawtooth', 0.09, -180);
        this.tone(220, 0.3, 'square', 0.05, -120, 0.06);
        this.noise(0.15, 0.08, 1200, 0, 'lowpass', -800);
        break;
      case 'coin':
        if (!this.throttle(name, 40)) return;
        this.tone(1320 + Math.random() * 60, 0.06, 'square', 0.04, 0);
        this.tone(1760, 0.12, 'sine', 0.07, 0, 0.05);
        break;
      case 'break':
        this.noise(0.28, 0.25, 1400, 0, 'lowpass', -1100);
        this.tone(140, 0.2, 'square', 0.07, -80);
        this.tone(90, 0.25, 'sine', 0.15, -40);
        break;
      case 'upgrade':
        [392, 523, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.16, 'square', 0.07, 0, i * 0.06); this.tone(f * 2, 0.2, 'sine', 0.04, 0, i * 0.06); });
        break;
      case 'saw':
        if (!this.throttle(name, 120)) return;
        this.noise(0.09, 0.07, 3000, 0, 'bandpass');
        this.tone(900, 0.07, 'sawtooth', 0.03, -400);
        break;
      case 'slam':
        this.noise(0.5, 0.45, 600, 0, 'lowpass', -480);
        this.tone(90, 0.4, 'sine', 0.35, -55);
        this.tone(55, 0.5, 'sine', 0.25, -20, 0.03);
        break;
      case 'win':
        [523, 659, 784, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.22, 'triangle', 0.14, 0, i * 0.11); this.tone(f / 2, 0.22, 'sine', 0.08, 0, i * 0.11); });
        this.tone(1568, 0.5, 'sine', 0.06, 0, 0.66);
        break;
      case 'over':
        [392, 330, 262, 196].forEach((f, i) => { this.tone(f, 0.28, 'triangle', 0.13, 0, i * 0.16); this.tone(f / 2, 0.3, 'sine', 0.09, 0, i * 0.16); });
        break;
      case 'click':
        this.tone(880, 0.05, 'triangle', 0.1);
        this.tone(1320, 0.04, 'sine', 0.04, 0, 0.02);
        break;
    }
  }
}
