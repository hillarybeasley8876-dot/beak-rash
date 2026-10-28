# The online rooms' relay (SPEC §28) as a container: Deno, no third-party modules. Built from the repo root
# (render.yaml: dockerContext .) because the relay imports the shared protocol from src/net/protocol.ts.
FROM denoland/deno:2.7.14

WORKDIR /app
COPY src/net/protocol.ts src/net/protocol.ts
COPY relay/ relay/
RUN deno cache relay/main.ts

USER deno
# The host passes the port in PORT (Render: 10000); the relay reads it with --allow-env=PORT.
EXPOSE 10000
CMD ["run", "--allow-net", "--allow-env=PORT", "relay/main.ts"]
