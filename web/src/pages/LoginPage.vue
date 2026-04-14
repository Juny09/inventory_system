<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'
import api from '../services/api'

const router = useRouter()
const authStore = useAuthStore()
const localeStore = useLocaleStore()
const form = reactive({
  email: 'admin@inventory.local',
  password: 'Admin@123',
})
const errorMessage = ref('')
const healthMessage = ref('Checking backend health...')
const testingAccounts = [
  { role: 'Admin', email: 'admin@inventory.local', password: 'Admin@123' },
  { role: 'Manager', email: 'manager@inventory.local', password: 'Manager@123' },
  { role: 'Staff', email: 'staff@inventory.local', password: 'Staff@123' },
  { role: 'Testing', email: 'test@inventory.local', password: 'Test@123456' },
]

function fillTestingAccount(account) {
  form.email = account.email
  form.password = account.password
}

async function checkBackendHealth() {
  try {
    await api.get('/health')
    healthMessage.value = localeStore.locale === 'en' ? 'Backend is reachable. You can login now.' : '后端服务正常，可直接登录。'
  } catch (error) {
    healthMessage.value =
      localeStore.locale === 'en'
        ? 'Backend is unreachable. Please start server or check PostgreSQL.'
        : '后端服务未连通，请先启动 server 或检查 PostgreSQL。'
  }
}

async function submitLogin() {
  errorMessage.value = ''

  try {
    await authStore.login(form)
    router.push({ name: 'dashboard' })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to login.'
  }
}

onMounted(checkBackendHealth)
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
    <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">
      <section class="bg-gradient-to-br from-brand-700 via-brand-600 to-slate-900 p-10 text-white">
        <p class="text-sm uppercase tracking-[0.35em] text-brand-100">Inventory OS</p>
        <h1 class="mt-4 text-4xl font-semibold leading-tight">Full stack inventory management system</h1>
        <p class="mt-4 text-base text-slate-200">
          Track stock, manage warehouses, scan barcodes and monitor reports from one dashboard.
        </p>

        <div class="mt-10 grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p class="text-sm text-brand-100">Roles</p>
            <p class="mt-2 text-xl font-semibold">Admin / Manager / Staff</p>
          </div>
          <div class="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p class="text-sm text-brand-100">Built with</p>
            <p class="mt-2 text-xl font-semibold">Vue 3 + Express + PostgreSQL</p>
          </div>
        </div>
      </section>

      <section class="p-10">
        <p class="text-sm uppercase tracking-[0.35em] text-slate-400">Welcome back</p>
        <h2 class="mt-4 text-3xl font-semibold text-slate-900">Login to continue</h2>
        <p class="mt-3 text-sm text-slate-500">Default seeded account is already filled for quick testing.</p>
        <p class="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {{ healthMessage }}
        </p>

        <div class="mt-4 grid gap-3">
          <button
            v-for="account in testingAccounts"
            :key="account.email"
            type="button"
            class="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-500 hover:bg-brand-50"
            @click="fillTestingAccount(account)"
          >
            <span>
              <span class="block text-sm font-semibold text-slate-900">{{ account.role }}</span>
              <span class="block text-xs text-slate-500">{{ account.email }}</span>
            </span>
            <span class="text-xs text-slate-500">{{ account.password }}</span>
          </button>
        </div>

        <form class="mt-8 space-y-5" @submit.prevent="submitLogin">
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-700">Email</span>
            <input
              v-model="form.email"
              type="email"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
            />
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-700">Password</span>
            <input
              v-model="form.password"
              type="password"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
            />
          </label>

          <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {{ errorMessage }}
          </p>

          <button
            type="submit"
            class="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
            :disabled="authStore.loading"
          >
            {{ authStore.loading ? 'Logging in...' : 'Login' }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>
