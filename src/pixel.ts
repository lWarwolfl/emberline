function create(ctx: CanvasRenderingContext2D) {
  function rect(x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function line(x: number, y: number, w: number, color: string) {
    rect(x, y, w, 1, color);
  }
  function triangle(x: number, bottom: number, width: number, height: number, color: string) {
    for (let row = 0; row < height; row++) {
      const inset = Math.floor(((1 - row / height) * width) / 2);
      rect(x + inset, bottom - height + row, Math.max(1, width - inset * 2), 1, color);
    }
  }
  return { rect, line, triangle };
}

function mix(a: string, b: string, amount: number) {
  const first = parseInt(a.slice(1), 16),
    second = parseInt(b.slice(1), 16);
  const channels = [16, 8, 0].map((shift) =>
    Math.round(((first >> shift) & 255) * (1 - amount) + ((second >> shift) & 255) * amount),
  );
  return "#" + channels.map((value) => value.toString(16).padStart(2, "0")).join("");
}
export = { create, mix };
