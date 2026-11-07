import test from "node:test";
import assert from "node:assert/strict";
import * as Party from "../src/party";
import * as Sync from "../src/party-sync";
import Config from "../src/config";

function started() {
  const run = Party.create(
    "host",
    Party.profile({ name: "Host", levels: { dash: 0, jump: 0, damage: 0, triple: 0 } }),
    "smooth",
  );
  assert(Party.add(run, "guest", Party.profile({ name: "Guest" })));
  Party.start(run);
  run.world.next = Infinity;
  run.world.speed = 120;
  run.world.runSpeed = 120;
  return run;
}

test("guest motion keeps scrolling between host snapshots without spawning or scoring", () => {
  const host = started();
  host.world.objects.push({ kind: "hazard", variant: "barrier", x: 300, y: 178, w: 25, h: 18 });
  const guest = Party.clone(host);
  const score = guest.world.score;
  const objects = guest.world.objects.length;
  for (let frame = 0; frame < 30; frame++) Party.glide(guest, 1 / 60);
  assert(guest.world.distance > host.world.distance + 50);
  assert.equal(guest.world.score, score);
  assert.equal(guest.world.objects.length, objects);
  assert(guest.world.objects.every((object, index) => object.x < host.world.objects[index].x));
});

test("a guest simulation stays with the host and eases a late jump", () => {
  const host = started();
  const guest = Party.clone(host);
  const authority = Party.clone(host);
  for (let i = 0; i < 20; i++) {
    Party.glide(host, 1 / 60);
    Party.present(guest, authority, 1 / 60);
  }
  assert(Math.abs(guest.world.distance - host.world.distance) < 1);
  Party.action(authority, "guest", "jump");
  Party.glide(authority, 0.08);
  for (let i = 0; i < 12; i++) Party.present(guest, authority, 1 / 60);
  const local = guest.members.find((member) => member.id === "guest")!;
  assert(local.state.player.y < Config.floor - Config.playerHeight - 4);
  assert(local.state.player.vy < 0);
});

test("merging adds host objects, drops removed ones, and snaps a warp", () => {
  const host = started();
  const guest = Party.clone(host);
  host.world.objects.shift();
  host.world.objects.push({ kind: "ember", variant: "ground", x: 420, y: 170, w: 5, h: 6 });
  Party.ease(guest, host, 1 / 20);
  assert(guest.world.objects.some((object) => object.variant === "ground" && object.x > 400));
  assert.equal(guest.world.objects.length, host.world.objects.length);
  host.world.distance += 650;
  Party.ease(guest, host, 1 / 20);
  assert.equal(guest.world.distance, host.world.distance);
});

test("the guest view interpolates the world and predicts a jump before the host agrees", () => {
  const host = started();
  host.world.objects.push({ kind: "hazard", variant: "barrier", x: 300, y: 178, w: 25, h: 18 });
  const later = Party.clone(host);
  later.world.time += 0.1;
  later.world.objects.find((object) => object.variant === "barrier")!.x = 260;
  const guest = Party.clone(host);
  const guestId = guest.members.find((member) => member.name === "Guest")!.id;
  const samples = [
    { time: host.world.time, run: host },
    { time: later.world.time, run: later },
  ];
  Sync.follow(guest, samples, guestId, [], 0, host.world.time + 0.05 + Sync.renderDelay);
  const barrier = guest.world.objects.find((object) => object.variant === "barrier");
  assert(barrier);
  assert(Math.abs(barrier.x - 280) < 2);
  const pending = [{ sequence: 1, action: "jump" as const }];
  Sync.follow(guest, samples, guestId, pending, 0, later.world.time + 0.08);
  const local = guest.members.find((member) => member.id === guestId)!;
  assert(local.state.player.y < Config.floor - Config.playerHeight - 2);
  assert(local.state.player.vy < 0);
});

test("a guest rebases a fresh snapshot onto its own clock and resets a large gap", () => {
  const host = started();
  const guest = Party.clone(host);
  Party.glide(guest, 0.05);
  const authority = Party.rebase(guest, Party.clone(host));
  assert(Math.abs(authority.world.time - guest.world.time) < 0.001);
  assert(authority.world.distance > host.world.distance);
  for (let frame = 0; frame < 30; frame++) Party.glide(guest, 1 / 60);
  const reset = Party.rebase(guest, Party.clone(host));
  assert.equal(guest.world.time, reset.world.time);
  assert(Math.abs(guest.world.distance - host.world.distance) < 0.001);
});
