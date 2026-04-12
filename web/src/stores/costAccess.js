import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import api from '../services/api'

export const useCostAccessStore = defineStore('cost-access', () => {
  const unlocked = ref(Boolean(sessionStorage.getItem('inventory_cost_access_token')))
  const loading = ref(false)

  const isUnlocked = computed(() => unlocked.value)

  async function unlock(passcode) {
    loading.value = true

    try {
      const { data } = await api.post('/products/cost-access', { passcode })
      unlocked.value = true
      sessionStorage.setItem('inventory_cost_access_token', data.token)
      return true
    } finally {
      loading.value = false
    }
  }

  function lock() {
    unlocked.value = false
    sessionStorage.removeItem('inventory_cost_access_token')
  }

  return {
    unlocked,
    loading,
    isUnlocked,
    unlock,
    lock,
  }
})
