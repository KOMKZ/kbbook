import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const KEY = 'lz-scroll-pos'

interface Store {
  [pathname: string]: number
}

function loadStore(): Store {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveStore(store: Store) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

/**
 * 通用滚动位置记忆 —— 不区分页面类型。
 * 离开页面时记住 scrollY，回到该页面时恢复。
 * 使用 sessionStorage（关闭标签页即清除）。
 */
export function useScrollMemory() {
  const { pathname } = useLocation()
  const restoredRef = useRef(false)

  // 进入页面：恢复上次滚动位置
  useEffect(() => {
    restoredRef.current = false
    const store = loadStore()
    const saved = store[pathname]
    if (saved !== undefined && saved > 0) {
      // 等待 DOM 渲染完成后再恢复
      let attempts = 0
      const tryRestore = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const target = Math.min(saved, Math.max(0, max))
        if (max > 0 || attempts > 10) {
          window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior })
          restoredRef.current = true
        } else {
          attempts++
          requestAnimationFrame(tryRestore)
        }
      }
      requestAnimationFrame(tryRestore)
    }
  }, [pathname])

  // 离开前保存 — debounced + idle-priority to avoid scroll jank
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const save = () => {
      const store = loadStore()
      store[pathname] = window.scrollY
      // Use requestIdleCallback to avoid blocking the main thread with synchronous sessionStorage write
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => saveStore(store), { timeout: 1000 })
      } else {
        saveStore(store)
      }
    }

    // 滚动时防抖保存 — 500ms debounce (was 200ms)
    const onScroll = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(save, 500)
    }

    // 页面卸载时立即保存
    const onBeforeUnload = () => {
      const store = loadStore()
      store[pathname] = window.scrollY
      // Synchronous on unload — must complete before page closes
      saveStore(store)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      if (timer) clearTimeout(timer)
      // Save on unmount with idle priority
      save()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [pathname])
}
