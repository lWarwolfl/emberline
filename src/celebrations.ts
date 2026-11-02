import { element } from "./dom";

function create(doc: Document, reducedMotion: boolean, effects: () => boolean) {
  const purchase = element(doc, "purchase-feedback");
  const record = element(doc, "record-feedback");
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  function show(node: HTMLElement, label: string, name: string, detail: string, duration: number) {
    clearTimeout(timers.get(node));
    const card = doc.createElement("div");
    card.className = "celebration-card";
    const mark = doc.createElement("span");
    mark.className = "celebration-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "✦";
    const kicker = doc.createElement("span");
    kicker.className = "celebration-label";
    kicker.textContent = label;
    const title = doc.createElement("strong");
    title.textContent = name;
    const note = doc.createElement("span");
    note.className = "celebration-detail";
    note.textContent = detail;
    card.append(mark, kicker, title, note);
    node.replaceChildren(card);
    if (!reducedMotion && effects()) {
      const sparks = doc.createElement("div");
      sparks.className = "celebration-sparks";
      sparks.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 16; i++) {
        const spark = doc.createElement("i");
        const angle = (i * Math.PI) / 8;
        const radius = 65 + (i % 3) * 25;
        spark.style.setProperty("--spark-x", `${Math.cos(angle) * radius}px`);
        spark.style.setProperty("--spark-y", `${Math.sin(angle) * radius}px`);
        spark.style.setProperty("--spark-delay", `${(i % 4) * 35}ms`);
        sparks.append(spark);
      }
      node.append(sparks);
    }
    node.hidden = false;
    timers.set(
      node,
      setTimeout(() => {
        node.hidden = true;
        timers.delete(node);
      }, duration),
    );
  }
  return {
    purchase(name: string) {
      show(purchase, "ACQUIRED", name, "Added to your kit · equipped", 2200);
    },
    record(score: bigint) {
      show(
        record,
        "PERSONAL BEST",
        "RECORD BROKEN",
        `${score.toLocaleString("en-US")} points · keep running`,
        2800,
      );
    },
    clear() {
      for (const [node, timer] of timers) {
        clearTimeout(timer);
        node.hidden = true;
      }
      timers.clear();
    },
  };
}
export = { create };
