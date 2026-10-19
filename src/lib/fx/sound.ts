// Synthesized sound for the party effects — no audio files. Off by default;
// the 🎭 menu toggles it, per browser. Everything is scheduled through one
// quiet master gain, so stopping an effect silences whatever is still queued.
// §6.9

const KEY = "simcrm:fx-sound"

export function isSoundOn(): boolean {
  try { return localStorage.getItem(KEY) === "on" } catch { return false }
}

export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off") } catch { /* blocked storage */ }
}

type Wave = OscillatorType

interface ToneOpts {
  type?: Wave
  vol?: number
  attack?: number
  release?: number
  slideTo?: number
  detune?: number
  pan?: number
}

interface NoiseOpts {
  vol?: number
  filter?: BiquadFilterType
  freq?: number
  freqTo?: number
  q?: number
  attack?: number
  release?: number
}

export class Sound {
  readonly on: boolean
  private ac: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null

  constructor(on: boolean) {
    this.on = on
    if (!on || typeof window === "undefined") return
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ac = new AC()
      this.master = this.ac.createGain()
      this.master.gain.value = 0.16 // "not too loud"
      this.master.connect(this.ac.destination)
    } catch {
      this.ac = null
    }
  }

  /** Seconds since the context started — schedule relative to this. */
  get now() { return this.ac?.currentTime ?? 0 }

  tone(freq: number, at: number, dur: number, o: ToneOpts = {}) {
    const ac = this.ac
    if (!ac || !this.master) return
    const t0 = this.now + at
    const osc = ac.createOscillator()
    osc.type = o.type ?? "sine"
    osc.frequency.setValueAtTime(freq, t0)
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur)
    if (o.detune) osc.detune.value = o.detune
    const g = ac.createGain()
    const vol = o.vol ?? 0.5
    const a = o.attack ?? 0.01
    const r = o.release ?? Math.min(0.2, dur * 0.5)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + a)
    g.gain.setValueAtTime(vol, Math.max(t0 + a, t0 + dur - r))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    this.out(g, o.pan)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  noise(at: number, dur: number, o: NoiseOpts = {}) {
    const ac = this.ac
    if (!ac || !this.master) return
    if (!this.noiseBuf) {
      this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
      const d = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    const t0 = this.now + at
    const src = ac.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = ac.createBiquadFilter()
    f.type = o.filter ?? "lowpass"
    f.frequency.setValueAtTime(o.freq ?? 1000, t0)
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t0 + dur)
    f.Q.value = o.q ?? 1
    const g = ac.createGain()
    const vol = o.vol ?? 0.4
    const a = o.attack ?? 0.005
    const r = o.release ?? dur * 0.6
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + a)
    g.gain.setValueAtTime(vol, Math.max(t0 + a, t0 + dur - r))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(f)
    f.connect(g)
    this.out(g)
    src.start(t0, Math.random())
    src.stop(t0 + dur + 0.02)
  }

  private out(node: AudioNode, pan?: number) {
    if (!this.ac || !this.master) return
    if (pan) {
      const p = this.ac.createStereoPanner()
      p.pan.value = pan
      node.connect(p)
      p.connect(this.master)
    } else {
      node.connect(this.master)
    }
  }

  // ── A small vocabulary the effects share ─────────────────────────────────

  chirp(at = 0, high = 1) {
    for (let i = 0; i < 3; i++) {
      this.tone(2600 * high, at + i * 0.09, 0.07, { type: "sine", vol: 0.25, slideTo: 4200 * high, attack: 0.005, release: 0.03 })
    }
  }

  pluck(freq: number, at = 0, vol = 0.35) {
    this.tone(freq, at, 0.5, { type: "triangle", vol, attack: 0.004, release: 0.45 })
    this.tone(freq * 2, at, 0.25, { type: "sine", vol: vol * 0.3, attack: 0.004, release: 0.2 })
  }

  kick(at = 0) { this.tone(140, at, 0.25, { type: "sine", vol: 0.8, slideTo: 45, attack: 0.002 }) }
  hat(at = 0, vol = 0.12) { this.noise(at, 0.05, { filter: "highpass", freq: 7000, vol }) }
  clap(at = 0, vol = 0.3) { this.noise(at, 0.09, { filter: "bandpass", freq: 1500 + Math.random() * 800, q: 0.8, vol }) }
  click(at = 0, vol = 0.2) { this.noise(at, 0.02, { filter: "bandpass", freq: 3000, q: 2, vol }) }

  boom(at = 0, vol = 0.8) {
    this.tone(90, at, 1.2, { type: "sine", vol, slideTo: 30, attack: 0.003, release: 1 })
    this.noise(at, 0.9, { filter: "lowpass", freq: 900, freqTo: 120, vol: vol * 0.7, release: 0.8 })
  }

  whoosh(at = 0, dur = 0.6, up = true, vol = 0.3) {
    this.noise(at, dur, { filter: "bandpass", freq: up ? 300 : 2500, freqTo: up ? 2500 : 300, q: 1.2, vol, attack: dur * 0.4, release: dur * 0.5 })
  }

  /** notes: [frequency or 0 for a rest, beats]; returns the length in seconds. */
  melody(notes: [number, number][], at = 0, bpm = 100, o: ToneOpts = {}) {
    const beat = 60 / bpm
    let t = at
    for (const [f, b] of notes) {
      if (f) this.tone(f, t, b * beat * 0.95, { type: "triangle", vol: 0.35, attack: 0.02, release: Math.min(0.25, b * beat * 0.4), ...o })
      t += b * beat
    }
    return t - at
  }

  dispose() {
    const ac = this.ac
    if (!ac || !this.master) return
    this.master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05)
    setTimeout(() => { ac.close().catch(() => {}) }, 300)
    this.ac = null
  }
}

/** Equal-tempered pitch: note(0) is A4. */
export const note = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12)
