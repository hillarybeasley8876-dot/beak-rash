// Touch HUD input contract: virtual KEYMAP holds, keyboard still steers, flap side, device detection.
//   node tools/touch-input-check.mjs
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const inputMod = await vite.ssrLoadModule('/src/core/input.ts');
const touchMod = await vite.ssrLoadModule('/src/ui/touch-device.ts');
const { Input, KEYMAP } = inputMod;
const { ATTACK_HOLD_MS, flapSide, isAndroidWebView, steerAxis, touchPrimary, wantsTouchHud } = touchMod;

const problems = [];
const expect = (ok, what) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) problems.push(what);
};

const listeners = {};
const fakeWindow = {
  addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
  removeEventListener() {},
};

const input = new Input();
input.attach(fakeWindow);

const down = (code) => listeners.keydown[0]({ code, repeat: false, metaKey: false, ctrlKey: false, preventDefault() {} });
const up = (code) => listeners.keyup[0]({ code });

console.log('[touch-input] keyboard still drives steer');
down('ArrowLeft');
input.update(0.2);
expect(input.steer < -0.5, `ArrowLeft ramps steer left (got ${input.steer.toFixed(3)})`);
up('ArrowLeft');
down('KeyD');
input.update(0.05);
expect(input.steer > 0, `KeyD reverses through centre (got ${input.steer.toFixed(3)})`);
up('KeyD');
input.update(1);
expect(Math.abs(input.steer) < 0.05, `steer falls back to centre (got ${input.steer.toFixed(3)})`);

console.log('[touch-input] virtual KEYMAP holds');
expect(KEYMAP.left.includes('ArrowLeft') && KEYMAP.left.includes('TouchLeft'), 'left keeps ArrowLeft and adds TouchLeft');
expect(KEYMAP.heavy.includes('KeyK') && KEYMAP.heavy.includes('TouchHeavy'), 'heavy keeps KeyK and adds TouchHeavy');
expect(!KEYMAP.hop.some((c) => c.startsWith('Touch')), 'hop stays an edge (no held touch code)');

input.hold('left');
expect(input.isDown('left') && !input.isDown('right'), 'hold(left) is down via KEYMAP');
input.update(0.2);
expect(input.steer < -0.5, `touch left ramps steer (got ${input.steer.toFixed(3)})`);
const locked = input.steer;
down('KeyD');
input.update(0.05);
expect(Math.abs(input.steer) < Math.abs(locked) - 0.2, `touch left + KeyD ease off full lock (got ${input.steer.toFixed(3)})`);
up('KeyD');
input.release('left');
expect(!input.isDown('left'), 'release(left) clears the virtual code and leaves the physical key alone');
input.update(1);

input.hold('drift');
input.hold('heavy');
const peek = {
  steer: 0, throttle: 0, brake: 0, drift: false, lookBack: false, heavyHeld: false,
  hop: false, attackL: false, attackR: false, heavy: false,
  skill1: false, skill2: false, skill3: false, ult: false, bell: false,
};
input.peek(peek);
expect(peek.drift && peek.heavy && peek.heavyHeld, 'drift hold + heavy hold latch the edge and heavyHeld');
input.hold('heavy');
input.peek(peek);
expect(peek.heavy, 'a second hold(heavy) does not drop the latched edge');
input.release('heavy');
input.peek(peek);
expect(!peek.heavyHeld && peek.heavy, 'release(heavy) drops heavyHeld and keeps the edge until consume');
input.consumeEdges();
input.peek(peek);
expect(!peek.heavy, 'consume clears the heavy edge');
expect(peek.drift, 'drift is still held after consumeEdges');
input.release('drift');
input.peek(peek);
expect(!peek.drift, 'release(drift) lets go');

input.press('attackL');
input.peek(peek);
expect(peek.attackL && !input.isDown('attackL'), 'press(attackL) is an edge without a held key');
input.press('hop');
input.press('skill1');
input.press('bell');
input.peek(peek);
expect(peek.hop && peek.skill1 && peek.bell, 'hop / skill / bell edges come from press()');
input.consumeEdges();

console.log('[touch-input] blur drops virtual holds');
input.hold('right');
listeners.blur[0]();
expect(!input.isDown('right'), 'window blur clears TouchRight with the other keys');
input.release('right');

console.log('[touch-input] steer disc and flap side');
const disc = { left: 100, width: 100 };
expect(steerAxis(150, disc) === 0, 'centre of the disc is straight');
expect(steerAxis(110, disc) === -1, 'left side of the disc steers left');
expect(steerAxis(190, disc) === 1, 'right side of the disc steers right');
expect(ATTACK_HOLD_MS >= 280 && ATTACK_HOLD_MS <= 450, `attack hold is a long-press (${ATTACK_HOLD_MS} ms)`);

const me = { s: 10, x: 0 };
expect(flapSide(me, []) === 'attackR', 'nobody near, lane centre, flaps right');
expect(flapSide({ s: 10, x: 1 }, []) === 'attackL', 'right of centre flaps back toward the pack');
const rival = { s: 11, x: 2, mode: 'racing', isPlayer: false };
expect(flapSide(me, [rival]) === 'attackR', 'rival on the right gets the right wing');
expect(flapSide(me, [{ ...rival, x: -1.5 }]) === 'attackL', 'rival on the left gets the left wing');
expect(flapSide(me, [{ ...rival, mode: 'crashed' }]) === 'attackR', 'a crashed rival is not a flap target');
expect(flapSide(me, [{ s: 40, x: 2, mode: 'racing', isPlayer: false }]) === 'attackR', 'a rival 30 m ahead is out of reach');

console.log('[touch-input] device gate');
const desk = { ua: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0', maxTouchPoints: 0, coarse: false, fine: true, androidBridge: false };
const phone = { ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120.0.0.0 Mobile', maxTouchPoints: 5, coarse: true, fine: false, androidBridge: false };
const webview = { ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36', maxTouchPoints: 5, coarse: false, fine: true, androidBridge: false };
const oldWv = { ua: 'Mozilla/5.0 (Linux; Android 4.4; Build) AppleWebKit/537.36 Version/4.0 Mobile Safari/537.36', maxTouchPoints: 1, coarse: false, fine: false, androidBridge: false };
const laptopTouch = { ua: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0', maxTouchPoints: 10, coarse: false, fine: true, androidBridge: false };
expect(!touchPrimary(desk), 'desktop is not touch-primary');
expect(touchPrimary(phone), 'coarse Android is touch-primary');
expect(isAndroidWebView(webview) && touchPrimary(webview), 'Android WebView (; wv) is touch-primary even if it reports a fine pointer');
expect(isAndroidWebView(oldWv), 'old Android WebView (Version/ without Chrome) counts');
expect(!touchPrimary(laptopTouch), 'a desktop touchscreen stays on the keyboard path until a finger lands');
expect(!wantsTouchHud(new URLSearchParams('touch=0'), phone), '?touch=0 hides the bar on a phone');
expect(wantsTouchHud(new URLSearchParams('touch=1'), desk), '?touch=1 shows the bar on a desktop');
expect(!wantsTouchHud(new URLSearchParams(''), desk), 'desktop default hides the bar');

input.dispose();
await vite.close();

if (problems.length) {
  console.error(`\n${problems.length} failed`);
  process.exit(1);
}
console.log('\nall touch-input checks passed');
