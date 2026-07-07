#!/usr/bin/env bash
# KBBook Health Check — one command to verify everything
#
# Usage:
#   bash scripts/check.sh           # Web dev check (Node, pnpm, build, content)
#   bash scripts/check.sh --apk     # Full check including APK build deps (Java, Gradle, adb)
set -euo pipefail

CHECK_APK=false
while [[ $# -gt 0 ]]; do case "$1" in --apk) CHECK_APK=true; shift ;; *) shift ;; esac; done

PASS=0; FAIL=0
check() {
  local label="$1"; shift
  printf "  %-45s " "$label"
  if "$@" >/dev/null 2>&1; then echo "✅"; ((PASS++)) || true
  else echo "❌"; ((FAIL++)) || true; fi
}
info() { echo "  $1"; ((PASS++)) || true; }

echo "═══════════════════════════════════════"
echo "  KBBook Health Check"
[ "$CHECK_APK" = true ] && echo "  Mode: Web + APK Build" || echo "  Mode: Web Dev"
echo "═══════════════════════════════════════"
echo ""

# ── Environment ──
echo "━━━ 1. Environment ━━━"
check "Node.js (>=18)"              node -e "process.exit(0)"
check "pnpm"                        pnpm --version
check "git"                         git --version
echo ""

# ── Dependencies ──
echo "━━━ 2. Dependencies ━━━"
if [ -d node_modules ]; then info "node_modules/ found (pnpm install done)"
else echo "  node_modules/ missing ❌ — run: pnpm install"; ((FAIL++)) || true; fi
echo ""

# ── Content ──
echo "━━━ 3. Content ━━━"
[ -f public/docs/series.json ] && info "series.json found" || { echo "  series.json missing ❌"; ((FAIL++)) || true; }
[ -f public/docs/versions.json ] && info "versions.json found" || { echo "  versions.json missing ❌"; ((FAIL++)) || true; }
CONTENT_DIRS=$(ls public/docs/zh-CN/ 2>/dev/null | wc -l || echo 0)
if [ "$CONTENT_DIRS" -gt 0 ]; then info "Content dirs: $CONTENT_DIRS"
else info "Content dirs: 0 (OK for fresh install)"; fi
echo ""

# ── Web Build ──
echo "━━━ 4. Web Build ━━━"
check "TypeScript + Vite production build"  pnpm build
echo ""

# ── Security ──
echo "━━━ 5. Security Scan ━━━"
SENSITIVE=$(grep -rn 'LTAI[0-9A-Za-z]\{12,\}\|FA46Zk\|password\s*[:=]\s*"[^"]\{4,\}"' src/ scripts/ --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.py' 2>/dev/null | grep -v node_modules | wc -l | xargs || echo 0)
if [ "$SENSITIVE" -eq 0 ]; then info "No credential patterns found in source"
else echo "  ⚠️  $SENSITIVE match(es) — review before pushing"; fi
echo ""

# ── Dev Server ──
echo "━━━ 6. Dev Server ━━━"
if lsof -i :3004 2>/dev/null | grep -q LISTEN; then info "Port 3004 listening (dev server running)"
else info "Port 3004 free — run: make dev"; fi
echo ""

# ── APK Build (optional) ──
if [ "$CHECK_APK" = true ]; then
  echo "━━━ 7. APK Build Dependencies ━━━"
  check "Java JDK (javac)"            javac -version
  check "Gradle (gradlew)"            [ -f android/gradlew ]
  check "Android SDK (ANDROID_HOME)"  [ -n "${ANDROID_HOME:-}" ] || [ -d "$HOME/Android/Sdk" ]
  check "adb (Android Debug Bridge)"  adb version
  check "npx cap (Capacitor CLI)"     npx cap --version
  echo ""

  echo "━━━ 8. APK: Android Config ━━━"
  [ -f android/app/build.gradle ] && info "android/app/build.gradle found" || { echo "  android/app/build.gradle missing ❌"; ((FAIL++)) || true; }
  [ -f capacitor.config.ts ] && info "capacitor.config.ts found" || { echo "  capacitor.config.ts missing ❌"; ((FAIL++)) || true; }
  NAMESPACE=$(grep 'namespace\s*=' android/app/build.gradle 2>/dev/null | grep -o '"[^"]*"' | tr -d '"' || echo "?")
  info "Android namespace: $NAMESPACE"
  echo ""

  echo "━━━ 9. APK: Connected Devices ━━━"
  DEVICES=$(adb devices 2>/dev/null | grep -v "List\|^$" | wc -l || echo 0)
  if [ "$DEVICES" -gt 0 ]; then
    info "$DEVICES device(s) connected"
    adb devices 2>/dev/null | grep -v "List\|^$" | while read dev rest; do echo "       $dev"; done
  else
    echo "  0 devices connected ⚠️  (connect tablet via USB for install)"
  fi
  echo ""

  echo "━━━ 10. APK: Quick Build Test ━━━"
  echo "  (skipping full gradle build — run 'make verify-app' to build APK)"
fi

# ── Results ──
echo ""
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed"
if [ "$FAIL" -gt 0 ]; then
  echo "           $FAIL issue(s) to fix"
  echo "═══════════════════════════════════════"
  exit 1
fi
echo "═══════════════════════════════════════"

if [ "$CHECK_APK" = true ]; then
  echo ""
  echo "  ✨ Ready for APK build! Run: make verify-app"
else
  echo ""
  echo "  ✨ Ready for web dev! Run: make dev   (http://localhost:3004)"
  echo "  💡 Check APK build deps: bash scripts/check.sh --apk"
fi
