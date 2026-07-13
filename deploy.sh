#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy the Kingdom Scoreboard to Vercel via the REST API (no Vercel CLI needed).
# Uploads each static file (v2/files) then creates a production deployment
# (v13/deployments). Reads tokens from .env (gitignored). Re-run after any edit.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

TOKEN=$(grep '^VERCEL_TOKEN=' .env | cut -d= -f2)
TEAM=$(grep '^VERCEL_TEAM_ID=' .env | cut -d= -f2)
PROJECT="kingdom-scoreboard"

# Files that make up the deployed site (everything else stays out — see .vercelignore).
FILES=(index.html app.js config.js lib/cloud.js vercel.json api/deals.js)

echo "Uploading ${#FILES[@]} files…"
ENTRIES=""
for f in "${FILES[@]}"; do
  sha=$(shasum -a 1 "$f" | cut -d' ' -f1)
  size=$(wc -c < "$f" | tr -d ' ')
  curl -s -X POST "https://api.vercel.com/v2/files?teamId=${TEAM}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/octet-stream" \
    -H "x-vercel-digest: ${sha}" \
    --data-binary "@${f}" > /dev/null
  echo "  ✓ $f ($size bytes)"
  ENTRIES="${ENTRIES}{\"file\":\"${f}\",\"sha\":\"${sha}\",\"size\":${size}},"
done
ENTRIES="[${ENTRIES%,}]"

echo "Creating production deployment…"
BODY=$(jq -n --arg name "$PROJECT" --argjson files "$ENTRIES" \
  '{name:$name, files:$files, target:"production", projectSettings:{framework:null}}')

RESP=$(curl -s -X POST "https://api.vercel.com/v13/deployments?teamId=${TEAM}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$BODY")

DEP_URL=$(echo "$RESP" | jq -r '.url // empty')
DEP_ID=$(echo "$RESP" | jq -r '.id // empty')
if [ -z "$DEP_URL" ]; then
  echo "DEPLOY FAILED:"; echo "$RESP" | jq .; exit 1
fi
echo "Deployment created: https://${DEP_URL}  (id: ${DEP_ID})"

echo -n "Waiting for READY"
for i in $(seq 1 40); do
  STATE=$(curl -s "https://api.vercel.com/v13/deployments/${DEP_ID}?teamId=${TEAM}" \
    -H "Authorization: Bearer ${TOKEN}" | jq -r '.status // .readyState // "?"')
  if [ "$STATE" = "READY" ]; then echo " READY"; break; fi
  if [ "$STATE" = "ERROR" ]; then echo " ERROR"; exit 1; fi
  echo -n "."; sleep 3
done

echo ""
echo "Production aliases:"
curl -s "https://api.vercel.com/v13/deployments/${DEP_ID}?teamId=${TEAM}" \
  -H "Authorization: Bearer ${TOKEN}" | jq -r '.alias[]? | "  https://\(.)"'
