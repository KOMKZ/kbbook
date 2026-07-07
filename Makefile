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
release: build-apk install-app
	@echo "✅ Release complete: APK built + installed on tablet"

# 构建 portal + APK
build-apk: build-portal-cap
	@echo "🔨 Building Android APK..."
	cd android && ./gradlew assembleDebug
	@mkdir -p $$(dirname $(APK_OUT))
	cp $(APK_SRC) $(APK_OUT)
	@echo "✅ APK saved to $(APK_OUT)"

# Vite build + Capacitor sync
build-portal-cap:
	@echo "📦 Building portal (Vite)..."
	pnpm build
	@echo "🔄 Syncing web assets to Capacitor..."
	$(CAPACITOR) sync

# 安装到平板（默认所有设备）. 手机用 make install-phone
install-app: build-apk
	@echo "📲 Installing to all connected devices..."
	@for dev in $$(adb devices | grep -v "List\|^$$" | awk '{print $$1}'); do \
		echo "  → $$dev"; \
		adb -s $$dev install -r $(APK_OUT); \
	done
	@echo "✅ Installed"

# 上传 dist/docs/ 到阿里云 OSS（MD5 增量：只传变化的文件）
upload-to-oss: build-portal-cap
	@echo "☁️  Computing local MD5s..."
	@cd dist/docs && find . -type f | while read f; do \
		rel=$${f#./}; \
		hash=$$(md5sum "$$f" | cut -d' ' -f1); \
		echo "$$hash $$rel"; \
	done | node -e "\
		const fs=require('fs'),lines=fs.readFileSync('/dev/stdin','utf8').trim().split('\n').filter(Boolean);\
		const local={}; lines.forEach(l=>{const m=l.match(/^(\S+)\s+(.+)/); if(m) local[m[2]]=m[1]});\
		fs.writeFileSync('/tmp/local-manifest.json',JSON.stringify(local));"
	@echo "☁️  Comparing with remote..."
	@ossutil cp oss://$(OSS_BUCKET)/$(OSS_PATH)/manifest.json /tmp/remote-manifest.json -f 2>/dev/null || echo '{}' > /tmp/remote-manifest.json
	@node -e "\
		const fs=require('fs'),cp=require('child_process');\
		const local=JSON.parse(fs.readFileSync('/tmp/local-manifest.json','utf8'));\
		let remote={}; try{remote=JSON.parse(fs.readFileSync('/tmp/remote-manifest.json','utf8')).files||{}}catch(e){}\
		let uploaded=0,skipped=0,deleted=0;\
		for(const[k,h] of Object.entries(local)){\
			if(remote[k]===h){skipped++;continue;}\
			cp.execSync('ossutil cp dist/docs/'+k.replace(/\"/g,'\\\\\"')+' oss://$(OSS_BUCKET)/$(OSS_PATH)/files/docs/'+k+' -f',{stdio:'pipe',cwd:'$(shell pwd)'});\
			uploaded++;\
			console.log('  ↑ '+k);\
		}\
		for(const k of Object.keys(remote)){\
			if(!local[k]){\
				cp.execSync('ossutil rm oss://$(OSS_BUCKET)/$(OSS_PATH)/files/docs/'+k+' -f',{stdio:'pipe'});\
				deleted++;\
				console.log('  ✕ '+k);\
			}\
		}\
		console.log('Uploaded:'+uploaded+' Skipped:'+skipped+' Deleted:'+deleted);"
	@echo "$(OSS_BUCKET)" > /dev/null
	@cd dist/docs && find . -type f | while read f; do \
		rel=$${f#./}; hash=$$(md5sum "$$f" | cut -d' ' -f1); echo "$$hash $$rel"; \
	done | node -e "\
		const fs=require('fs'),lines=fs.readFileSync('/dev/stdin','utf8').trim().split('\n').filter(Boolean);\
		const files={}; lines.forEach(l=>{const m=l.match(/^(\S+)\s+(.+)/); if(m) files[m[2]]=m[1]});\
		const m={version:new Date().toISOString(),fileCount:Object.keys(files).length,files};\
		fs.writeFileSync('/tmp/manifest.json',JSON.stringify(m));"
	@# Compare with remote manifest, skip zip if identical
	@if ossutil stat oss://$(OSS_BUCKET)/$(OSS_PATH)/latest/docs.zip 2>/dev/null | grep -q 'Etag'; then \
		echo "☁️  Updating manifest + zip..."; \
	else \
		echo "☁️  First upload — uploading manifest + zip..."; \
	fi
	ossutil cp /tmp/manifest.json oss://$(OSS_BUCKET)/$(OSS_PATH)/manifest.json -f
	@if [ "$(ZIP)" = "1" ]; then \
		echo "☁️  Building + uploading full zip (ZIP=1)..."; \
		cd dist/docs && zip -qr /tmp/lz-portal-docs.zip . && \
		ossutil cp /tmp/lz-portal-docs.zip oss://$(OSS_BUCKET)/$(OSS_PATH)/latest/docs.zip -f; \
	else \
		echo "☁️  Skipping zip (use ZIP=1 to rebuild full zip)"; \
	fi
	@rm -f /tmp/manifest.json /tmp/local-manifest.json /tmp/remote-manifest.json /tmp/lz-portal-docs.zip
	@echo "✅ OSS sync done"
	@# Also push webapp for OTA
	$(MAKE) upload-webapp

# 上传 webapp.zip 到 OSS（App 热更新用）
upload-webapp: build-portal-cap
	@echo "☁️  Building webapp.zip (dist/ minus docs/)..."
	@cd dist && zip -qr /tmp/lz-webapp.zip . -x "docs/*" 2>/dev/null || cd dist && zip -qr /tmp/lz-webapp.zip .
	@echo "☁️  Uploading webapp..."
	ossutil cp /tmp/lz-webapp.zip oss://$(OSS_BUCKET)/$(OSS_PATH)/latest/webapp.zip -f
	@date -u +%Y%m%d-%H%M%S > /tmp/webapp-version.json
	ossutil cp /tmp/webapp-version.json oss://$(OSS_BUCKET)/$(OSS_PATH)/latest/webapp-version.json -f
	@rm -f /tmp/lz-webapp.zip /tmp/webapp-version.json
	@echo "✅ Webapp uploaded"

# 所有设备状态检查
app-status:
	@echo "📱 Connected devices:"
	@adb devices -l 2>/dev/null || echo "  No devices found"
	@for dev in $$(adb devices | grep -v "List\|^$$" | awk '{print $$1}'); do \
		echo ""; \
		echo "📦 $$dev:"; \
		adb -s $$dev shell dumpsys package $(PACKAGE_NAME) 2>/dev/null | grep -E 'versionName|versionCode|firstInstallTime' || echo "  $(PACKAGE_NAME) not installed"; \
	done

# 日志（默认第一个设备）
app-log:
	adb logcat -s KBBookSync:* AndroidRuntime:* chromium:* -v time

# 清理 Android 构建
clean-app:
	@echo "🧹 Cleaning Android build..."
	cd android && ./gradlew clean
	rm -rf android/app/build android/build android/.gradle
	@echo "✅ Cleaned"

# OSS 版本对比
oss-version:
	@echo "📁 Local dist/docs/:"
	@echo "  size: $$(du -sh dist/docs/ 2>/dev/null | cut -f1)"
	@echo "  files: $$(find dist/docs/ -type f 2>/dev/null | wc -l)"
	@echo ""
	@echo "☁️  Remote OSS version:"
	@ossutil cat oss://$(OSS_BUCKET)/$(OSS_PATH)/latest/version.json 2>/dev/null || echo "  (not available)"

help-app:
	@echo "KBBook — App Commands"
	@echo "========================"
	@echo "  make release          全流程: build → APK → install"
	@echo "  make build-apk        构建 APK (APK_OUT=path)"
	@echo "  make install-app      安装到平板"
	@echo "  make upload-to-oss    推送 dist/docs/ 到 OSS"
	@echo "  make app-status       平板连接状态 + APK 版本"
	@echo "  make app-log          平板 logcat"
	@echo "  make clean-app        清理 Android 构建缓存"
	@echo "  make oss-version      对比本地/OSS 文档版本"

help:
	@echo "KBBook commands"
	@echo ""
	@echo "  make install          Install dependencies"
	@echo "  make dev              Start Vite in foreground on $(BASE_URL)"
	@echo "  make build            TypeScript + Vite production build"
	@echo "  make lint             Run ESLint"
	@echo "  make check-sensitive  Scan for credentials/tokens/passwords before push"
	@echo "  make push MSG='...'   git add -A, commit, push to origin"
	@echo "  make search           Build search index JSON"
	@echo "  make status           Show listeners on 3004/3005"

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
	pnpm build

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
	for pattern in 'LTAI[0-9A-Za-z]{,20}' 'FA46Zk' 'password\s*[:=]\s*"[^"]+"' '192\.168\.\d{1,3}\.\d{1,3}' 'yogan-static'; do \
	  if grep -rn "$$pattern" src/ scripts/ --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.py' 2>/dev/null | grep -v node_modules | grep -v '.git/'; then \
	    echo "  ❌ Found: $$pattern"; errors=$$((errors+1)); \
	  fi; \
	done; \
	if grep -rn 'LZ Lab\|lzlab\|LLM LZ' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'site\.ts' | grep -v node_modules; then \
	  echo "  ❌ Brand in source (not site.ts)"; errors=$$((errors+1)); \
	fi; \
	if [ $$errors -eq 0 ]; then echo "✅ Clean — safe to push"; else echo "❌ $$errors issue(s) found — fix before push"; exit 1; fi

# Git: add, commit, push
push:
ifndef MSG
	$(error Usage: make push MSG='commit message')
endif
	git add -A
	git commit -m "$(MSG)"
	git push origin main

