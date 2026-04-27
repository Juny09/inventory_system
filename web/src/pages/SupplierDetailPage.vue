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
const supplier = ref(null)
const products = ref([])
const recentPurchases = ref([])

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

async function loadDetail() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get(`/suppliers/${route.params.id}`)
    supplier.value = data.supplier
    products.value = data.products || []
    recentPurchases.value = data.recentPurchases || []
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load supplier.', '加载供应商失败。')
  } finally {
    loading.value = false
  }
}

function back() {
  router.push({ name: 'suppliers' })
}

function edit() {
  router.push({ name: 'supplier-form', query: { id: String(route.params.id) } })
}

onMounted(loadDetail)
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Master Data</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ supplier?.company_name || supplier?.name || tr('Supplier detail', '供应商详情') }}</h2>
        </div>
        <div class="flex gap-2">
          <button class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" @click="back">
            {{ tr('Back', '返回') }}
          </button>
          <button class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" @click="edit">
            {{ tr('Edit', '编辑') }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="loading" class="mt-6 rounded-3xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
        {{ tr('Loading...', '加载中...') }}
      </div>

      <div v-else class="mt-6 grid gap-6 2xl:grid-cols-[360px_1fr]">
        <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 class="text-xl font-semibold text-slate-900">{{ tr('Supplier info', '供应商信息') }}</h3>
          <div class="mt-4 space-y-2 text-sm text-slate-700">
            <p v-if="supplier?.company_name && supplier?.company_name !== supplier?.name">
              <span class="text-slate-500">{{ tr('Supplier name', '供应商名称') }}:</span> {{ supplier?.name || '—' }}
            </p>
            <p><span class="text-slate-500">{{ tr('Contact', '联系人') }}:</span> {{ supplier?.contact_name || '—' }}</p>
            <p><span class="text-slate-500">{{ tr('Phone', '电话') }}:</span> {{ supplier?.phone || '—' }}</p>
            <p><span class="text-slate-500">{{ tr('Email', '邮箱') }}:</span> {{ supplier?.email || '—' }}</p>
            <p><span class="text-slate-500">{{ tr('Lead time', '交货周期') }}:</span> {{ supplier?.lead_time_days ?? 0 }}d</p>
            <p><span class="text-slate-500">{{ tr('Payment terms', '付款条件') }}:</span> {{ supplier?.payment_terms || '—' }}</p>
            <p><span class="text-slate-500">{{ tr('Address', '地址') }}:</span> {{ supplier?.address || '—' }}</p>
            <p>
              <span class="text-slate-500">{{ tr('Status', '状态') }}:</span>
              <span
                class="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="supplier?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'"
              >
                {{ supplier?.is_active ? tr('Active', '启用') : tr('Inactive', '停用') }}
              </span>
            </p>
          </div>
        </div>

        <div class="space-y-6">
          <div class="overflow-hidden rounded-3xl border border-slate-200">
            <div class="border-b border-slate-200 bg-slate-50 px-4 py-4">
              <h3 class="text-xl font-semibold text-slate-900">{{ tr('Linked products', '关联商品') }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ tr('Products that can be purchased from this supplier.', '可从该供应商采购的商品列表。') }}</p>
            </div>
            <div class="space-y-3 p-4 md:hidden">
              <article v-for="item in products" :key="item.id" class="rounded-3xl border border-slate-200 p-4">
                <p class="font-semibold text-slate-900">{{ item.name }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ item.sku }}</p>
                <p class="mt-2 text-xs text-slate-500">{{ item.category_name || '—' }}</p>
                <p class="mt-2 text-xs text-slate-500">{{ item.is_primary ? tr('Primary supplier', '主供应商') : tr('Secondary', '次要') }}</p>
              </article>
              <p v-if="products.length === 0" class="text-sm text-slate-500">{{ tr('No linked products yet.', '暂无关联商品。') }}</p>
            </div>
            <table class="hidden min-w-full text-left text-sm md:table">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-4">{{ tr('Product', '商品') }}</th>
                  <th class="px-4 py-4">{{ tr('Category', '分类') }}</th>
                  <th class="px-4 py-4">{{ tr('Primary', '主供应商') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in products" :key="item.id" class="border-t border-slate-100">
                  <td class="px-4 py-4">
                    <p class="font-semibold text-slate-900">{{ item.name }}</p>
                    <p class="text-xs text-slate-500">{{ item.sku }}</p>
                  </td>
                  <td class="px-4 py-4 text-slate-600">{{ item.category_name || '—' }}</td>
                  <td class="px-4 py-4">
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-semibold"
                      :class="item.is_primary ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'"
                    >
                      {{ item.is_primary ? tr('Yes', '是') : tr('No', '否') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="overflow-hidden rounded-3xl border border-slate-200">
            <div class="border-b border-slate-200 bg-slate-50 px-4 py-4">
              <h3 class="text-xl font-semibold text-slate-900">{{ tr('Recent purchases', '最近采购') }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ tr('Last 10 stock-in records linked to this supplier.', '最近 10 条关联该供应商的入库记录。') }}</p>
            </div>
            <div class="space-y-3 p-4">
              <article v-for="item in recentPurchases" :key="item.id" class="rounded-3xl border border-slate-200 p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="font-semibold text-slate-900">{{ item.product_name }} · {{ item.sku }}</p>
                  <p class="text-xs text-slate-500">{{ item.created_at }}</p>
                </div>
                <p class="mt-2 text-sm text-slate-700">
                  {{ tr('Qty', '数量') }}: {{ item.quantity }} · {{ tr('Unit cost', '单价') }}: {{ item.unit_cost ?? '—' }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ tr('Warehouse', '仓库') }}: {{ item.warehouse_name || '—' }} · {{ tr('Reference', '单号') }}: {{ item.reference_no || '—' }}
                </p>
                <p v-if="item.purchase_reason" class="mt-1 text-xs text-slate-500">{{ tr('Reason', '原因') }}: {{ item.purchase_reason }}</p>
              </article>
              <p v-if="recentPurchases.length === 0" class="text-sm text-slate-500">{{ tr('No purchase history yet.', '暂无采购历史。') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
