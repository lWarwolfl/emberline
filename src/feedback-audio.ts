type Kind = "purchase" | "upgrade" | "record";
const sampleRate = 22050;
const durations = { purchase: 2, upgrade: 0.28, record: 1.6 };

function generate(kind: Kind) {
  const samples = new Float32Array(Math.round(sampleRate * durations[kind]));
  let seed = 0x5eeda11;
  function noise() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0x80000000 - 1;
  }
  function mix(start: number, duration: number, voice: (t: number) => number) {
    const offset = Math.round(start * sampleRate);
    const length = Math.min(Math.round(duration * sampleRate), samples.length - offset);
    for (let i = 0; i < length; i++) samples[offset + i] += voice(i / sampleRate);
  }
  function note(midi: number, start: number, duration: number, volume = 0.2) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    mix(start, duration, (t) => {
      const phase = Math.PI * 2 * hz * t;
      const attack = Math.min(1, t / 0.006);
      const release = Math.min(1, Math.max(0, duration - t) / 0.045);
      const body = Math.exp(-t * 3);
      return (
        (Math.sin(phase) + Math.sin(phase * 2) * 0.18 + Math.sin(phase * 3) * 0.1) *
        attack *
        release *
        body *
        volume
      );
    });
  }
  function kick(start: number) {
    mix(
      start,
      0.13,
      (t) =>
        Math.sin(Math.PI * 2 * (48 * t + 2.2 * (1 - Math.exp(-t * 38)))) * Math.exp(-t * 28) * 0.19,
    );
  }
  function hat(start: number, volume = 0.025) {
    mix(start, 0.055, (t) => noise() * Math.exp(-t * 80) * volume);
  }
  if (kind === "purchase") {
    [72, 76, 79, 84, 81, 79, 83, 84].forEach((midi, i) => note(midi, i * 0.1875, 0.23));
    [48, 55, 57, 53].forEach((midi, i) => {
      note(midi, i * 0.375, 0.29, 0.15);
      kick(i * 0.375);
    });
    for (let i = 0; i < 8; i++) hat(i * 0.1875 + 0.08);
    [72, 76, 79, 84].forEach((midi) => note(midi, 1.5, 0.5, 0.13));
    note(96, 1.63, 0.3, 0.07);
  } else if (kind === "record") {
    [67, 72, 76, 79, 84, 88].forEach((midi, i) => note(midi, i * 0.13, 0.22, 0.21));
    [60, 72, 76, 79, 84].forEach((midi) => note(midi, 0.8, 0.8, 0.13));
    [91, 88, 96, 91].forEach((midi, i) => note(midi, 0.88 + i * 0.13, 0.26, 0.075));
    kick(0);
    kick(0.39);
    kick(0.8);
    hat(0.8, 0.075);
  } else {
    let previousNoise = 0;
    for (const [index, start] of [0, 0.052, 0.104].entries()) {
      const volume = index === 0 ? 0.29 : 0.075;
      mix(start, 0.28 - start, (t) => {
        const partials = [913, 1471, 2339, 3781, 5377].reduce(
          (sum, hz, i) =>
            sum + (Math.sin(Math.PI * 2 * hz * t) * Math.exp(-t * (18 + i * 5))) / (i + 1),
          0,
        );
        const nextNoise = noise();
        const impact = (nextNoise - previousNoise) * Math.exp(-t * 115) * 0.3;
        previousNoise = nextNoise;
        return (partials + impact) * Math.min(1, t / 0.001) * volume;
      });
    }
  }
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const fade = Math.min(
      1,
      i / (sampleRate * 0.004),
      (samples.length - 1 - i) / (sampleRate * 0.024),
    );
    samples[i] *= Math.max(0, fade);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const gain = (kind === "upgrade" ? 0.55 : kind === "record" ? 0.7 : 0.65) / Math.max(peak, 0.001);
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  samples[0] = samples[samples.length - 1] = 0;
  return { sampleRate, samples };
}

export = { generate, durations, sampleRate };
