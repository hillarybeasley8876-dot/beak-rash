// STUB kept by core as load fallback for gameplay/achievements.ts (content unit): unlocks nothing.
import type { AppContext, Session } from '../core/contracts';

export interface AchievementSystemLike {
  attach(session: Session | null): void;
  dispose(): void;
}

export function createAchievements(app: AppContext): AchievementSystemLike {
  void app;
  return { attach: () => undefined, dispose: () => undefined };
}
