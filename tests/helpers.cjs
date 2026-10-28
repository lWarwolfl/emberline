const Engine = require("../src/engine.js");
function run(seed = 42) {
  const state = Engine.create(seed);
  state.mode = "playing";
  state.next = Infinity;
  return state;
}
function advance(state, seconds) {
  for (let time = 0; time < seconds - 1e-9; time += 1 / 120) {
    Engine.update(state, Math.min(1 / 120, seconds - time));
    state.events.length = 0;
  }
}
module.exports = { run, advance };
