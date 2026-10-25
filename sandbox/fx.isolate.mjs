// Re-render one gameplay frame with fx layers toggled, to attribute visual artifacts.
//   node sandbox/fx.isolate.mjs --frames 600 [--seed 5] [--track coast]
import { parseArgs, withPage } from '../tools/lib.mjs';

const a = parseArgs(process.argv.slice(2));
await withPage(async (page, h) => {
  await h.goto(`/?race=${a.track ?? 'coast'}&seed=${a.seed ?? 5}&autopilot=1`);
  await h.step(Number(a.frames ?? 600));
  const shot = async (tag, js) => {
    await page.evaluate(js);
    await page.evaluate(() => window.__br.game.frame(0));
    await h.shot(`${process.env.FX_OUT ?? 'shots/fx'}/iso-${tag}.png`);
  };
  await shot('all', () => {});
  await shot('nolines', () => { window.__br.fx.post.speed.lines = 0; window.__br.fx.post.speed.edgeBlur = 0; });
  await shot('noparticles', () => { window.__br.app.scene.getObjectByName('fx.particles').visible = false; });
  await shot('nopost', () => { window.__br.fx.toggles.enabled = false; });
}, { size: '1280x720' });
