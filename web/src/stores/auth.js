import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import api from '../services/api'
import { useCurrencyStore } from './currency'
import { useNotificationsStore } from './notifications'

function normalizeUser(rawUser) {
  if (!rawUser) {
    return null
  }

  return {
    ...rawUser,
    full_name: rawUser.full_name || rawUser.fullName,
    fullName: rawUser.fullName || rawUser.full_name,
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('inventory_token') || '')
  const user = ref(normalizeUser(JSON.parse(localStorage.getItem('inventory_user') || 'null')))
  const loading = ref(false)
  const currencyStore = useCurrencyStore()
  const notificationsStore = useNotificationsStore()

  const isAuthenticated = computed(() => Boolean(token.value))

  function persistAuth(nextToken, nextUser) {
    token.value = nextToken
    user.value = normalizeUser(nextUser)
    localStorage.setItem('inventory_token', nextToken)
    localStorage.setItem('inventory_user', JSON.stringify(user.value))
  }

  function clearAuth() {
    token.value = ''
    user.value = null
    localStorage.removeItem('inventory_token')
    localStorage.removeItem('inventory_user')
    notificationsStore.reset()
  }

  // 登录成功后统一保存用户状态，页面刷新也能恢复
  async function login(payload) {
    loading.value = true

    try {
      const { data } = await api.post('/auth/login', payload)
      persistAuth(data.token, data.user)
      if (data.user?.preferred_currency) {
        currencyStore.setCurrency(data.user.preferred_currency)
      }
      await notificationsStore.refresh().catch(() => {})
      return data.user
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    if (!token.value) {
      return null
    }

    try {
      const { data } = await api.get('/auth/me')
      user.value = normalizeUser(data.user)
      localStorage.setItem('inventory_user', JSON.stringify(user.value))
      if (data.user?.preferred_currency) {
        currencyStore.setCurrency(data.user.preferred_currency)
      }
      await notificationsStore.refresh().catch(() => {})
      return user.value
    } catch (error) {
      clearAuth()
      throw error
    }
  }

  return {
    token,
    user,
    loading,
    isAuthenticated,
    login,
    fetchMe,
    clearAuth,
  }
})
