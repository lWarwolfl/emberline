function create(initialMuted = false) {
  let muted = initialMuted;
  let audio: AudioContext | undefined;
  function bootAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch {}
  }
  function tone(
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    vol = 0.035,
    end = 0,
    delay = 0,
  ) {
    if (muted || !audio) return;
    const t = audio.currentTime + delay,
      o = audio.createOscillator(),
      g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t + duration);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(audio.destination);
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  function noise(duration: number, vol: number) {
    if (muted || !audio) return;
    const n = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate),
      a = n.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = audio.createBufferSource(),
      g = audio.createGain();
    s.buffer = n;
    g.gain.value = vol;
    s.connect(g);
    g.connect(audio.destination);
    s.start();
  }
  function sound(type: string, combo = 0) {
    switch (type) {
      case "jump":
        tone(170, 0.14, "square", 0.025, 420);
        break;
      case "dash":
        noise(0.18, 0.065);
        tone(480, 0.2, "sawtooth", 0.025, 90);
        break;
      case "pickup":
        tone(740 + (combo % 5) * 110, 0.09, "sine", 0.09, 1100);
        break;
      case "smash":
        noise(0.2, 0.14);
        tone(100, 0.2, "square", 0.07, 30);
        break;
      case "punch":
        noise(0.08, 0.04);
        tone(180, 0.1, "triangle", 0.06, 60);
        break;
      case "shoot":
        tone(800, 0.12, "sawtooth", 0.025, 140);
        break;
      case "armor":
        tone(1200, 0.07, "triangle", 0.025, 700);
        break;
      case "hit":
        noise(0.25, 0.1);
        tone(140, 0.28, "sawtooth", 0.065, 40);
        break;
      case "death":
        [260, 195, 130, 65].forEach((f, i) => tone(f, 0.3, "triangle", 0.1, 0, i * 0.13));
        break;
      case "sector":
        [330, 440, 660].forEach((f, i) => tone(f, 0.16, "triangle", 0.06, 0, i * 0.09));
        break;
      case "start":
        [220, 330, 440, 880].forEach((f, i) => tone(f, 0.12, "square", 0.025, 0, i * 0.08));
    }
  }

  return {
    unlock: bootAudio,
    play: sound,
    setMuted(value: boolean) {
      muted = value;
    },
    get muted() {
      return muted;
    },
  };
}
export = { create };
