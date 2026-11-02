import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import FeedbackAudio from "../src/feedback-audio";
import { encodeWav } from "../scripts/generate-feedback-audio";

for (const [kind, duration] of [
  ["purchase", 2],
  ["upgrade", 0.28],
  ["record", 1.6],
] as const) {
  test(`${kind} audio has the intended duration, bounded energy and seamless endpoints`, () => {
    const sound = FeedbackAudio.generate(kind);
    assert.equal(sound.samples.length, Math.round(duration * sound.sampleRate));
    assert.equal(sound.samples[0], 0);
    assert.equal(sound.samples.at(-1), 0);
    let energy = 0,
      peak = 0;
    for (const sample of sound.samples) {
      assert(Number.isFinite(sample));
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    const rms = Math.sqrt(energy / sound.samples.length);
    assert(peak > 0.3 && peak <= 0.75, String(peak));
    assert(rms > 0.035 && rms < 0.3, String(rms));
    assert.deepEqual(sound.samples, FeedbackAudio.generate(kind).samples);
    const encoded = encodeWav(sound);
    const file = fs.readFileSync(path.join(__dirname, "../assets/audio", kind + ".wav"));
    assert.deepEqual(file, encoded);
    assert.equal(file.toString("ascii", 0, 4), "RIFF");
    assert.equal(file.toString("ascii", 8, 12), "WAVE");
    assert.equal(file.readUInt16LE(22), 1);
    assert.equal(file.readUInt32LE(24), sound.sampleRate);
    assert.equal(file.readUInt16LE(34), 16);
    assert.equal(file.readUInt32LE(40), sound.samples.length * 2);
    assert.equal(file.length, sound.samples.length * 2 + 44);
  });
}

test("the musical cues and upgrade impact have different waveforms", () => {
  const purchase = FeedbackAudio.generate("purchase").samples;
  const upgrade = FeedbackAudio.generate("upgrade").samples;
  const record = FeedbackAudio.generate("record").samples;
  assert.notDeepEqual(purchase.slice(0, 2000), record.slice(0, 2000));
  assert.notDeepEqual(purchase.slice(0, 2000), upgrade.slice(0, 2000));
});
