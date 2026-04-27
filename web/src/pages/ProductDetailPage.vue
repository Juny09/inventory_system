<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useCostAccessStore } from '../stores/costAccess'
import { useCurrencyStore } from '../stores/currency'
import { useLocaleStore } from '../stores/locale'
import { useToastStore } from '../stores/toast'
import { formatMoney } from '../utils/money'
import {
  buildProductQrDataUrl,
  downloadDataUrl,
  printProductLabel,
} from '../utils/productHelpers'

const route = useRoute()
const costAccessStore = useCostAccessStore()
const currencyStore = useCurrencyStore()
const localeStore = useLocaleStore()
const toastStore = useToastStore()
const product = ref(null)
const stockLevels = ref([])
const recentMovements = ref([])
const alerts = ref([])
const images = ref([])
const pricingRules = ref([])
const supplier = ref(null)
const costPriceHistory = ref([])
const summary = ref({
  totalOnHand: 0,
  totalAllocated: 0,
  totalAvailable: 0,
  warehouseCount: 0,
  lowStockCount: 0,
})
const loading = ref(true)
const errorMessage = ref('')
const qrPreview = ref('')
const costPasscode = ref('')
const pricingChannel = ref(localStorage.getItem('inventory_pricing_channel') || 'retail')

const markupSummary = computed(() => Number(product.value?.markup_percentage || 0))

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

function formatCurrency(value) {
  return formatMoney(value, currencyStore.currency, localeStore.locale)
}

function displayCost(value) {
  return value !== null && value !== undefined && costAccessStore.isUnlocked ? formatCurrency(value) : '******'
}

async function loadDetail() {
  loading.value = true

  try {
    const { data } = await api.get(`/products/${route.params.id}`, {
      params: {
        pricingChannel: pricingChannel.value || undefined,
      },
    })
    product.value = data.product
    images.value = data.images || data.product.images || []
    pricingRules.value = data.pricingRules || data.product.pricing_rules || []
    stockLevels.value = data.stockLevels
    recentMovements.value = data.recentMovements
    alerts.value = data.alerts
    summary.value = data.summary
    supplier.value = data.supplier || null
    costPriceHistory.value = data.costPriceHistory || []
    qrPreview.value = await buildProductQrDataUrl(data.product.product_code)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load product detail.'
  } finally {
    loading.value = false
  }
}

async function unlockCost() {
  try {
    await costAccessStore.unlock(costPasscode.value)
    costPasscode.value = ''
    toastStore.pushToast({
      tone: 'success',
      message: tr('Cost details unlocked for this session.', '成本信息已解锁，可查看商品页价格细节。'),
    })
    await loadDetail()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to unlock cost.'
  }
}

async function lockCost() {
  costAccessStore.lock()
  await loadDetail()
}

async function downloadQrCode() {
  if (!product.value?.product_code) {
    return
  }

  const dataUrl = await buildProductQrDataUrl(product.value.product_code)
  downloadDataUrl(`${product.value.product_code}.png`, dataUrl)
}

async function printLabel() {
  if (!product.value?.product_code) {
    return
  }

  const dataUrl = await buildProductQrDataUrl(product.value.product_code)
  printProductLabel(product.value, dataUrl)
}

onMounted(loadDetail)

watch(pricingChannel, (value) => {
  localStorage.setItem('inventory_pricing_channel', value)
  loadDetail()
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-slate-400 sm:text-sm sm:tracking-[0.3em]">Product Page</p>
          <h2 class="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{{ product?.name || 'Product detail' }}</h2>
          <p class="mt-2 text-sm text-slate-500">
            {{ tr('View product profile, inventory distribution, movements, low-stock alerts and QR labels in one page.', '单独查看商品资料、库存分布、出入库记录、低库存提醒与二维码标签。') }}
          </p>
        </div>
        <RouterLink
          :to="{ name: 'products' }"
          class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 sm:w-auto"
        >
          {{ tr('Back to Product List', '返回 Product list') }}
        </RouterLink>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="loading" class="mt-6 rounded-3xl border border-slate-200 p-6 text-sm text-slate-500">
        Loading product detail...
      </div>

      <template v-else-if="product">
        <div class="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div class="rounded-3xl border border-slate-200 p-4 sm:p-5">
            <div class="flex flex-wrap items-start gap-4">
              <div v-if="images.length > 0" class="grid gap-3">
                <img
                  :src="images[0].image_data"
                  alt="Product"
                  class="h-40 w-40 rounded-3xl object-cover"
                />
                <div class="grid grid-cols-4 gap-2">
                  <img
                    v-for="image in images.slice(0, 4)"
                    :key="image.id"
                    :src="image.image_data"
                    alt="Gallery"
                    class="h-12 w-12 rounded-2xl object-cover sm:h-14 sm:w-14"
                  />
                </div>
              </div>
              <div v-else class="flex h-40 w-40 items-center justify-center rounded-3xl bg-slate-100 text-sm font-semibold text-slate-400">
                NO IMAGE
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap gap-2">
                  <span class="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{{ product.category_name || 'Uncategorized' }}</span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{{ product.unit }}</span>
                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'"
                  >
                    {{ product.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div class="rounded-2xl bg-slate-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-400">SKU</p>
                    <p class="mt-1 font-medium text-slate-900">{{ product.sku }}</p>
                  </div>
                  <div class="rounded-2xl bg-slate-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Product Code</p>
                    <p class="mt-1 font-medium text-slate-900">{{ product.product_code }}</p>
                  </div>
                  <div class="rounded-2xl bg-slate-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Barcode</p>
                    <p class="mt-1 font-medium text-slate-900">{{ product.barcode || '—' }}</p>
                  </div>
                    <div class="rounded-2xl bg-slate-50 px-4 py-3">
                      <p class="text-xs uppercase tracking-[0.2em] text-slate-400">SKU Type</p>
                      <p class="mt-1 font-medium text-slate-900">{{ product.sku_type || 'SINGLE' }}</p>
                    </div>
                  <div class="rounded-2xl bg-slate-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Reorder Level</p>
                    <p class="mt-1 font-medium text-slate-900">{{ product.reorder_level }}</p>
                  </div>
                </div>
              </div>
              <div v-if="product.sku_type === 'COMBO'" class="mt-4 rounded-2xl bg-slate-50 p-4">
                <p class="text-sm font-semibold text-slate-900">Bundle items</p>
                <div class="mt-3 space-y-2">
                  <div
                    v-for="item in product.bundle_items || []"
                    :key="item.id"
                    class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {{ item.item_product_name }} · {{ item.item_product_sku }} × {{ Number(item.item_quantity).toFixed(3) }}
                  </div>
                  <p v-if="(product.bundle_items || []).length === 0" class="text-sm text-slate-500">No bundle component configured.</p>
                </div>
              </div>
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-4">
              <div class="rounded-3xl border border-slate-200 p-4">
                <p class="text-sm text-slate-500">Total on hand</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">{{ summary.totalOnHand }}</p>
              </div>
              <div class="rounded-3xl border border-slate-200 p-4">
                <p class="text-sm text-slate-500">Order allocated</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">{{ summary.totalAllocated || 0 }}</p>
              </div>
              <div class="rounded-3xl border border-slate-200 p-4">
                <p class="text-sm text-slate-500">Warehouse available</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">{{ summary.totalAvailable || 0 }}</p>
              </div>
              <div class="rounded-3xl border border-slate-200 p-4">
                <p class="text-sm text-slate-500">Warehouses</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">{{ summary.warehouseCount }}</p>
              </div>
            </div>

            <div class="mt-6 grid gap-4 lg:grid-cols-[220px_1fr]">
              <div class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">QR Label</p>
                <div class="mt-3 flex min-h-48 items-center justify-center rounded-2xl bg-white p-4">
                  <img v-if="qrPreview" :src="qrPreview" alt="QR Code" class="h-40 w-40 rounded-xl object-contain" />
                </div>
                <div class="mt-4 flex gap-2">
                  <button type="button" class="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" @click="downloadQrCode">
                    {{ tr('Download', '下载') }}
                  </button>
                  <button type="button" class="flex-1 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" @click="printLabel">
                    {{ tr('Print', '打印') }}
                  </button>
                </div>
              </div>
              <div class="space-y-4">
                <div class="rounded-3xl border border-slate-200 p-4">
                  <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div>
                      <h3 class="text-lg font-semibold text-slate-900">Pricing</h3>
                      <p class="mt-1 text-sm text-slate-500">{{ tr('Cost, suggested and selling prices are summarized here.', '成本、建议售价与实际售价会集中展示在这里。') }}</p>
                    </div>
                    <select
                      v-model="pricingChannel"
                      class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 sm:w-auto"
                    >
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="vip">VIP</option>
                    </select>
                    <button
                      v-if="costAccessStore.isUnlocked"
                      type="button"
                      class="w-full rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 sm:w-auto"
                      @click="lockCost"
                    >
                      {{ tr('Hide Cost', '隐藏成本') }}
                    </button>
                  </div>
                  <div v-if="!costAccessStore.isUnlocked" class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-4">
                    <input
                      v-model="costPasscode"
                      type="password"
                      :placeholder="tr('Enter passcode to view cost', '输入 passcode 查看成本')"
                      class="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                      :disabled="costAccessStore.loading"
                      @click="unlockCost"
                    >
                      {{ costAccessStore.loading ? tr('Verifying...', '验证中...') : tr('Unlock Cost', '查看成本') }}
                    </button>
                  </div>
                  <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div class="rounded-2xl bg-slate-50 px-4 py-3">
                      <p class="text-xs text-slate-400">Cost</p>
                      <p class="mt-1 font-semibold text-slate-900">{{ displayCost(product.cost_price) }}</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 px-4 py-3">
                      <p class="text-xs text-slate-400">{{ tr('C-code', '成本编码') }}</p>
                      <p class="mt-1 font-semibold text-slate-900">{{ product.cost_code || '—' }}</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 px-4 py-3">
                      <p class="text-xs text-slate-400">Markup</p>
                      <p class="mt-1 font-semibold text-slate-900">{{ markupSummary }}%</p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 px-4 py-3">
                      <p class="text-xs text-slate-400">Suggested</p>
                      <p class="mt-1 font-semibold text-slate-900">
                        {{ formatCurrency(product.active_suggested_price ?? product.suggested_price ?? product.selling_price) }}
                      </p>
                    </div>
                    <div class="rounded-2xl bg-slate-50 px-4 py-3">
                      <p class="text-xs text-slate-400">Selling</p>
                      <p class="mt-1 font-semibold text-slate-900">{{ formatCurrency(product.selling_price) }}</p>
                    </div>
                  </div>
                  <div class="mt-4 rounded-2xl bg-slate-50 p-4">
                    <p class="text-sm font-semibold text-slate-900">Pricing rule matrix</p>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                      <div
                        v-for="rule in pricingRules"
                        :key="rule.id"
                        class="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div class="flex items-center justify-between gap-3">
                          <p class="font-medium text-slate-900">{{ rule.rule_name }}</p>
                          <span
                            class="rounded-full px-3 py-1 text-xs font-semibold"
                            :class="rule.is_default ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'"
                          >
                            {{ rule.is_default ? 'Default' : 'Rule' }}
                          </span>
                        </div>
                        <p class="mt-2 text-sm text-slate-500">Markup {{ Number(rule.markup_percentage || 0).toFixed(2) }}%</p>
                        <p class="mt-1 text-sm text-slate-700">Suggested {{ formatCurrency(rule.suggested_price) }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="rounded-3xl border border-slate-200 p-4">
                  <h3 class="text-lg font-semibold text-slate-900">Description</h3>
                  <p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{{ product.description || tr('No product description.', '暂无商品说明。') }}</p>
                </div>
                <div class="grid gap-4 md:grid-cols-3">
                  <div class="rounded-3xl border border-slate-200 p-4">
                    <h3 class="text-lg font-semibold text-slate-900">How to use</h3>
                    <p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{{ product.usage_guide || tr('No usage guide.', '暂无使用说明。') }}</p>
                  </div>
                  <div class="rounded-3xl border border-slate-200 p-4">
                    <h3 class="text-lg font-semibold text-slate-900">Pros</h3>
                    <p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{{ product.pros || tr('No pros listed.', '暂无优点说明。') }}</p>
                  </div>
                  <div class="rounded-3xl border border-slate-200 p-4">
                    <h3 class="text-lg font-semibold text-slate-900">Cons</h3>
                    <p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{{ product.cons || tr('No cons listed.', '暂无缺点说明。') }}</p>
                  </div>
                </div>
                <div class="rounded-3xl border border-slate-200 p-4">
                  <h3 class="text-lg font-semibold text-slate-900">{{ tr('Supplier', '供应商') }}</h3>
                  <p class="mt-1 text-sm text-slate-500">{{ tr('Primary supplier for replenishment.', '用于补货的主供应商信息。') }}</p>
                  <div v-if="supplier" class="mt-4 space-y-1 text-sm text-slate-700">
                    <p class="font-semibold text-slate-900">{{ supplier.name }}</p>
                    <p class="text-slate-600">{{ supplier.contact_name || '—' }} · {{ supplier.phone || supplier.email || '—' }}</p>
                    <p class="text-slate-500">{{ tr('Lead time', '交货周期') }}: {{ supplier.lead_time_days }}d</p>
                  </div>
                  <p v-else class="mt-4 text-sm text-slate-500">{{ tr('No supplier assigned.', '未指定供应商。') }}</p>
                  <RouterLink
                    class="mt-4 inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    :to="{ name: 'product-form', query: { id: String(product.id) } }"
                  >
                    {{ tr('Edit supplier', '编辑供应商') }}
                  </RouterLink>
                </div>
                <div class="rounded-3xl border border-slate-200 p-4">
                  <h3 class="text-lg font-semibold text-slate-900">{{ tr('Cost history', '成本历史') }}</h3>
                  <p class="mt-1 text-sm text-slate-500">{{ tr('Latest 5 cost changes.', '最近 5 次成本变动记录。') }}</p>
                  <div class="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <table class="min-w-full text-left text-sm">
                      <thead class="bg-slate-50 text-slate-500">
                        <tr>
                          <th class="px-3 py-3">{{ tr('Time', '时间') }}</th>
                          <th class="px-3 py-3">{{ tr('Old', '旧') }}</th>
                          <th class="px-3 py-3">{{ tr('New', '新') }}</th>
                          <th class="px-3 py-3">{{ tr('%', '变动%') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="item in costPriceHistory" :key="item.id" class="border-t border-slate-100">
                          <td class="px-3 py-3 text-slate-600">{{ item.changed_at }}</td>
                          <td class="px-3 py-3 text-slate-600">{{ displayCost(item.old_cost_price) }}</td>
                          <td class="px-3 py-3 text-slate-600">{{ displayCost(item.new_cost_price) }}</td>
                          <td class="px-3 py-3">
                            <span
                              class="rounded-full px-2 py-0.5 text-xs font-semibold"
                              :class="Number(item.percent_change) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'"
                            >
                              {{ Number(item.percent_change).toFixed(2) }}%
                            </span>
                          </td>
                        </tr>
                        <tr v-if="costPriceHistory.length === 0">
                          <td class="px-3 py-4 text-sm text-slate-500" colspan="4">{{ tr('No cost history.', '暂无成本历史。') }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="rounded-3xl border border-slate-200 p-4 sm:p-5">
              <h3 class="text-lg font-semibold text-slate-900 sm:text-xl">Stock by warehouse</h3>
              <div class="mt-4 space-y-3">
                <div
                  v-for="stock in stockLevels"
                  :key="stock.id"
                  class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="font-medium text-slate-900">{{ stock.warehouse_name }}</p>
                      <p class="text-xs text-slate-500">{{ stock.warehouse_code }}</p>
                    </div>
                    <span class="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{{ stock.warehouse_available_quantity }}</span>
                  </div>
                  <p class="mt-2 text-xs text-slate-500">On hand {{ stock.on_hand_quantity }} · Allocated {{ stock.order_allocated_quantity }}</p>
                </div>
                <p v-if="stockLevels.length === 0" class="text-sm text-slate-500">{{ tr('No stock record yet.', '当前没有库存记录。') }}</p>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 p-4 sm:p-5">
              <h3 class="text-lg font-semibold text-slate-900 sm:text-xl">Low stock alerts</h3>
              <div class="mt-4 space-y-3">
                <div
                  v-for="alert in alerts"
                  :key="`${alert.warehouse_id}-${alert.alert_status}`"
                  class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"
                >
                  <p class="font-medium text-slate-900">{{ alert.warehouse_name }}</p>
                  <p class="mt-1 text-sm text-amber-700">{{ tr('Status', '状态') }} {{ alert.alert_status }} · {{ tr('Shortage', '缺口') }} {{ alert.shortage }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ tr('Assignee', '负责人') }}: {{ alert.assigned_to_name || tr('Unassigned', '未指派') }}</p>
                </div>
                <p v-if="alerts.length === 0" class="text-sm text-slate-500">{{ tr('No low-stock alerts.', '当前没有低库存提醒。') }}</p>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 p-4 sm:p-5">
              <h3 class="text-lg font-semibold text-slate-900 sm:text-xl">Recent movements</h3>
              <div class="mt-4 space-y-3">
                <div
                  v-for="movement in recentMovements"
                  :key="movement.id"
                  class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <span class="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      {{ movement.movement_type }}
                    </span>
                    <span class="text-xs text-slate-400">{{ new Date(movement.created_at).toLocaleString() }}</span>
                  </div>
                  <p class="mt-3 text-sm text-slate-700">{{ tr('Qty', '数量') }} {{ movement.quantity }} · {{ tr('Ref', '参考号') }} {{ movement.reference_no || '—' }}</p>
                  <p class="mt-1 text-xs text-slate-500">From {{ movement.source_warehouse_name || '—' }} → {{ movement.destination_warehouse_name || '—' }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ tr('Operator', '操作人') }}: {{ movement.created_by_name || 'System' }}</p>
                </div>
                <p v-if="recentMovements.length === 0" class="text-sm text-slate-500">{{ tr('No recent movements.', '暂无最近流水记录。') }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>
  </AppLayout>
</template>
