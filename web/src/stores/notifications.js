import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import api from '../services/api'

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const loadedOnce = ref(false)

  const hasUnread = computed(() => unreadCount.value > 0)

  async function refresh() {
    loading.value = true
    try {
      const { data } = await api.get('/notifications', {
        params: { unreadOnly: 'true', page: 1, pageSize: 20 },
      })
      items.value = data.items || []
      unreadCount.value = Array.isArray(data.items) ? data.items.length : 0
      loadedOnce.value = true
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(notificationId) {
    await api.post(`/notifications/${notificationId}/read`)
    items.value = items.value.filter((item) => Number(item.id) !== Number(notificationId))
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }

  function reset() {
    items.value = []
    unreadCount.value = 0
    loading.value = false
    loadedOnce.value = false
  }

  return {
    items,
    unreadCount,
    hasUnread,
    loading,
    loadedOnce,
    refresh,
    markAsRead,
    reset,
  }
})

