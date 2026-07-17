import { onBeforeUnmount, unref, watch } from 'vue'

export function useFormDraft(options) {
  const {
    storageKey,
    buildState,
    applyState,
    delay = 200,
  } = options

  let saveTimer = null

  function resolveStorageKey() {
    const value = typeof storageKey === 'function' ? storageKey() : unref(storageKey)
    return value ? String(value) : ''
  }

  function saveDraft() {
    const key = resolveStorageKey()
    if (!key) return

    try {
      const snapshot = buildState()
      localStorage.setItem(key, JSON.stringify(snapshot))
    } catch {
      // ignore storage errors
    }
  }

  function restoreDraft() {
    const key = resolveStorageKey()
    if (!key) return false

    try {
      const raw = localStorage.getItem(key)
      if (!raw) return false
      applyState(JSON.parse(raw))
      return true
    } catch {
      return false
    }
  }

  function clearDraft() {
    const key = resolveStorageKey()
    if (!key) return
    localStorage.removeItem(key)
  }

  watch(
    buildState,
    () => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(saveDraft, delay)
    },
    { deep: true },
  )

  onBeforeUnmount(() => {
    if (saveTimer) clearTimeout(saveTimer)
  })

  return {
    saveDraft,
    restoreDraft,
    clearDraft,
  }
}
