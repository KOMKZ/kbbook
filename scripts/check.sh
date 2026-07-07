#!/usr/bin/env bash
# KBBook Health Check — one command to verify everything is working
set -euo pipefail

echo "═══════════════════════════════════════"
echo "  KBBook Health Check"
echo "═══════════════════════════════════════"
echo ""

PASS=0
FAIL=0

check() {
  local label="$1"; shift
  echo -n "  $label ... "
  if "$@" >/dev/null 2>&1; then
    echo "✅"
    ((PASS++)) || true
  else
    echo "❌"
    ((FAIL++)) || true
  fi
}

echo "━━━ Environment ━━━"
check "Node.js"    node -e "process.exit(0)"
check "pnpm"       pnpm --version
check "git"        git --version

echo ""
echo "━━━ Dependencies ━━━"
[ -d node_modules ] && echo "  node_modules exists ✅" || { echo "  node_modules missing ❌ — run: pnpm install"; ((FAIL++)) || true; }
[ -d node_modules ] && ((PASS++)) || true

echo ""
echo "━━━ Content ━━━"
[ -f public/docs/series.json ] && echo "  series.json exists ✅" || { echo "  series.json missing ❌"; ((FAIL++)) || true; }
[ -f public/docs/series.json ] && ((PASS++)) || true
[ -f public/docs/versions.json ] && echo "  versions.json exists ✅" || { echo "  versions.json missing ❌"; ((FAIL++)) || true; }
[ -f public/docs/versions.json ] && ((PASS++)) || true

CONTENT_DIRS=$(ls public/docs/zh-CN/ 2>/dev/null | wc -l || echo 0)
if [ "$CONTENT_DIRS" -gt 0 ]; then
  echo "  Content dirs: $CONTENT_DIRS ✅"
  ((PASS++)) || true
else
  echo "  Content dirs: 0 (no articles yet — that's OK for a fresh install) ⚠️"
fi

echo ""
echo "━━━ Build ━━━"
check "TypeScript + Vite build" pnpm build

echo ""
echo "━━━ Security ━━━"
SENSITIVE=$(grep -rn 'LTAI\|FA46Zk\|password\s*[:=]\s*"[^"]\{4,\}"' src/ scripts/ --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.py' 2>/dev/null | grep -v node_modules | grep -v '.git/' | wc -l || echo 0)
if [ "$SENSITIVE" -eq 0 ]; then
  echo "  No credentials found in source ✅"
  ((PASS++)) || true
else
  echo "  ⚠️  $SENSITIVE potential credential(s) found — review before pushing"
fi

echo ""
echo "━━━ Dev Server ━━━"
if lsof -i :3004 2>/dev/null | grep -q LISTEN; then
  echo "  Port 3004 is listening ✅"
  ((PASS++)) || true
else
  echo "  Port 3004 not in use — run: make dev ⚠️"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "  ✨ All checks passed! Run 'make dev' and open http://localhost:3004"
  exit 0
else
  exit 1
fi
