/** Globals exposed by the real game in ?dev=1, used inside Playwright page callbacks. */
declare const Emberline: Window["Emberline"];
declare const EmberlineDebug: NonNullable<Window["EmberlineDebug"]>;
declare const audioCount: { tones: number; noise: number };
interface Window {
  audioCount: typeof audioCount;
}
