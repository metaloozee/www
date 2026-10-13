// Synthesised UI sounds: no audio files. Browsers keep audio locked until
// the first click or key press, so anything before that (the first boot)
// plays silently.

export type Sound = "tick" | "hover" | "step" | "beep" | "powerOff" | "powerOn";

const STORAGE_KEY = "crt-sound";
const MASTER_GAIN = 0.5;
const SILENT = 0.001;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let armed = false;
let enabled: boolean | undefined;
const listeners = new Set<() => void>();

function readPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "on" || stored === "off") {
      return stored === "on";
    }
  } catch {
    // Storage blocked: fall through to the default.
  }
  // Reduced motion stands in for sound sensitivity; the switch overrides it.
  return !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function soundEnabled() {
  enabled ??= readPreference();
  return enabled;
}

export const serverSoundEnabled = () => false;

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toggleSound() {
  enabled = !soundEnabled();
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Keeps the choice for this visit only.
  }
  for (const listener of listeners) {
    listener();
  }
  if (enabled) {
    unlock();
    play("tick");
  }
}

function unlock() {
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.destination);
    // One second of white noise, sliced for every click and crackle.
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  if (context.state === "suspended") {
    context.resume().catch(() => undefined);
  }
}

// Creates the context inside the first user gesture, so later sounds that
// aren't themselves in a gesture (the power-on, the boot) can play.
export function armSound() {
  if (armed) {
    return;
  }
  armed = true;
  const onGesture = () => {
    unlock();
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
  };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
}

interface Burst {
  at?: number;
  duration: number;
  filter: BiquadFilterType;
  frequency: number;
  gain: number;
  q: number;
}

function burst(
  ctx: AudioContext,
  out: AudioNode,
  source: AudioBuffer,
  b: Burst
) {
  const t = ctx.currentTime + (b.at ?? 0);
  const node = ctx.createBufferSource();
  node.buffer = source;
  const filter = ctx.createBiquadFilter();
  filter.type = b.filter;
  filter.frequency.value = b.frequency;
  filter.Q.value = b.q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(b.gain, t);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + b.duration);
  node.connect(filter).connect(gain).connect(out);
  // Random offset so repeated clicks don't sound identical.
  node.start(t, Math.random() * (source.duration - b.duration), b.duration);
  node.onended = () => {
    node.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

interface Tone {
  at?: number;
  attack?: number;
  duration: number;
  from: number;
  gain: number;
  to?: number;
  type: OscillatorType;
}

function tone(ctx: AudioContext, out: AudioNode, t0: Tone) {
  const t = ctx.currentTime + (t0.at ?? 0);
  const attack = t0.attack ?? 0.002;
  const osc = ctx.createOscillator();
  osc.type = t0.type;
  osc.frequency.setValueAtTime(t0.from, t);
  if (t0.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(t0.to, t + t0.duration);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, t);
  gain.gain.exponentialRampToValueAtTime(t0.gain, t + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + t0.duration);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + t0.duration + 0.01);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

// Square waves are harsh raw; a lowpass rounds the POST beep off.
function softened(ctx: AudioContext, out: AudioNode, cutoff: number) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  filter.connect(out);
  setTimeout(() => filter.disconnect(), 1000);
  return filter;
}

const SOUNDS: Record<
  Sound,
  (ctx: AudioContext, out: AudioNode, source: AudioBuffer) => void
> = {
  // Boot screen: bar full, one POST beep.
  beep: (ctx, out) =>
    tone(ctx, softened(ctx, out, 2500), {
      attack: 0.004,
      duration: 0.09,
      from: 1000,
      gain: 0.12,
      type: "square",
    }),
  // Pointer enters a link, index entry or switch: a softer, lower tick.
  hover: (ctx, out, source) =>
    burst(ctx, out, source, {
      duration: 0.005,
      filter: "bandpass",
      frequency: 2200,
      gain: 0.15,
      q: 3,
    }),
  // Tube shutting off: a thump as the picture collapses and a falling
  // whine as the dot fades.
  powerOff: (ctx, out, source) => {
    burst(ctx, out, source, {
      duration: 0.03,
      filter: "bandpass",
      frequency: 1800,
      gain: 0.25,
      q: 1,
    });
    tone(ctx, out, {
      duration: 0.18,
      from: 110,
      gain: 0.45,
      to: 40,
      type: "sine",
    });
    tone(ctx, out, {
      attack: 0.02,
      duration: 0.4,
      from: 2400,
      gain: 0.05,
      to: 180,
      type: "sine",
    });
  },
  // The reverse: static discharge, then the picture's hum rising in.
  powerOn: (ctx, out, source) => {
    burst(ctx, out, source, {
      duration: 0.08,
      filter: "bandpass",
      frequency: 2200,
      gain: 0.3,
      q: 0.8,
    });
    tone(ctx, out, {
      duration: 0.16,
      from: 45,
      gain: 0.4,
      to: 90,
      type: "sine",
    });
    tone(ctx, out, {
      attack: 0.15,
      duration: 0.4,
      from: 220,
      gain: 0.04,
      to: 1400,
      type: "sine",
    });
  },
  // Boot step reads OK: a quieter, brighter tick.
  step: (ctx, out, source) =>
    burst(ctx, out, source, {
      duration: 0.01,
      filter: "bandpass",
      frequency: 5000,
      gain: 0.35,
      q: 3,
    }),
  // Link, index entry, switch: a relay click.
  tick: (ctx, out, source) =>
    burst(ctx, out, source, {
      duration: 0.008,
      filter: "bandpass",
      frequency: 3500,
      gain: 0.6,
      q: 3,
    }),
};

export function play(sound: Sound) {
  if (!(context && master && noise && soundEnabled())) {
    return;
  }
  if (context.state === "suspended") {
    context.resume().catch(() => undefined);
  }
  SOUNDS[sound](context, master, noise);
}
