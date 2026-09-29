// A small Chrome DevTools Protocol driver for headless Chromium, used by screenshots.mjs.
// Needs a global WebSocket: Node 22+, or Node 20 with --experimental-websocket.
// Set CHROME to the browser binary if it isn't `chromium` on PATH.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function launch({ width = 1400, height = 900, dark = true } = {}) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'sandpainter-cdp-'));
  const proc = spawn(process.env.CHROME || 'chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('browser did not start')), 20000);
    proc.stderr.on('data', (d) => { if (String(d).includes('DevTools listening')) { clearTimeout(t); res(); } });
  });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  let seq = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    } else if (msg.method) events.push(msg);
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const page = {
    send, sleep,
    async goto(url, wait = 1500) {
      await send('Page.navigate', { url });
      await sleep(wait);
    },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async click(x, y, button = 'left') {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: 1 });
    },
    async shot(path, clip, scale = 1) {
      const params = { format: 'png' };
      if (clip) params.clip = { ...clip, scale };
      const r = await send('Page.captureScreenshot', params);
      writeFileSync(path, Buffer.from(r.data, 'base64'));
    },
    errors() {
      return events.filter((e) => e.method === 'Runtime.exceptionThrown'
        || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
    },
    async close() {
      try { ws.close(); } catch { /* already closed */ }
      proc.kill('SIGKILL');
      await sleep(200);
      rmSync(profile, { recursive: true, force: true });
    },
  };
  return page;
}
