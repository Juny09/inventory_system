<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const route = useRoute()
const router = useRouter()
const localeStore = useLocaleStore()
const loading = ref(true)
const status = ref('pending')
const message = ref('')

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

async function processCallback() {
  const channel = String(route.params.channel || '').toLowerCase()
  const state = String(route.query.state || '')
  const code = String(route.query.code || '')
  const oauthError = String(route.query.error || '')

  if (!channel || !state) {
    status.value = 'failed'
    message.value = tr('Missing channel or state in callback URL.', '回调地址缺少 channel 或 state 参数。')
    loading.value = false
    return
  }

  try {
    await api.get(`/marketplace/oauth/${channel}/callback`, {
      params: {
        state,
        code,
        error: oauthError,
      },
    })
    status.value = 'success'
    message.value = tr('Marketplace authorization completed successfully.', '电商平台授权回调处理成功。')
  } catch (error) {
    status.value = 'failed'
    message.value = error.response?.data?.message || tr('Authorization callback failed.', '授权回调失败。')
  } finally {
    loading.value = false
  }
}

function goToCenter() {
  router.push({ name: 'marketplace-center' })
}

onMounted(processCallback)
</script>

<template>
  <AppLayout>
    <section class="mx-auto mt-4 max-w-2xl rounded-3xl border border-slate-200 bg-white p-6">
      <p class="text-sm uppercase tracking-[0.25em] text-slate-400">{{ tr('Integrations', '平台集成') }}</p>
      <h2 class="mt-2 text-2xl font-semibold text-slate-900">{{ tr('OAuth Callback', 'OAuth 回调处理') }}</h2>

      <div v-if="loading" class="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
        {{ tr('Processing callback...', '正在处理回调...') }}
      </div>

      <div
        v-else
        class="mt-4 rounded-2xl px-4 py-3 text-sm"
        :class="status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
      >
        {{ message }}
      </div>

      <button class="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" @click="goToCenter">
        {{ tr('Back to Marketplace Center', '返回电商连接中心') }}
      </button>
    </section>
  </AppLayout>
</template>
