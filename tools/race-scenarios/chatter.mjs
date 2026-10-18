// Chatter scenario (critic r2): rival taunts are paced — race-owned lines ≥ 2 s apart (idle ≤ ~13/min), never
// the third bubble within 3 s, and no rider repeats a line within 60 s. Skill shouts and bell rings (combat)
// are told apart by the skill:cast / combat:bell of the same rider at the same moment.
import { events, openRace } from '../race-lib.mjs';

const DT = 1 / 30;

export const chatterScenarios = {
  async chatter(page, h, { check, stub, a }) {
    for (const level of String(a.levels ?? '1,3').split(',').map(Number)) {
      await openRace(h, `race=coast&seed=${a.seed ?? 3}&level=${level}&manual=1&intro=0${stub}`);
      for (let i = 0; i < 6; i++) await h.eval(`window.__runHuman(450, ${DT}, 1000, 'passive')`);
      const casts = [...(await events(h, 'skill:cast')), ...(await events(h, 'combat:bell'))];
      const all = (await events(h, 'taunt')).filter((e) => e.p.riderId !== 0);
      const shout = (e) => casts.some((c) => c.p.riderId === e.p.riderId && Math.abs(c.time - e.time) < 0.05);
      const own = all.filter((e) => !shout(e));
      const gaps = own.slice(1).map((e, i) => e.time - own[i].time);
      // Stacking: a race line said while 2+ lines (any source) are already up from the last 3 s. Combat's skill
      // shouts / bells come whenever skills fire, so 3-in-3 s windows overall are reported, not judged.
      const stacked = own.filter((e) => all.filter((q) => q !== e && q.time <= e.time && e.time - q.time < 3).length >= 2).length;
      const bursts = all.filter((e, i) => all.filter((q, j) => j >= i && q.time - e.time < 3).length >= 3).length;
      const rep = own.filter((e, i) => own.slice(0, i).some((q) => q.p.riderId === e.p.riderId && q.p.text === e.p.text && e.time - q.time < 60));
      const repeats = rep.length;
      const minutes = (own.at(-1)?.time ?? 1) / 60;
      const info = { level, own: own.length, perMin: +(own.length / minutes).toFixed(1), minGap: +Math.min(...gaps).toFixed(2), stacked, bursts, repeats, shouts: all.length - own.length,
        rep: rep.map((e) => `${e.p.character}:${e.p.text}@${e.time.toFixed(0)}`).join(' ') };
      check(`chatter L${level}: race taunts ≥ 2 s apart, ≤ 14/min, never stacked on 2 lines in 3 s, no repeat within 60 s`,
        own.length > 3 && info.minGap >= 2 && info.perMin <= 14 && stacked === 0 && repeats === 0, info);
    }
  },
};
