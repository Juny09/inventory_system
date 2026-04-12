import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useToastStore = defineStore('toast', () => {
  const items = ref([])

  function removeToast(id) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function pushToast(payload) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const duration = payload.duration ?? 5000
    const item = {
      id,
      tone: payload.tone || 'info',
      message: payload.message || '',
      actionLabel: payload.actionLabel || '',
      onAction: payload.onAction || null,
    }

    items.value = [...items.value, item]

    if (duration > 0) {
      window.setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  async function triggerAction(id) {
    const toast = items.value.find((item) => item.id === id)

    if (!toast?.onAction) {
      return
    }

    await toast.onAction()
    removeToast(id)
  }

  return {
    items,
    pushToast,
    removeToast,
    triggerAction,
  }
})
