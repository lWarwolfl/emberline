import fs from "node:fs";
import path from "node:path";
import FeedbackAudio from "../src/feedback-audio";

export function encodeWav(sound: ReturnType<typeof FeedbackAudio.generate>) {
  const data = Buffer.alloc(44 + sound.samples.length * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sound.sampleRate, 24);
  data.writeUInt32LE(sound.sampleRate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(sound.samples.length * 2, 40);
  sound.samples.forEach((sample, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2),
  );
  return data;
}

export function generateFiles(root = path.resolve(__dirname, "..")) {
  const directory = path.join(root, "assets/audio");
  fs.mkdirSync(directory, { recursive: true });
  for (const kind of ["purchase", "upgrade", "record"] as const) {
    const sound = FeedbackAudio.generate(kind);
    const file = path.join(directory, kind + ".wav");
    fs.writeFileSync(file, encodeWav(sound));
    console.log(
      `${kind}: ${sound.samples.length / sound.sampleRate}s, ${sound.sampleRate}Hz, ${fs.statSync(file).size} bytes`,
    );
  }
}

if (require.main === module) generateFiles();
