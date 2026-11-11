#!/usr/bin/env bash
#
# Kitvoy release deploy. Copied to the server next to the bundle and run there:
#
#   git bundle create kitvoy.bundle <live sha>..kitvoy-main
#   scp kitvoy.bundle scripts/deploy/release.sh root@<server>:/root/kitvoy-deploy/
#   ssh root@<server> 'nohup bash /root/kitvoy-deploy/release.sh /root/kitvoy-deploy/kitvoy.bundle kitvoy-main [--db-push] [--allow-peak] > /root/kitvoy-deploy/deploy.log 2>&1 < /dev/null &'
#   ssh root@<server> 'cat /root/kitvoy-deploy/deploy.log'      # ends with LIVE: <sha>, or says why it rolled back
#
# To go back by hand: point /var/www/kitvoy at the previous directory in
# /var/www/kitvoy-releases (ln -sfn <dir> /var/www/kitvoy.switch && mv -T
# /var/www/kitvoy.switch /var/www/kitvoy) and run `pm2 reload kitvoy`.
#
# What it does, in order:
#   1. Builds the new version in its own directory under /var/www/kitvoy-releases.
#      The live server keeps serving its own build the whole time; nothing is
#      rebuilt underneath it.
#   2. Switches the /var/www/kitvoy symlink to the new release and reloads PM2.
#   3. Smoke-tests the result with GET requests only (home, /checkout, a script
#      of the new build, the cart quote, Stripe.js), on the server and through
#      the public URL.
#   4. If any check fails, switches back to the previous release and reloads again.
#
# --db-push     back up PostgreSQL, then apply the Prisma schema (additive changes only)
# --allow-peak  deploy between 23:00 and 06:00 UTC (US evening), which is refused otherwise
#
# It never prints secrets, never sources .env into the PM2 shell, and reloads
# only the kitvoy process.
set -euo pipefail

BUNDLE="${1:?usage: release.sh <bundle> <branch> [--db-push] [--allow-peak]}"
BRANCH="${2:?usage: release.sh <bundle> <branch> [--db-push] [--allow-peak]}"
shift 2
DB_PUSH=0
ALLOW_PEAK=0
for arg in "$@"; do
  case "$arg" in
    --db-push) DB_PUSH=1 ;;
    --allow-peak) ALLOW_PEAK=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

APP=/var/www/kitvoy
RELEASES=/var/www/kitvoy-releases
REPO=/var/www/kitvoy-repo.git
PM2_NAME=kitvoy
ORIGIN=http://127.0.0.1:3000
PUBLIC=https://kitvoy.com
KEEP=3
TS="$(date -u +%Y%m%d%H%M%S)"

say() { printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { say "ABORTED: $*"; exit 1; }

hour="$(date -u +%-H)"
if { [ "$hour" -ge 23 ] || [ "$hour" -lt 6 ]; } && [ "$ALLOW_PEAK" -ne 1 ]; then
  die "it is $(date -u +%H:%M) UTC, inside the 23:00-06:00 UTC window. Deploy later, or pass --allow-peak."
fi
[ -f "$BUNDLE" ] || die "bundle not found: $BUNDLE"

# Node and PM2 come from nvm; a non-interactive shell doesn't load it by itself
# shellcheck disable=SC1090
source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || die "nvm not found"
command -v pm2 >/dev/null || die "pm2 not found"

# ---- 1. layout: /var/www/kitvoy is a symlink to the current release ----
mkdir -p "$RELEASES"
if [ ! -L "$APP" ]; then
  [ -d "$APP/.git" ] || die "$APP is neither a release symlink nor the original checkout"
  [ -d "$REPO" ] || git clone --quiet --bare "$APP" "$REPO"
  LEGACY="$RELEASES/legacy-$(git -C "$APP" rev-parse --short HEAD)"
  say "first release-style deploy: moving the original checkout to $LEGACY"
  mv "$APP" "$LEGACY"
  ln -s "$LEGACY" "$APP"
fi
CURRENT="$(readlink -f "$APP")"
[ -d "$CURRENT/.next" ] || die "the current release at $CURRENT has no build"

# ---- 2. source: the bundle must fast-forward what was released last ----
git --git-dir="$REPO" fetch --quiet "$BUNDLE" "refs/heads/$BRANCH:refs/heads/release" || die "the bundle doesn't fast-forward the last release"
SHA="$(git --git-dir="$REPO" rev-parse --short release)"
NEW="$RELEASES/$TS-$SHA"
say "building $SHA in $NEW (live: $(basename "$CURRENT"))"
mkdir "$NEW"
git --git-dir="$REPO" archive release | tar -x -C "$NEW"

discard() { rm -rf "$NEW"; }

# ---- 3. dependencies and configuration, copied from the live release ----
if cmp -s "$CURRENT/package-lock.json" "$NEW/package-lock.json"; then
  cp -a "$CURRENT/node_modules" "$NEW/node_modules"
else
  say "package-lock.json changed: installing dependencies"
  (cd "$NEW" && npm ci --no-audit --no-fund >"/root/kitvoy-npm.$TS.log" 2>&1) || { discard; die "npm ci failed, see /root/kitvoy-npm.$TS.log"; }
fi
cp -a "$CURRENT/.env" "$NEW/.env"
cd "$NEW"
npx prisma generate >/dev/null 2>&1 || { discard; die "prisma generate failed"; }

# ---- 4. database: back up first, then additive schema changes only ----
if [ "$DB_PUSH" -eq 1 ]; then
  BACKUP="/root/kitvoy-db.$TS.before-$SHA.sql"
  # The connection string is read in a subshell and never printed; pg_dump doesn't accept Prisma's ?schema= suffix
  ( DB="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed 's/?schema=.*//')"; pg_dump "$DB" >"$BACKUP" ) || { discard; die "database backup failed"; }
  chmod 600 "$BACKUP"
  say "database backed up to $BACKUP ($(du -h "$BACKUP" | cut -f1))"
  npx prisma db push --skip-generate >"/root/kitvoy-dbpush.$TS.log" 2>&1 || { discard; die "prisma db push failed, see /root/kitvoy-dbpush.$TS.log"; }
  say "schema applied"
fi

# ---- 5. build, away from the live server ----
BUILD_LOG="/root/kitvoy-build.$TS.log"
if ! npx next build >"$BUILD_LOG" 2>&1; then
  tail -n 25 "$BUILD_LOG"
  discard
  die "build failed; the live site was not touched"
fi
say "built ($(du -sh .next | cut -f1))"
# Pages opened before the switch still ask for the previous build's scripts
cp -rn "$CURRENT/.next/static/." "$NEW/.next/static/" 2>/dev/null || true

# ---- 6. switch, reload, check ----
http() { curl -s -o /dev/null -m 20 -w '%{http_code}' "$@" 2>/dev/null || echo 000; }

activate() {
  ln -sfn "$1" "$APP.switch"
  mv -T "$APP.switch" "$APP"
  pm2 reload "$PM2_NAME" >/dev/null
  for _ in $(seq 1 40); do
    [ "$(http "$ORIGIN/")" = "200" ] && return 0
    sleep 1
  done
  return 1
}

FAILED=0
check() { # check <name> <ok: 0|1> <detail>
  if [ "$2" -eq 1 ]; then say "  ok    $1 $3"; else say "  FAIL  $1 $3"; FAILED=1; fi
}

smoke() {
  FAILED=0
  local html code chunk train
  html="$(curl -s -m 20 "$ORIGIN/checkout" || true)"
  code="$(http "$ORIGIN/")"; check "origin  GET /" "$([ "$code" = 200 ] && echo 1 || echo 0)" "($code)"
  check "origin  GET / names the store" "$(curl -s -m 20 "$ORIGIN/" | grep -q 'Kitvoy' && echo 1 || echo 0)" ""
  code="$(http "$ORIGIN/checkout")"; check "origin  GET /checkout" "$([ "$code" = 200 ] && echo 1 || echo 0)" "($code)"
  check "origin  /checkout renders the checkout outline" "$(printf '%s' "$html" | grep -q 'Loading checkout' && echo 1 || echo 0)" ""
  chunk="$(printf '%s' "$html" | grep -oE '/_next/static/chunks/[A-Za-z0-9._-]+\.js' | head -n 1)"
  code="$(http "$ORIGIN$chunk")"; check "origin  GET a script of this build" "$([ -n "$chunk" ] && [ "$code" = 200 ] && echo 1 || echo 0)" "($code)"
  code="$(http "$ORIGIN/api/cart/quote?ids=smoke-test")"; check "origin  GET /api/cart/quote" "$([ "$code" = 200 ] && echo 1 || echo 0)" "($code)"
  code="$(http "$PUBLIC/")"; check "public  GET /" "$([ "$code" = 200 ] && echo 1 || echo 0)" "($code)"
  code="$(http "$PUBLIC/checkout")"; check "public  GET /checkout" "$([ "$code" = 200 ] && echo 1 || echo 0)" "($code)"
  code="$(http "$PUBLIC$chunk")"; check "public  GET a script of this build" "$([ -n "$chunk" ] && [ "$code" = 200 ] && echo 1 || echo 0)" "($code)"
  check "public  /checkout has no policy blocking Stripe" "$(curl -s -m 20 -D - -o /dev/null "$PUBLIC/checkout" | grep -i '^content-security-policy' | grep -qv 'js.stripe.com' && echo 0 || echo 1)" ""
  train="$(grep -ohE "RELEASE_TRAIN = '[a-z0-9]+'" "$NEW/node_modules/@stripe/stripe-js/dist/index.js" 2>/dev/null | head -n 1 | cut -d"'" -f2)"
  code="$(http "https://js.stripe.com/${train:-v3}/stripe.js")"; check "Stripe.js reachable (${train:-v3})" "$([ "$code" = 200 ] && echo 1 || echo 0)" "($code)"
  return "$FAILED"
}

say "switching to $SHA and reloading $PM2_NAME"
if ! activate "$NEW"; then
  say "the new release did not come up; switching back"
  activate "$CURRENT" || die "ROLLBACK FAILED: $PM2_NAME is not answering. Check pm2 logs."
  die "rolled back to $(basename "$CURRENT")"
fi

say "smoke tests (GET only)"
if ! smoke; then
  say "a check failed; switching back to $(basename "$CURRENT")"
  activate "$CURRENT" || die "ROLLBACK FAILED: $PM2_NAME is not answering. Check pm2 logs."
  say "rolled back; the failed release is kept at $NEW for inspection"
  exit 1
fi

pm2 save >/dev/null
# Keep the newest releases (always the live one and the one before it)
ls -1dt "$RELEASES"/*/ | tail -n +$((KEEP + 1)) | while read -r old; do
  old="${old%/}"
  [ "$old" = "$NEW" ] || [ "$old" = "$CURRENT" ] || rm -rf "$old"
done
say "LIVE: $SHA ($(basename "$NEW")). Previous release kept at $CURRENT for rollback."
