<script setup>
import { onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const localeStore = useLocaleStore()
const channels = ['shopee', 'lazada', 'tiktok']
const activeChannel = ref('shopee')
const loading = ref(false)
const savingChannel = ref('')
const testingChannel = ref('')
const syncingChannel = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const errorsLoading = ref(false)
const errorsPagination = ref({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
})
const errorFilterChannel = ref('')
const overviewItems = ref([])
const errors = ref([])
const selectedError = ref(null)
const forms = reactive({
  shopee: {
    shopName: '',
    apiBaseUrl: '',
    accessToken: '',
    refreshToken: '',
    isActive: true,
    redirectUri: '',
    callbackState: '',
    callbackCode: '',
    callbackError: '',
  },
  lazada: {
    shopName: '',
    apiBaseUrl: '',
    accessToken: '',
    refreshToken: '',
    isActive: true,
    redirectUri: '',
    callbackState: '',
    callbackCode: '',
    callbackError: '',
  },
  tiktok: {
    shopName: '',
    apiBaseUrl: '',
    accessToken: '',
    refreshToken: '',
    isActive: true,
    redirectUri: '',
    callbackState: '',
    callbackCode: '',
    callbackError: '',
  },
})

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

function unwrapResponse(response) {
  if (response?.data?.success === true) {
    return response.data.data
  }
  return response?.data
}

function resetNotice() {
  errorMessage.value = ''
  successMessage.value = ''
}

async function loadConnections() {
  const response = await api.get('/marketplace/connections')
  const payload = unwrapResponse(response)
  const items = payload?.items || []

  items.forEach((item) => {
    if (!forms[item.channel]) {
      return
    }
    forms[item.channel].shopName = item.shop_name || ''
    forms[item.channel].apiBaseUrl = item.api_base_url || ''
    forms[item.channel].isActive = Boolean(item.is_active)
  })
}

async function loadOverview() {
  const response = await api.get('/marketplace/status/overview')
  const payload = unwrapResponse(response)
  overviewItems.value = payload?.items || []
}

async function loadErrors(page = errorsPagination.value.page) {
  errorsLoading.value = true
  try {
    const response = await api.get('/marketplace/errors', {
      params: {
        channel: errorFilterChannel.value,
        page,
        pageSize: errorsPagination.value.pageSize,
      },
    })
    const payload = unwrapResponse(response)
    errors.value = payload?.items || []
    errorsPagination.value = payload?.pagination || {
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }
  } finally {
    errorsLoading.value = false
  }
}

async function loadPageData() {
  loading.value = true
  resetNotice()
  try {
    await Promise.all([loadConnections(), loadOverview(), loadErrors(1)])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load marketplace center.', '加载电商连接中心失败。')
  } finally {
    loading.value = false
  }
}

async function saveConnection(channel) {
  resetNotice()
  savingChannel.value = channel
  const form = forms[channel]
  try {
    const response = await api.put(`/marketplace/connections/${channel}`, {
      shopName: form.shopName,
      apiBaseUrl: form.apiBaseUrl,
      accessToken: form.accessToken,
      refreshToken: form.refreshToken,
      metadata: {
        source: 'marketplace-center-page',
      },
      isActive: form.isActive,
    })
    unwrapResponse(response)
    successMessage.value = tr('Connection saved successfully.', '连接配置保存成功。')
    await Promise.all([loadConnections(), loadOverview()])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to save connection.', '保存连接失败。')
  } finally {
    savingChannel.value = ''
  }
}

async function testConnection(channel) {
  resetNotice()
  testingChannel.value = channel
  try {
    await api.post(`/marketplace/connections/${channel}/test`)
    successMessage.value = tr('Connection test passed.', '连接测试通过。')
    await Promise.all([loadOverview(), loadErrors(1)])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Connection test failed.', '连接测试失败。')
    await loadErrors(1)
  } finally {
    testingChannel.value = ''
  }
}

async function startOAuth(channel) {
  resetNotice()
  const form = forms[channel]
  const defaultRedirect = `${window.location.origin}/marketplace/oauth/callback/${channel}`
  const redirectUri = form.redirectUri || defaultRedirect
  try {
    const response = await api.post(`/marketplace/oauth/${channel}/start`, {
      redirectUri,
    })
    const payload = unwrapResponse(response)
    form.callbackState = payload?.state || ''
    form.redirectUri = redirectUri
    if (payload?.authorizeUrl) {
      window.open(payload.authorizeUrl, '_blank', 'noopener,noreferrer')
      successMessage.value = tr('OAuth URL opened in a new tab.', '已在新标签页打开授权链接。')
    } else {
      successMessage.value = tr('OAuth state created. Continue with callback step.', '已创建 OAuth 状态，请继续执行回调步骤。')
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to start OAuth flow.', '启动 OAuth 流程失败。')
  }
}

async function submitOAuthCallback(channel) {
  resetNotice()
  const form = forms[channel]
  try {
    await api.get(`/marketplace/oauth/${channel}/callback`, {
      params: {
        state: form.callbackState,
        code: form.callbackCode,
        error: form.callbackError,
      },
    })
    successMessage.value = tr('OAuth callback processed successfully.', 'OAuth 回调处理成功。')
    await Promise.all([loadConnections(), loadOverview(), loadErrors(1)])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('OAuth callback failed.', 'OAuth 回调失败。')
    await loadErrors(1)
  }
}

async function syncInventory(channel) {
  resetNotice()
  syncingChannel.value = `${channel}-inventory`
  try {
    await api.post(`/marketplace/sync/${channel}`)
    successMessage.value = tr('Inventory sync completed.', '库存同步完成。')
    await Promise.all([loadOverview(), loadErrors(1)])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Inventory sync failed.', '库存同步失败。')
    await loadErrors(1)
  } finally {
    syncingChannel.value = ''
  }
}

async function syncOrders(channel) {
  resetNotice()
  syncingChannel.value = `${channel}-orders`
  try {
    await api.post(`/marketplace/orders/sync/${channel}`)
    successMessage.value = tr('Order sync completed.', '订单同步完成。')
    await Promise.all([loadOverview(), loadErrors(1)])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Order sync failed.', '订单同步失败。')
    await loadErrors(1)
  } finally {
    syncingChannel.value = ''
  }
}

onMounted(loadPageData)

function openErrorDetails(item) {
  selectedError.value = item
}

function closeErrorDetails() {
  selectedError.value = null
}
</script>

<template>
  <AppLayout>
    <template #sidebar>
      <div>
        <h3 class="text-base font-semibold text-slate-900">{{ tr('Platform Tools', '平台工具') }}</h3>
        <p class="mt-1 text-xs text-slate-500">
          {{ tr('Configure connection and run sync tasks.', '配置连接并执行同步任务。') }}
        </p>
      </div>

      <div class="mt-4">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{{ tr('Channel', '渠道') }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="channel in channels"
            :key="`sidebar-${channel}`"
            class="rounded-xl px-3 py-2 text-xs font-semibold uppercase"
            :class="activeChannel === channel ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'"
            @click="activeChannel = channel"
          >
            {{ channel }}
          </button>
        </div>
      </div>

      <div v-for="channel in channels" v-show="activeChannel === channel" :key="`${channel}-sidebar-panel`" class="mt-4 space-y-3">
        <input
          v-model="forms[channel].shopName"
          type="text"
          :placeholder="tr('Shop Name', '店铺名称')"
          class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
        />
        <input
          v-model="forms[channel].apiBaseUrl"
          type="text"
          :placeholder="tr('API Base URL', 'API Base URL')"
          class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
        />
        <input
          v-model="forms[channel].accessToken"
          type="password"
          :placeholder="tr('Access Token', 'Access Token')"
          class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
        />
        <input
          v-model="forms[channel].refreshToken"
          type="password"
          :placeholder="tr('Refresh Token', 'Refresh Token')"
          class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
        />
        <label class="inline-flex items-center gap-2 text-sm text-slate-700">
          <input v-model="forms[channel].isActive" type="checkbox" class="rounded border-slate-300" />
          {{ tr('Active Connection', '启用连接') }}
        </label>

        <div class="grid gap-2">
          <button
            class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            :disabled="savingChannel === channel"
            @click="saveConnection(channel)"
          >
            {{ savingChannel === channel ? tr('Saving...', '保存中...') : tr('Save Config', '保存配置') }}
          </button>
          <button
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="testingChannel === channel"
            @click="testConnection(channel)"
          >
            {{ testingChannel === channel ? tr('Testing...', '测试中...') : tr('Test Connection', '测试连接') }}
          </button>
          <button
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="syncingChannel === `${channel}-inventory`"
            @click="syncInventory(channel)"
          >
            {{ syncingChannel === `${channel}-inventory` ? tr('Syncing...', '同步中...') : tr('Sync Inventory', '同步库存') }}
          </button>
          <button
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="syncingChannel === `${channel}-orders`"
            @click="syncOrders(channel)"
          >
            {{ syncingChannel === `${channel}-orders` ? tr('Syncing...', '同步中...') : tr('Sync Orders', '同步订单') }}
          </button>
        </div>
      </div>

      <div class="mt-6 border-t border-slate-200 pt-4">
        <h3 class="text-base font-semibold text-slate-900">{{ tr('OAuth Guide', '授权向导') }}</h3>
        <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>{{ tr('Save channel config first.', '先保存渠道配置。') }}</li>
          <li>{{ tr('Click Start OAuth and finish authorization on platform.', '点击启动 OAuth，并在平台完成授权。') }}</li>
          <li>{{ tr('Platform redirects back and completes automatically.', '平台会自动跳回并自动处理回调。') }}</li>
        </ol>
        <div class="mt-3 grid gap-2">
          <button
            v-for="channel in channels"
            :key="`${channel}-oauth-sidebar`"
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            @click="startOAuth(channel)"
          >
            {{ tr('Start OAuth', '启动 OAuth') }} {{ channel }}
          </button>
        </div>
        <input
          v-model="forms[activeChannel].redirectUri"
          type="text"
          :placeholder="tr('Redirect URI (optional)', '回调地址（可选）')"
          class="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
        />
      </div>
    </template>

    <section>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">{{ tr('Integrations', '平台集成') }}</p>
      <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Marketplace Center', '电商连接中心') }}</h2>
      <p class="mt-2 text-sm text-slate-500">
        {{ tr('Configure Shopee / Lazada / TikTok, run sync tasks, and monitor errors in one place.', '在一个页面完成 Shopee / Lazada / TikTok 连接配置、同步与错误监控。') }}
      </p>

      <p v-if="errorMessage" class="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        {{ successMessage }}
      </p>

      <div class="mt-6 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-slate-900">{{ tr('Connection Overview', '连接状态总览') }}</h3>
        <div class="mt-4 grid gap-3 md:grid-cols-3">
          <article v-for="item in overviewItems" :key="item.channel" class="rounded-2xl border border-slate-200 p-4">
            <div class="flex items-center justify-between">
              <h4 class="text-base font-semibold text-slate-900 uppercase">{{ item.channel }}</h4>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="item.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'"
              >
                {{ item.connected ? tr('Connected', '已连接') : tr('Not Connected', '未连接') }}
              </span>
            </div>
            <p class="mt-2 text-xs text-slate-500">{{ tr('Shop', '店铺') }}: {{ item.shopName || '-' }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ tr('Last Sync', '最后同步') }}: {{ item.lastSyncAt || '-' }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ tr('Errors in 7 days', '7天错误') }}: {{ item.errorsIn7Days }}</p>
          </article>
        </div>
      </div>

      <div class="mt-6 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-slate-900">{{ tr('Error Logs', '错误日志') }}</h3>
          <div class="flex gap-2">
            <select
              v-model="errorFilterChannel"
              class="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              @change="loadErrors(1)"
            >
              <option value="">{{ tr('All channels', '全部渠道') }}</option>
              <option value="shopee">Shopee</option>
              <option value="lazada">Lazada</option>
              <option value="tiktok">TikTok</option>
            </select>
            <button class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" @click="loadErrors(1)">
              {{ tr('Refresh', '刷新') }}
            </button>
          </div>
        </div>

        <div v-if="errorsLoading" class="mt-4 text-sm text-slate-500">{{ tr('Loading errors...', '正在加载错误日志...') }}</div>
        <div v-else class="mt-4 space-y-3">
          <article v-for="item in errors" :key="item.id" class="rounded-2xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm font-semibold uppercase text-slate-900">{{ item.channel }} · {{ item.operation }}</p>
              <span class="text-xs text-slate-500">{{ item.created_at }}</span>
            </div>
            <p class="mt-1 text-sm text-rose-700">{{ item.error_code }} - {{ item.message }}</p>
            <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs text-slate-500">requestId: {{ item.request_id || '-' }}</p>
              <button
                class="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                @click="openErrorDetails(item)"
              >
                {{ tr('View Details', '查看详情') }}
              </button>
            </div>
          </article>
          <p v-if="errors.length === 0" class="text-sm text-slate-500">{{ tr('No errors found.', '暂无错误日志。') }}</p>
        </div>
        <PaginationBar class="mt-4" :pagination="errorsPagination" @change="loadErrors" />
      </div>
    </section>

    <div v-if="loading" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/35">
      <div class="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-700">
        {{ tr('Loading...', '加载中...') }}
      </div>
    </div>

    <div
      v-if="selectedError"
      class="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 px-4"
      @click.self="closeErrorDetails"
    >
      <section class="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5">
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-lg font-semibold text-slate-900">
            {{ tr('Error Details', '错误详情') }} · {{ selectedError.channel }} / {{ selectedError.operation }}
          </h4>
          <button class="rounded-xl border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700" @click="closeErrorDetails">
            {{ tr('Close', '关闭') }}
          </button>
        </div>
        <p class="mt-3 text-sm text-rose-700">{{ selectedError.error_code }} - {{ selectedError.message }}</p>
        <p class="mt-1 text-xs text-slate-500">requestId: {{ selectedError.request_id || '-' }}</p>
        <pre class="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{{ JSON.stringify(selectedError.details || {}, null, 2) }}</pre>
      </section>
    </div>
  </AppLayout>
</template>
