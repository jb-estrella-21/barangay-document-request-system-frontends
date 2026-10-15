#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-${TMPDIR:-/tmp}/barangay-cf-config}"

usage() {
  echo "Usage: scripts/pages.sh check|deploy resident|staff" >&2
  exit 2
}

[[ $# -eq 2 ]] || usage
action="$1"
app="$2"
case "$app" in
  resident) app_dir="frontend-website"; config="wrangler.resident.jsonc" ;;
  staff) app_dir="frontend-admin"; config="wrangler.staff.jsonc" ;;
  *) usage ;;
esac
[[ "$action" == "check" || "$action" == "deploy" ]] || usage

wrangler="$repo_root/integration-e2e/node_modules/.bin/wrangler"
[[ -x "$wrangler" ]] || { echo "Install integration-e2e dependencies first (npm ci)." >&2; exit 1; }

VITE_API_BASE_URL=/api/v1 npm --prefix "$app_dir" run build
node - "$app_dir/dist" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const out = process.argv[2];
if (!fs.existsSync(path.join(out, 'index.html'))) throw new Error('Vite output is missing index.html');
const routes = JSON.parse(fs.readFileSync(path.join(out, '_routes.json'), 'utf8'));
if (JSON.stringify(routes) !== JSON.stringify({ version: 1, include: ['/api/v1/*'], exclude: [] })) {
  throw new Error('Built _routes.json must invoke Functions only for /api/v1/*');
}
if (!fs.existsSync(path.join(out, '_headers'))) throw new Error('Vite output is missing _headers');
NODE

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/phase5b-pages.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT
stage_dir="$tmp_dir/project"
mkdir -p "$stage_dir"
cp -R "$app_dir/dist" "$stage_dir/dist"
cp -R functions "$stage_dir/functions"
cp "$config" "$stage_dir/wrangler.jsonc"
(
  cd "$stage_dir"
  "$wrangler" pages functions build functions \
    --outfile "$tmp_dir/functions.js" \
    --output-routes-path "$tmp_dir/_routes.json"
)
[[ -s "$tmp_dir/functions.js" ]] || { echo "Wrangler did not produce a Functions bundle." >&2; exit 1; }

if [[ "$action" == "deploy" ]]; then
  [[ "${PHASE5C_DEPLOY_APPROVED:-}" == "YES" ]] || {
    echo "Remote deploy blocked. Phase 5C requires explicit approval and PHASE5C_DEPLOY_APPROVED=YES." >&2
    exit 3
  }
  project_name="$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).name)' "$config")"
  (
    cd "$stage_dir"
    "$wrangler" pages deploy dist --project-name "$project_name"
  )
  exit $?
fi

echo "Local Pages output and shared Function bundle validated for $app."
