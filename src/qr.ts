import { encode, type QrCodeGenerateOptions } from "uqr";

/** Draw a scannable code in the game's parchment and charcoal. */
export function drawQr(
  canvas: HTMLCanvasElement,
  text: string,
  ecc: QrCodeGenerateOptions["ecc"] = "M",
) {
  const qr = encode(text, { ecc, border: 2, maxVersion: 40 });
  const cells = qr.size;
  const scale = Math.max(2, Math.floor(240 / cells));
  canvas.width = cells * scale;
  canvas.height = cells * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not draw the join code.");
  context.fillStyle = "#ece6d6";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#101514";
  for (let y = 0; y < cells; y++) {
    const row = qr.data[y];
    for (let x = 0; x < cells; x++)
      if (row[x]) context.fillRect(x * scale, y * scale, scale, scale);
  }
}
