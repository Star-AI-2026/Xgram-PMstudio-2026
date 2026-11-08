/** Synthesized ring tones (no audio assets needed) plus mobile vibration. */

type Ringer = { stop: () => void };

function createTone(pattern: "incoming" | "outgoing"): Ringer {
  if (typeof window === "undefined") return { stop: () => {} };
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return { stop: () => {} };

  const ctx = new Ctor();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const beep = () => {
    if (stopped) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = pattern === "incoming" ? 620 : 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(pattern === "incoming" ? 0.14 : 0.06, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.75);
    timer = setTimeout(beep, pattern === "incoming" ? 1600 : 2400);
  };

  void ctx.resume().catch(() => {});
  beep();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      void ctx.close().catch(() => {});
    },
  };
}

export function startRinging(direction: "incoming" | "outgoing"): Ringer {
  const tone = createTone(direction);
  let vibrateTimer: ReturnType<typeof setInterval> | null = null;

  if (direction === "incoming" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    const buzz = () => navigator.vibrate?.([400, 200, 400]);
    buzz();
    vibrateTimer = setInterval(buzz, 1600);
  }

  return {
    stop: () => {
      tone.stop();
      if (vibrateTimer) clearInterval(vibrateTimer);
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(0);
    },
  };
}
