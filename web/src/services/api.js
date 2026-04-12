import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// 每次请求自动带上 token，避免每个页面手动拼接请求头
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('inventory_token')
  const costAccessToken = sessionStorage.getItem('inventory_cost_access_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (costAccessToken) {
    config.headers['x-cost-access-token'] = costAccessToken
  }

  return config
})

export default api
