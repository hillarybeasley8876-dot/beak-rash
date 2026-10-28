// STUB kept by core as load fallback for net/ (SPEC §28): no relay, no rooms. An online race cannot run on it
// (frame() never ticks); the lobby screens show its message.
import type { AppContext, NetRoom, NetState, NetSystem } from '../core/contracts';

export function createNet(app: AppContext): NetSystem {
  void app;
  const state: NetState = 'offline';
  return {
    state,
    message: '联机模块没加载上',
    ping: null,
    room: null as NetRoom | null,
    onChange: () => () => undefined,
    connect: async () => false,
    createRoom: () => undefined,
    joinRoom: () => undefined,
    pick: () => undefined,
    ready: () => undefined,
    setup: () => undefined,
    start: () => undefined,
    leave: () => undefined,
    frame: () => 0,
  };
}
