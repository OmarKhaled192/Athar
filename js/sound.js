// ATHAR's original, synthesized sound palette. No audio files or remote media.
const STORAGE_KEY = 'athar-sound-preferences';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));

class SoundManager {
  constructor() {
    this.context = null;
    this.master = null;
    this.effects = null;
    this.ambience = null;
    this.ambientNodes = [];
    this.cooldowns = new Map();
    this.activeEffects = new Set();
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    this.prefs = { enabled: false, effectsEnabled: true, effects: 0.24, music: 0.12, ambient: false };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') this.prefs = { ...this.prefs, ...saved, effects: clamp(saved.effects), music: clamp(saved.music), enabled: saved.enabled === true, effectsEnabled: saved.effectsEnabled !== false, ambient: saved.ambient === true };
    } catch { /* Storage may be disabled; audio remains available for this session. */ }
  }

  persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs)); } catch { /* Optional preference persistence. */ } }
  getPreferences() { return { ...this.prefs }; }
  get enabled() { return this.prefs.enabled; }

  async activate() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    try {
      this.context ??= new Audio();
      if (!this.master) {
        this.master = this.context.createGain(); this.effects = this.context.createGain(); this.ambience = this.context.createGain();
        this.effects.connect(this.master); this.ambience.connect(this.master); this.master.connect(this.context.destination);
        this.effects.gain.value = this.prefs.effects; this.ambience.gain.value = 0;
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.prefs.enabled && this.prefs.ambient) this.startAmbience();
      return this.context.state === 'running';
    } catch { return false; }
  }

  async setEnabled(enabled) {
    this.prefs.enabled = !!enabled;
    if (enabled && !(await this.activate())) { this.prefs.enabled = false; this.persist(); return false; }
    if (!enabled) this.stopAmbience();
    else if (this.prefs.ambient) this.startAmbience();
    this.persist();
    return true;
  }

  setEffectsVolume(value) {
    this.prefs.effects = clamp(value); this.persist();
    if (this.effects && this.context) this.effects.gain.setTargetAtTime(this.prefs.effects, this.context.currentTime, 0.06);
  }

  setEffectsEnabled(enabled) { this.prefs.effectsEnabled = !!enabled; this.persist(); }

  setMusicVolume(value) {
    this.prefs.music = clamp(value); this.persist(); this.updateAmbience();
  }

  async setAmbient(enabled) {
    this.prefs.ambient = !!enabled; this.persist();
    if (enabled && this.prefs.enabled && await this.activate()) this.startAmbience();
    else this.stopAmbience();
  }

  updateAmbience() {
    if (!this.context || !this.ambience) return;
    const target = this.prefs.enabled && this.prefs.ambient ? this.prefs.music * 0.14 : 0;
    this.ambience.gain.setTargetAtTime(target, this.context.currentTime, target ? 1.8 : 0.9);
  }

  startAmbience() {
    if (!this.context || this.ambientNodes.length) return;
    const now = this.context.currentTime;
    for (const [frequency, detune] of [[55, -4], [82.4, 3], [110, 0]]) {
      const osc = this.context.createOscillator(), gain = this.context.createGain(), filter = this.context.createBiquadFilter();
      osc.type = 'sine'; osc.frequency.value = frequency; osc.detune.value = detune;
      filter.type = 'lowpass'; filter.frequency.value = 190;
      gain.gain.value = frequency === 55 ? 0.22 : 0.08;
      osc.connect(filter); filter.connect(gain); gain.connect(this.ambience); osc.start(now);
      this.ambientNodes.push(osc);
    }
    this.updateAmbience();
  }

  stopAmbience() {
    if (this.context && this.ambience) this.ambience.gain.setTargetAtTime(0, this.context.currentTime, 0.9);
    const nodes = this.ambientNodes.splice(0);
    if (nodes.length) window.setTimeout(() => nodes.forEach(node => { try { node.stop(); node.disconnect(); } catch {} }), 3000);
  }

  play(name) {
    if (this.reducedMotion && (name === 'transition' || name === 'ignition')) return;
    if (!this.prefs.enabled || !this.prefs.effectsEnabled || !this.context || this.context.state !== 'running' || !this.effects || this.prefs.effects <= 0) return;
    const nowMs = performance.now(), last = this.cooldowns.get(name) || 0;
    if (nowMs - last < 220 || this.activeEffects.size >= 3) return;
    this.cooldowns.set(name, nowMs);
    const palettes = {
      ui: [[880, 0, 0.045, 0.07]], select: [[587.33, 0, 0.11, 0.09], [880, 0.06, 0.12, 0.045]],
      open: [[392, 0, 0.18, 0.075], [587.33, 0.07, 0.24, 0.04]], transition: [[330, 0, 0.19, 0.045], [494, 0.08, 0.21, 0.035]],
      story: [[392, 0, 0.24, 0.045], [523.25, 0.1, 0.28, 0.035]], discovery: [[523.25, 0, 0.24, 0.065], [659.25, 0.12, 0.31, 0.045], [783.99, 0.24, 0.34, 0.025]],
      correct: [[523.25, 0, 0.12, 0.06], [659.25, 0.09, 0.19, 0.05]], incorrect: [[293.66, 0, 0.14, 0.035], [261.63, 0.09, 0.18, 0.025]],
      achievement: [[392, 0, 0.24, 0.045], [493.88, 0.11, 0.25, 0.04], [587.33, 0.22, 0.32, 0.03]],
      mission: [[349.23, 0, 0.35, 0.042], [440, 0.16, 0.38, 0.032], [523.25, 0.32, 0.48, 0.025], [698.46, 0.49, 0.62, 0.018]],
      ignition: [[110, 0, 0.22, 0.035], [164.81, 0.16, 0.3, 0.025], [220, 0.34, 0.36, 0.018]],
      scan: [[660, 0, 0.16, 0.035]], radio: [[740, 0, 0.07, 0.035], [880, 0.13, 0.08, 0.025]]
    };
    const notes = palettes[name] || palettes.ui;
    const group = { nodes: [], timer: 0 }; this.activeEffects.add(group);
    for (const [hz, offset, duration, level] of notes) {
      const osc = this.context.createOscillator(), gain = this.context.createGain(), start = this.context.currentTime + offset;
      osc.type = 'sine'; osc.frequency.setValueAtTime(hz, start);
      gain.gain.setValueAtTime(0.0001, start); gain.gain.linearRampToValueAtTime(level, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain); gain.connect(this.effects); osc.start(start); osc.stop(start + duration + 0.015); group.nodes.push(osc);
    }
    group.timer = window.setTimeout(() => { group.nodes.forEach(node => { try { node.disconnect(); } catch {} }); this.activeEffects.delete(group); }, 950);
  }

  dispose() {
    this.stopAmbience();
    for (const group of this.activeEffects) { clearTimeout(group.timer); group.nodes.forEach(node => { try { node.stop(); node.disconnect(); } catch {} }); }
    this.activeEffects.clear();
    try { this.context?.close?.(); } catch {}
    this.context = null;
  }
}

export const soundManager = new SoundManager();
