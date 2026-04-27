import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// 每次请求自动带上 token，避免每个页面手动拼接请求头
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('inventory_token')
  const costAccessToken = sessionStorage.getItem('inventory_cost_access_token')
  const locale = localStorage.getItem('inventory_locale') || 'en'

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (costAccessToken) {
    config.headers['x-cost-access-token'] = costAccessToken
  }

  config.headers['x-ui-locale'] = locale

  return config
})

api.interceptors.response.use(
  (response) => {
    const payload = response.data
    if (payload && typeof payload === 'object' && typeof payload.success === 'boolean') {
      if (payload.success) {
        response.data = payload.data
      }
    }
    return response
  },
  (error) => {
    if (error.response?.data?.success === false && error.response.data.message) {
      error.message = error.response.data.message
    }
    return Promise.reject(error)
  },
)

export default api
