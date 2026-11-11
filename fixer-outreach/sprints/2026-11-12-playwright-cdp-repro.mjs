/**
 * Independent reproduction harness for public issue:
 * https://github.com/microsoft/playwright/issues/44052
 *
 * Run in a disposable local test environment only:
 *   npm install playwright
 *   node fixer-outreach/sprints/2026-11-12-playwright-cdp-repro.mjs
 *
 * This test intentionally creates a busy renderer. Do not run in a personal
 * browser profile or against a browser holding real sessions.
 * No vendor infrastructure is targeted.
 */
import { chromium } from 'playwright';
import { setTimeout as delay } from 'node:timers/promises';

const DEBUG_PORT = 19333;
const TIMEOUT_MS = 5000;
let browser;
let connected;
try {
  browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${DEBUG_PORT}`],
  });
  const context = browser.contexts()[0];
  const page = await context.newPage();
  await page.goto('data:text/html,<title>local-test</title><p>Busy renderer repro</p>');
  // Start a bounded CPU stall inside this one disposable test page.
  await page.evaluate(() => {
    setTimeout(() => {
      const end = performance.now() + 12000;
      while (performance.now() < end) { /* intentional stall */ }
    }, 100);
  });
  await delay(400);
  const started = performance.now();
  try {
    connected = await chromium.connectOverCDP(
      `http://127.0.0.1:${DEBUG_PORT}`,
      { timeout: TIMEOUT_MS }
    );
    console.log(JSON.stringify({
      status: 'connected',
      durationMs: Math.round(performance.now() - started),
      pageCount: connected.contexts().flatMap(c => c.pages()).length
    }));
  } catch (error) {
    console.log(JSON.stringify({
      status: 'connect_error',
      errorName: error.name,
      message: error.message.slice(0, 400),
      durationMs: Math.round(performance.now() - started)
    }));
    process.exitCode = 1;
  }
} finally {
  await connected?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
