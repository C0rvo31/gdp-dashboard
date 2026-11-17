// Tiny synthesized sound effects (no audio files -> small APK, low CPU).
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.last = Object.create(null);
  }

  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }

  throttle(name, ms) {
    const t = performance.now();
    if (this.last[name] && t - this.last[name] < ms) return false;
    this.last[name] = t;
    return true;
  }

  tone(freq, dur, type = 'square', vol = 0.15, slide = 0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 1200, delay = 0, type = 'lowpass') {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'shot':
        if (!this.throttle(name, 90)) return;
        this.noise(0.05, 0.05, 2500, 0, 'highpass');
        break;
      case 'hit':
        if (!this.throttle(name, 60)) return;
        this.tone(320 + Math.random() * 80, 0.05, 'square', 0.04, -150);
        break;
      case 'pop':
        if (!this.throttle(name, 45)) return;
        this.tone(520 + Math.random() * 200, 0.07, 'triangle', 0.09, -300);
        break;
      case 'lose1':
        if (!this.throttle(name, 50)) return;
        this.tone(200 + Math.random() * 60, 0.08, 'sawtooth', 0.05, -100);
        break;
      case 'good':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, 0, i * 0.05));
        break;
      case 'bad':
        this.tone(300, 0.25, 'sawtooth', 0.1, -180);
        this.tone(220, 0.3, 'square', 0.06, -120, 0.06);
        break;
      case 'coin':
        if (!this.throttle(name, 40)) return;
        this.tone(1320, 0.06, 'square', 0.05, 0);
        this.tone(1760, 0.09, 'square', 0.05, 0, 0.05);
        break;
      case 'break':
        this.noise(0.25, 0.25, 900);
        this.tone(140, 0.2, 'square', 0.08, -80);
        break;
      case 'upgrade':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.08, 0, i * 0.06));
        break;
      case 'saw':
        if (!this.throttle(name, 120)) return;
        this.noise(0.08, 0.08, 3000, 0, 'bandpass');
        break;
      case 'slam':
        this.noise(0.45, 0.45, 260);
        this.tone(90, 0.35, 'sine', 0.35, -50);
        break;
      case 'win':
        [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.15, 0, i * 0.11));
        break;
      case 'over':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.14, 0, i * 0.16));
        break;
      case 'click':
        this.tone(880, 0.05, 'triangle', 0.1);
        break;
    }
  }
}
