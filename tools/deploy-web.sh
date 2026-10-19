#!/bin/bash
# Build the game and publish it to https://beak-rash.erapi0neer.xyz (Vercel project "beak-rash").
# The domain is attached to the project, and *.erapi0neer.xyz is a wildcard CNAME to Vercel, so a
# production deploy is all it takes. Usage: tools/deploy-web.sh [--no-build]
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
[[ " $* " == *" --no-build "* ]] || npm run build
STAGE=$(mktemp -d "$HOME/m/beak-rash-web.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT
cp -R dist/. "$STAGE/"
# Hashed JS/CSS/fonts never change under the same name; public/ art and voices keep Vercel's revalidation.
cat > "$STAGE/vercel.json" <<'JSON'
{
  "headers": [
    {
      "source": "/assets/(.*)\\.(js|css|woff|woff2)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
JSON
cd "$STAGE"
vercel link --yes --project beak-rash >/dev/null
vercel deploy --prod --yes
echo "live: https://beak-rash.erapi0neer.xyz"
