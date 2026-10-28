# beak-rash relay — the relay for online rooms

The relay of SPEC §28: 2–4 friends race through it. It has **no game logic**. It keeps the rooms, forwards the
host's RaceConfig untouched, waits until every human has loaded and then paces the race: 60 times a second it
sends one `tick` message to every member with the latest input of every human. The clients simulate the race
themselves (deterministic lockstep) — only the inputs travel.

The wire protocol is `src/net/protocol.ts` (shared by the client and the relay); the relay never changes it.

## Run it

Deno 2.x, no third-party modules — only the Deno runtime and the web platform:

```
deno run --allow-net relay/main.ts --port 8790
```

| flag | default | what it does |
| --- | --- | --- |
| `--port` | 8790 | the port the relay listens on (`0.0.0.0`) |
| `--idle-ms` | 20000 | a client that stays silent this long is dropped (`error idle`) |
| `--load-ms` | 30000 | how long the relay waits for every human's `loaded`; the late ones are dropped |
| `--grace-ms` | 45000 | how long the race runs after the first human is done |

`GET /` answers `beak-rash relay ok` (a health check), `GET /ws` is the WebSocket. The client points at the relay
with `?relay=ws://host:8790`; behind HTTPS the client uses `wss://host/ws`.

Every room event is one log line (created, joined, started, go, ended + reason, closed) with a timestamp. The
inputs are never logged.

## What it enforces

- 4 humans per room, a 4-letter code out of `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I/O/0/1/L).
- 4 KB per message, 120 messages a second per client, an idle timeout.
- The handshakes are answered one after the other (30 ms apart): a burst of clients is spread out instead of
  piling up in the same millisecond.
- The host starts the race: every member must be ready and the rider slots must be exactly the members.
- The load barrier: the race starts when every human has loaded, or after `--load-ms` without the late ones.
- One drift-corrected 60 Hz tick loop per room: tick *n* is due at `start + n/60 s`, a late timer emits two ticks
  in a row and never skips a number. Per slot the relay keeps the latest analog + held values and the OR of the
  edge bits since the previous tick, so an edge press lands in exactly one tick.
- The hashes: every 60 ticks the clients report the hash of their state; if they differ the relay broadcasts
  `desync` and ends the race for everyone.
- The race ends when every human is done, after the finish grace, when a desync is found, or when no human of the
  race is connected any more. Then the room goes back to the lobby.

## Deploy it

Any host with Deno and a public port:

```
deno run --allow-net relay/main.ts --port 8790
```

As a systemd unit (`/etc/systemd/system/beak-rash-relay.service`):

```
[Unit]
Description=beak-rash relay
After=network.target

[Service]
ExecStart=/usr/local/bin/deno run --allow-net /srv/beak-rash/relay/main.ts --port 8790
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Behind a reverse proxy the client speaks `wss://host/ws`; nginx passes the upgrade on:

```
location /ws {
  proxy_pass http://127.0.0.1:8790/ws;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
}
```

The relay is stateless: every room lives in the memory of the process, so a restart drops the rooms (and the
races with them).

## Test it

```
deno check relay/main.ts        # the types
node tools/r6/relay.mjs         # the acceptance: rooms, the load barrier, the tick stream, the limits
```
