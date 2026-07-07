SHELL := /bin/bash

PORT ?= 3004
HOST ?= 0.0.0.0
BASE_URL := http://$(HOST):$(PORT)
PID_FILE := .vite.pid
LOG_FILE := .vite.log
LAUNCH_LABEL := com.kbbook.portal
LAUNCH_DOMAIN := gui/$(shell id -u)
PLIST_FILE := $(HOME)/Library/LaunchAgents/$(LAUNCH_LABEL).plist
LAUNCH_PATH := /opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$(shell which node | xargs dirname)

.PHONY: help install dev dev-bg stop restart clean-vite build lint search verify-md status \
        release build-apk build-portal-cap install-app upload-to-oss upload-webapp app-status app-log clean-app oss-version help-app

# ---- App builds (Android APK) ----

APK_OUT ?= $(shell pwd)/release/kbbook.apk
APK_SRC := android/app/build/outputs/apk/debug/app-debug.apk
PACKAGE_NAME := com.kbbook.app
CAPACITOR := npx cap
OSS_BUCKET ?=
OSS_PATH ?= kbbook-data

# 全流程: build → APK → install 到平板
install:
	pnpm install

dev:
	./node_modules/.bin/vite --host $(HOST) --port $(PORT) --strictPort

# ---- Demo / Getting Started series ----

# Initialize or reset the demo series (first series: learn about KBBook)
init-demo:
	@echo "📖 Initializing demo series..."
	@mkdir -p public/docs/zh-CN/demo-v0.1.0
	@echo "✅ Demo series directory ready"
	@echo "📋 Regenerating search index..."
	pnpm search:build
	@echo "✅ Done. Run 'make dev' and open http://localhost:3004/docs/demo"

search:
	pnpm search:build

build:
	VITE_VERSION_CODE=$$(date +%s) pnpm build

lint:
	pnpm lint

verify-md:
	@curl -sI "$(BASE_URL)$(DOC)" 2>/dev/null | head -1 || echo "Make sure 'make dev' is running"
	@curl -s "$(BASE_URL)$(DOC)" 2>/dev/null | head -c 200

status:
	@lsof -i :3004 -i :3005 2>/dev/null || echo "No listeners on 3004/3005"

clean-vite:
	rm -rf node_modules/.vite

stop:
	@kill $$(lsof -ti :3004) 2>/dev/null || true
	@kill $$(lsof -ti :3005) 2>/dev/null || true
	@echo "✅ Stopped (if running)"

# ---- Quality Gates ----

# Scan for sensitive data before pushing to public repo
check-sensitive:
	@echo "🔍 Scanning for sensitive information..."
	@errors=0; \
	for pattern in 'LTAI[0-9A-Za-z]\{12,\}' 'password\s*[:=]\s*"[^"]\{4,\}"' '192\.168\.\d{1,3}\.\d{1,3}'; do \
	  if grep -rn "$$pattern" src/ scripts/ --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.py' 2>/dev/null | grep -v node_modules | grep -v '.git/'; then \
	    echo "  ❌ Found: $$pattern"; errors=$$((errors+1)); \
	  fi; \
	done; \
	if grep -rn 'LZ Lab\|lzlab\|LLM LZ' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'site\.ts' | grep -v node_modules; then \
	  echo "  ❌ Brand in source (not site.ts)"; errors=$$((errors+1)); \
	fi; \
	if [ $$errors -eq 0 ]; then echo "✅ Clean — safe to push"; else echo "❌ $$errors issue(s) found — fix before push"; exit 1; fi

push:
ifndef MSG
	$(error Usage: make push MSG='commit message')
endif
	git add -A
	git commit -m "$(MSG)"
	git push origin main

# ---- Data CLI (SQLite) ----
data-init:
	node scripts/kbdata-cli.mjs init

data-scan:
	node scripts/kbdata-cli.mjs scan public/docs

data-export:
	node scripts/kbdata-cli.mjs export dump.json

data-upload-oss:
	node scripts/kbdata-cli.mjs upload-oss

data-query:
	node scripts/kbdata-cli.mjs query "$(SQL)"

data-exec:
	node scripts/kbdata-cli.mjs exec "$(SQL)"

help:
	@echo "KBBook commands"
	@echo "  make build            TypeScript + Vite build"
	@echo "  make dev              Start Vite on :3004"
	@echo "  make check-sensitive  Scan credentials before push"
	@echo "  make push MSG='...'   git add/commit/push"
	@echo "  make lint             Run ESLint"
	@echo ""
	@echo "Data CLI:"
	@echo "  make data-init             Create new kbbsqllite.kbdata"
	@echo "  make data-scan             Scan public/docs/*.md → SQLite"
	@echo "  make data-export           Export SQLite → dump.json"
	@echo "  make data-upload-oss       Upload SQLite to OSS"
	@echo "  make data-query SQL='...'  Run SELECT query"
	@echo "  make data-exec SQL='...'   Run INSERT/UPDATE/DELETE"
