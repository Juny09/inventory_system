<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const route = useRoute()
const router = useRouter()
const localeStore = useLocaleStore()
const loading = ref(false)
const errorMessage = ref('')
const order = ref(null)

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

async function loadDetail() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get(`/orders/${route.params.id}`)
    order.value = data
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load order.', '加载订单失败。')
  } finally {
    loading.value = false
  }
}

function back() {
  router.push({ name: 'orders' })
}

onMounted(loadDetail)
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">{{ tr('Operations', '运营') }}</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Order detail', '订单详情') }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ order?.external_order_id || '—' }}</p>
        </div>
        <button class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" @click="back">
          {{ tr('Back', '返回') }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="loading" class="mt-6 rounded-3xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
        {{ tr('Loading...', '加载中...') }}
      </div>

      <div v-else-if="order" class="mt-6 grid gap-6 2xl:grid-cols-[360px_1fr]">
        <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 class="text-xl font-semibold text-slate-900">{{ tr('Summary', '概览') }}</h3>
          <div class="mt-4 space-y-2 text-sm text-slate-700">
            <p><span class="text-slate-500">{{ tr('Channel', '渠道') }}:</span> {{ order.channel }}</p>
            <p><span class="text-slate-500">{{ tr('Status', '状态') }}:</span> {{ order.order_status }}</p>
            <p><span class="text-slate-500">{{ tr('Buyer', '买家') }}:</span> {{ order.buyer_name || '—' }}</p>
            <p><span class="text-slate-500">{{ tr('Created', '下单时间') }}:</span> {{ order.order_created_at || '—' }}</p>
            <p><span class="text-slate-500">{{ tr('Synced at', '同步时间') }}:</span> {{ order.synced_at || '—' }}</p>
          </div>
        </div>

        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div class="border-b border-slate-200 bg-slate-50 px-4 py-4">
            <h3 class="text-xl font-semibold text-slate-900">{{ tr('Items', '明细') }}</h3>
          </div>
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-4">{{ tr('Product', '商品') }}</th>
                <th class="px-4 py-4">{{ tr('SKU', 'SKU') }}</th>
                <th class="px-4 py-4">{{ tr('Qty', '数量') }}</th>
                <th class="px-4 py-4">{{ tr('Price', '价格') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in order.items || []" :key="item.id" class="border-t border-slate-100">
                <td class="px-4 py-4 font-semibold text-slate-900">{{ item.product_name || item.external_product_name || '—' }}</td>
                <td class="px-4 py-4 text-slate-600">{{ item.product_sku || item.external_sku || '—' }}</td>
                <td class="px-4 py-4 text-slate-600">{{ item.quantity }}</td>
                <td class="px-4 py-4 text-slate-600">{{ item.item_price }}</td>
              </tr>
              <tr v-if="(order.items || []).length === 0">
                <td class="px-4 py-6 text-sm text-slate-500" colspan="4">{{ tr('No items.', '暂无明细。') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </AppLayout>
</template>

