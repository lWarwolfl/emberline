import * as playwright from "playwright";
/** Allow a separately installed Playwright while keeping its public API typed. */
const external = process.env.PLAYWRIGHT_MODULE
  ? (require(process.env.PLAYWRIGHT_MODULE) as typeof playwright)
  : playwright;
export const chromium = external.chromium;
