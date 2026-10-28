/* PWA: file:// launches have no service worker scope, so register only over HTTP. */
(() => {
  "use strict";
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      /* Private mode or blocked storage must not prevent playing. */
    });
  });
})();
