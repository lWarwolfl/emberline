/* The only browser entry point. Source files load in index.html dependency order. */
(() => {
  "use strict";
  const app = Emberline.App.create(document);
  // Explicit developer mode enables inspection without adding controls to the game.
  if (new URLSearchParams(location.search).has("dev")) {
    window.EmberlineDebug = { app, engine: Emberline.Engine, generator: Emberline.Generator };
  }
})();
