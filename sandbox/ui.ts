// UI screens sandbox: one iframe running the real game on `?screen=<id>`, with screen buttons, size
// presets (16:9 / 16:10) and a stub toggle (other units as core stubs). Keyboard works inside the frame.
const SCREENS = ['boot', 'title', 'menu', 'career', 'trackSelect', 'garage', 'loading', 'pause', 'results', 'settings', 'howto', 'credits'] as const;
const SIZES: Array<[number, number]> = [[1280, 720], [1920, 1080], [1440, 900], [2560, 1440]];
const OTHER_UNITS = 'world,sim,camera,actors,combat,race,fx,audio';

const bar = document.getElementById('bar') as HTMLDivElement;
const stage = document.getElementById('stage') as HTMLDivElement;
const frame = document.getElementById('frame') as HTMLIFrameElement;
const params = new URLSearchParams(location.search);
let current = params.get('screen') ?? 'title';
let size = SIZES[0] ?? [1280, 720];
let stubbed = params.get('real') !== '1';

function button(label: string, on: () => boolean, run: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    run();
    render();
  });
  buttons.push([b, on]);
  bar.append(b);
  return b;
}

const buttons: Array<[HTMLButtonElement, () => boolean]> = [];
for (const id of SCREENS) button(id, () => current === id, () => (current = id));
const label = document.createElement('label');
label.textContent = 'size';
bar.append(label);
for (const s of SIZES) button(`${s[0]}×${s[1]}`, () => size === s, () => (size = s));
button('stub others', () => stubbed, () => (stubbed = !stubbed));
button('reload', () => false, () => frame.contentWindow?.location.reload());

function fit(): void {
  const k = Math.min(stage.clientWidth / size[0], stage.clientHeight / size[1]) * 0.96;
  frame.style.width = `${size[0]}px`;
  frame.style.height = `${size[1]}px`;
  frame.style.transform = `scale(${k})`;
}

function render(): void {
  for (const [b, on] of buttons) b.classList.toggle('on', on());
  const src = `/?screen=${current}${stubbed ? `&stub=${OTHER_UNITS}` : ''}`;
  if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
  fit();
  history.replaceState(null, '', `?screen=${current}${stubbed ? '' : '&real=1'}`);
}

window.addEventListener('resize', fit);
frame.addEventListener('load', () => frame.contentWindow?.focus());
render();

export {};
