// Audio lab look: P5-ish red / black / white, skewed buttons.
export const LAB_CSS = `
body { margin: 0; background: #0b0b0f; color: #fff; font: 14px/1.3 "Noto Sans SC", "PingFang SC", sans-serif; }
#app { padding: 18px 26px 60px; }
.head { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 22px; background: #e5191c; padding: 14px 22px;
  clip-path: polygon(0 0, 100% 0, 98.5% 100%, 1% 92%); margin-bottom: 14px; }
.head h1 { margin: 0; font-size: 34px; letter-spacing: 2px; transform: skewX(-10deg); text-shadow: 4px 4px 0 #0b0b0f; }
.sub { margin: 0; font-weight: 700; color: #0b0b0f; }
.status { flex-basis: 100%; font-family: monospace; color: #fff; }
.meter { display: block; width: 900px; height: 160px; border: 3px solid #fff; margin: 4px 0 8px; }
.now { min-height: 20px; color: #ffe600; max-width: 1200px; font-size: 13px; margin-bottom: 8px; }
.box { margin: 12px 0; }
.box h2 { display: inline-block; margin: 0 0 8px; padding: 2px 14px; background: #fff; color: #0b0b0f; font-size: 15px;
  transform: skewX(-12deg); }
.btns { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
button { border: 2px solid #fff; background: #0b0b0f; color: #fff; padding: 6px 12px; font: 700 13px sans-serif;
  transform: skewX(-8deg); cursor: pointer; white-space: pre; }
button:hover { background: #e5191c; }
button:active { background: #fff; color: #0b0b0f; }
button.big { font-size: 18px; padding: 10px 20px; background: #0b0b0f; }
button.song { border-color: #e5191c; min-width: 150px; text-align: left; }
button.sting { border-color: #ffe600; }
button.alt { border-style: dashed; }
button.ann { border-color: #ffe600; }
button.bark { border-color: #9aa4b2; font-weight: 400; }
.slider { display: inline-flex; align-items: center; gap: 8px; margin-right: 18px; font-weight: 700; }
.slider input { width: 180px; accent-color: #e5191c; }
`;
