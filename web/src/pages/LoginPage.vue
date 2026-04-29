<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'
import api from '../services/api'

const router = useRouter()
const authStore = useAuthStore()
const localeStore = useLocaleStore()

// 登录表单：tenantCode 从 localStorage 回填上次使用过的公司代码；
// 邮箱也记住上次登录值，便于多公司切换
const lastTenantCode = localStorage.getItem('inventory_last_tenant_code') || ''
const lastEmail = localStorage.getItem('inventory_last_email') || ''
const form = reactive({
  tenantCode: lastTenantCode,
  email: lastEmail,
  password: '',
})

// 注册公司表单
const registerForm = reactive({
  tenantCode: '',
  tenantName: '',
  adminName: '',
  adminEmail: '',
  password: '',
  contactPhone: '',
})

const mode = ref('login') // 'login' | 'register'
const errorMessage = ref('')
const successMessage = ref('')
const healthMessage = ref('Checking backend health...')

// 测试账号：每条都绑定 tenantCode，点击后同步填入公司代码
const testingAccounts = [
  { tenantCode: 'DEFAULT', role: 'DEFAULT · Admin', email: 'admin@inventory.local', password: 'Admin@123' },
  { tenantCode: 'DEFAULT', role: 'DEFAULT · Manager', email: 'manager@inventory.local', password: 'Manager@123' },
  { tenantCode: 'DEFAULT', role: 'DEFAULT · Staff', email: 'staff@inventory.local', password: 'Staff@123' },
  { tenantCode: 'DEFAULT', role: 'DEFAULT · Testing', email: 'test@inventory.local', password: 'Test@123456' },
  { tenantCode: 'ACME', role: 'ACME · Admin', email: 'alice@acme.com', password: 'Admin@123' },
]

function fillTestingAccount(account) {
  form.email = account.email
  form.password = account.password
  form.tenantCode = account.tenantCode
}

function switchMode(next) {
  mode.value = next
  errorMessage.value = ''
  successMessage.value = ''
}

async function checkBackendHealth() {
  try {
    await api.get('/health')
    healthMessage.value =
      localeStore.locale === 'en'
        ? 'Backend is reachable. You can login now.'
        : '后端服务正常，可直接登录。'
  } catch (error) {
    healthMessage.value =
      localeStore.locale === 'en'
        ? 'Backend is unreachable. Please start server or check PostgreSQL.'
        : '后端服务未连通，请先启动 server 或检查 PostgreSQL。'
  }
}

async function submitLogin() {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const normalized = {
      ...form,
      tenantCode: (form.tenantCode || '').trim().toUpperCase(),
    }
    const loggedInUser = await authStore.login(normalized)
    // 记住公司代码 + 邮箱，下次自动回填（密码不保存）
    localStorage.setItem('inventory_last_tenant_code', normalized.tenantCode)
    localStorage.setItem('inventory_last_email', normalized.email || '')
    // Super Admin 登录后跳到租户审核页
    if (loggedInUser?.role === 'SUPER_ADMIN') {
      router.push({ name: 'admin-tenants' })
    } else {
      router.push({ name: 'dashboard' })
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to login.'
  }
}

async function submitRegister() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!registerForm.tenantCode || !registerForm.tenantName || !registerForm.adminName || !registerForm.adminEmail || !registerForm.password) {
    errorMessage.value = 'Please fill in all required fields.'
    return
  }

  if (registerForm.password.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }

  try {
    const result = await authStore.registerTenant(registerForm)
    if (result?.pending) {
      // 新租户需等 Super Admin 审核，停留在登录页显示提示
      successMessage.value = result.message || 'Registration submitted. Pending Super Admin approval.'
      // 清空注册表单，自动切回登录 tab 便于审核后登录
      Object.keys(registerForm).forEach((k) => (registerForm[k] = ''))
      setTimeout(() => {
        mode.value = 'login'
      }, 2500)
    } else if (result?.token) {
      // 向后兼容：如后端直接签发 token，保留原路径
      successMessage.value = 'Company registered successfully! Redirecting...'
      setTimeout(() => router.push({ name: 'dashboard' }), 800)
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to register.'
  }
}

onMounted(checkBackendHealth)
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
    <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">
      <section class="bg-gradient-to-br from-brand-700 via-brand-600 to-slate-900 p-10 text-white">
        <p class="text-sm uppercase tracking-[0.35em] text-brand-100">Inventory OS</p>
        <h1 class="mt-4 text-4xl font-semibold leading-tight">Multi-tenant inventory management</h1>
        <p class="mt-4 text-base text-slate-200">
          Each company has its own isolated workspace. Login with your company code or sign up as a new company.
        </p>

        <div class="mt-10 grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p class="text-sm text-brand-100">Data isolation</p>
            <p class="mt-2 text-xl font-semibold">Per-tenant isolation</p>
          </div>
          <div class="rounded-2xl bg-white/10 p-4 backdrop-blur">
            <p class="text-sm text-brand-100">Built with</p>
            <p class="mt-2 text-xl font-semibold">Vue 3 + Express + PostgreSQL</p>
          </div>
        </div>
      </section>

      <section class="p-10">
        <!-- Mode tabs -->
        <div class="mb-6 flex gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            class="flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition"
            :class="mode === 'login' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'"
            @click="switchMode('login')"
          >
            Login
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition"
            :class="mode === 'register' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'"
            @click="switchMode('register')"
          >
            Register company
          </button>
        </div>

        <!-- LOGIN -->
        <template v-if="mode === 'login'">
          <h2 class="text-3xl font-semibold text-slate-900">Login to continue</h2>
          <p class="mt-3 text-sm text-slate-500">Enter your company code, email and password.</p>
          <p class="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{{ healthMessage }}</p>

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
              <span class="mb-2 block text-sm font-medium text-slate-700">Company code</span>
              <input
                v-model="form.tenantCode"
                type="text"
                required
                placeholder="Enter your company code"
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 uppercase"
              />
              <span class="mt-1 block text-xs text-slate-400">Provided by your administrator. Used to isolate data per company.</span>
            </label>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Email</span>
              <input
                v-model="form.email"
                type="email"
                required
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              />
            </label>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Password</span>
              <input
                v-model="form.password"
                type="password"
                required
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
        </template>

        <!-- REGISTER -->
        <template v-else>
          <h2 class="text-3xl font-semibold text-slate-900">Create your company</h2>
          <p class="mt-3 text-sm text-slate-500">Register a new company and get your own isolated workspace.</p>

          <form class="mt-6 space-y-4" @submit.prevent="submitRegister">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Company code *</span>
                <input
                  v-model="registerForm.tenantCode"
                  type="text"
                  required
                  placeholder="e.g. ACME"
                  class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 uppercase"
                />
                <span class="mt-1 block text-xs text-slate-400">3-40 chars, A-Z, 0-9, _, -</span>
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-700">Company name *</span>
                <input
                  v-model="registerForm.tenantName"
                  type="text"
                  required
                  placeholder="e.g. ACME Corp"
                  class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
                />
              </label>
            </div>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Your name *</span>
              <input
                v-model="registerForm.adminName"
                type="text"
                required
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              />
            </label>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Admin email *</span>
              <input
                v-model="registerForm.adminEmail"
                type="email"
                required
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              />
            </label>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Password * (min 8 chars)</span>
              <input
                v-model="registerForm.password"
                type="password"
                required
                minlength="8"
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              />
            </label>

            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Contact phone</span>
              <input
                v-model="registerForm.contactPhone"
                type="tel"
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
              />
            </label>

            <p v-if="errorMessage" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {{ errorMessage }}
            </p>
            <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {{ successMessage }}
            </p>

            <button
              type="submit"
              class="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
              :disabled="authStore.loading"
            >
              {{ authStore.loading ? 'Creating...' : 'Create company' }}
            </button>
          </form>
        </template>
      </section>
    </div>
  </div>
</template>
