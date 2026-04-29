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
  const tenant = ref(JSON.parse(localStorage.getItem('inventory_tenant') || 'null'))
  const loading = ref(false)
  const currencyStore = useCurrencyStore()
  const notificationsStore = useNotificationsStore()

  const isAuthenticated = computed(() => Boolean(token.value))

  function persistAuth(nextToken, nextUser, nextTenant) {
    token.value = nextToken
    user.value = normalizeUser(nextUser)
    tenant.value = nextTenant || null
    localStorage.setItem('inventory_token', nextToken)
    localStorage.setItem('inventory_user', JSON.stringify(user.value))
    if (nextTenant) {
      localStorage.setItem('inventory_tenant', JSON.stringify(nextTenant))
    } else {
      localStorage.removeItem('inventory_tenant')
    }
  }

  function clearAuth() {
    token.value = ''
    user.value = null
    tenant.value = null
    localStorage.removeItem('inventory_token')
    localStorage.removeItem('inventory_user')
    localStorage.removeItem('inventory_tenant')
    notificationsStore.reset()
  }

  // 登录成功后统一保存用户状态，页面刷新也能恢复
  async function login(payload) {
    loading.value = true

    try {
      const { data } = await api.post('/auth/login', payload)
      persistAuth(data.token, data.user, data.tenant)
      if (data.user?.preferred_currency) {
        currencyStore.setCurrency(data.user.preferred_currency)
      }
      await notificationsStore.refresh().catch(() => {})
      return data.user
    } finally {
      loading.value = false
    }
  }

  // 注册新公司（租户）：后端不立即签发 token，需 Super Admin 审核
  async function registerTenant(payload) {
    loading.value = true
    try {
      const { data } = await api.post('/auth/register-tenant', payload)
      // pending=true 时不保存认证信息，由页面展示等待审核提示
      if (data?.token) {
        persistAuth(data.token, data.user, data.tenant)
        if (data.user?.preferred_currency) {
          currencyStore.setCurrency(data.user.preferred_currency)
        }
      }
      return data
    } finally {
      loading.value = false
    }
  }

  const isSuperAdmin = computed(() => user.value?.role === 'SUPER_ADMIN')

  async function fetchMe() {
    if (!token.value) {
      return null
    }

    try {
      const { data } = await api.get('/auth/me')
      user.value = normalizeUser(data.user)
      if (data.tenant) {
        tenant.value = data.tenant
        localStorage.setItem('inventory_tenant', JSON.stringify(data.tenant))
      }
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
    tenant,
    loading,
    isAuthenticated,
    isSuperAdmin,
    login,
    registerTenant,
    fetchMe,
    clearAuth,
  }
})
