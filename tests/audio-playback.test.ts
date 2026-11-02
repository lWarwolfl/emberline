import test from "node:test";
import assert from "node:assert/strict";
import Audio from "../src/audio";

test("feedback uses separate timed samples, replaces rapid cues, and obeys mute", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const played: number[] = [];
  let stopped = 0;
  const gain = {
    value: 1,
    setValueAtTime(value: number) {
      this.value = value;
    },
  };
  class Context {
    currentTime = 0;
    state = "running";
    destination = {};
    createGain() {
      return { gain, connect() {} };
    }
    createBuffer(_channels: number, length: number) {
      return { length, getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      return {
        buffer: { length: 0 },
        connect() {},
        start() {
          played.push(this.buffer.length);
        },
        stop() {
          stopped++;
        },
      };
    }
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { AudioContext: Context },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const audio = Audio.create();
  audio.unlock();
  audio.play("purchase");
  audio.play("upgrade");
  audio.play("record");
  assert.deepEqual(played, [44100, 6174, 35280]);
  assert.equal(stopped, 2);
  audio.setMuted(true);
  assert.equal(gain.value, 0);
  audio.play("purchase");
  assert.equal(played.length, 3);
  audio.setMuted(false);
  assert.equal(gain.value, 1);
  audio.play("purchase");
  assert.equal(played.at(-1), 44100);
});
