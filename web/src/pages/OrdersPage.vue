<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'
import { useToastStore } from '../stores/toast'

const router = useRouter()
const localeStore = useLocaleStore()
const toastStore = useToastStore()
const loading = ref(false)
const syncingChannel = ref('')
const errorMessage = ref('')
const items = ref([])
const filters = reactive({
  channel: '',
  status: 'all',
  search: '',
})
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
})

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

async function loadOrders(page = pagination.value.page) {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get('/orders', {
      params: {
        channel: filters.channel,
        status: filters.status,
        search: filters.search,
        page,
        pageSize: pagination.value.pageSize,
      },
    })
    items.value = data.items
    pagination.value = data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load orders.', '加载订单失败。')
  } finally {
    loading.value = false
  }
}

function handleFilter() {
  loadOrders(1)
}

function openOrder(orderId) {
  router.push({ name: 'order-detail', params: { id: String(orderId) } })
}

async function syncOrders(channel) {
  syncingChannel.value = channel
  errorMessage.value = ''
  try {
    const { data } = await api.post(`/orders/sync/${channel}`)
    toastStore.pushToast({
      tone: 'success',
      message: data.message || tr('Order sync completed.', '订单同步完成。'),
    })
    await loadOrders(1)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to sync orders.', '订单同步失败。')
  } finally {
    syncingChannel.value = ''
  }
}

onMounted(() => loadOrders(1))
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">{{ tr('Operations', '运营') }}</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Order management', '订单管理') }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ tr('Review marketplace orders and sync status.', '查看电商平台订单与同步状态。') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="syncingChannel === 'shopee'"
            @click="syncOrders('shopee')"
          >
            {{ syncingChannel === 'shopee' ? tr('Syncing...', '同步中...') : tr('Sync Shopee', '同步 Shopee') }}
          </button>
          <button
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="syncingChannel === 'lazada'"
            @click="syncOrders('lazada')"
          >
            {{ syncingChannel === 'lazada' ? tr('Syncing...', '同步中...') : tr('Sync Lazada', '同步 Lazada') }}
          </button>
          <button
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="syncingChannel === 'tiktok'"
            @click="syncOrders('tiktok')"
          >
            {{ syncingChannel === 'tiktok' ? tr('Syncing...', '同步中...') : tr('Sync TikTok', '同步 TikTok') }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 overflow-hidden rounded-3xl border border-slate-200">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <select v-model="filters.channel" class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500" @change="handleFilter">
            <option value="">{{ tr('All channels', '全部渠道') }}</option>
            <option value="shopee">Shopee</option>
            <option value="lazada">Lazada</option>
            <option value="tiktok">TikTok</option>
          </select>
          <select v-model="filters.status" class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500" @change="handleFilter">
            <option value="all">{{ tr('All status', '全部状态') }}</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <input
            v-model="filters.search"
            type="text"
            :placeholder="tr('Search order id or buyer', '搜索订单号或买家')"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 md:w-72"
            @input="handleFilter"
          />
        </div>

        <div v-if="loading" class="border-b border-slate-200 px-4 py-4 text-sm text-slate-500">
          {{ tr('Loading...', '加载中...') }}
        </div>

        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-4">{{ tr('Channel', '渠道') }}</th>
              <th class="px-4 py-4">{{ tr('Order', '订单') }}</th>
              <th class="px-4 py-4">{{ tr('Buyer', '买家') }}</th>
              <th class="px-4 py-4">{{ tr('Status', '状态') }}</th>
              <th class="px-4 py-4">{{ tr('Items', '明细') }}</th>
              <th class="px-4 py-4">{{ tr('Created', '下单时间') }}</th>
              <th class="px-4 py-4">{{ tr('Actions', '操作') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in items" :key="order.id" class="border-t border-slate-100">
              <td class="px-4 py-4 font-semibold uppercase text-slate-700">{{ order.channel }}</td>
              <td class="px-4 py-4">
                <p class="font-semibold text-slate-900">{{ order.external_order_id }}</p>
                <p class="text-xs text-slate-500">#{{ order.id }}</p>
              </td>
              <td class="px-4 py-4 text-slate-600">{{ order.buyer_name || '—' }}</td>
              <td class="px-4 py-4">
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{{ order.order_status }}</span>
              </td>
              <td class="px-4 py-4 text-slate-600">{{ order.item_count }}</td>
              <td class="px-4 py-4 text-slate-600">{{ order.order_created_at || '—' }}</td>
              <td class="px-4 py-4">
                <button class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="openOrder(order.id)">
                  {{ tr('Open', '打开') }}
                </button>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td class="px-4 py-6 text-sm text-slate-500" colspan="7">{{ tr('No orders found.', '暂无订单。') }}</td>
            </tr>
          </tbody>
        </table>

        <PaginationBar :pagination="pagination" @change="loadOrders" />
      </div>
    </section>
  </AppLayout>
</template>

