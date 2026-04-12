import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

// 统一挂载状态管理和路由，方便后续页面共享数据
app.use(createPinia())
app.use(router)

app.mount('#app')
