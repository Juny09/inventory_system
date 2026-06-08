<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import BarcodeScanner from '../components/BarcodeScanner.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const manualCode = ref('')
const lastScannedCode = ref('')
const loading = ref(false)
const errorMessage = ref('')
const searchSummary = ref('')
const searchMode = ref('')
const matchedProducts = ref([])
const matchedVariant = ref(null)
const productDetail = ref(null)

const primaryProduct = computed(() => productDetail.value?.product || matchedProducts.value[0] || null)
const inventorySummary = computed(() => productDetail.value?.summary || {
  totalOnHand: 0,
  totalAllocated: 0,
  totalAvailable: 0,
  warehouseCount: 0,
})
const inventoryStockLevels = computed(() => productDetail.value?.stockLevels || [])
const canOpenProductsPage = computed(() => ['ADMIN', 'MANAGER'].includes(authStore.user?.role || ''))
const resolvedVariantId = computed(() => {
  if (matchedVariant.value?.id) {
    return Number(matchedVariant.value.id)
  }
  const variants = Array.isArray(productDetail.value?.variants) ? productDetail.value.variants : []
  const defaultVariant = variants.find((item) => String(item.variant_label || '').toUpperCase() === 'DEFAULT')
  return Number(defaultVariant?.id || variants[0]?.id || 0) || null
})

function normalizeCode(value) {
  return String(value || '').trim()
}

function normalizeCompareValue(value) {
  return String(value || '').trim().toUpperCase()
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function extractLookupCandidates(rawValue) {
  const raw = normalizeCode(rawValue)
  if (!raw) return []

  const candidates = [raw]

  try {
    const parsedUrl = new URL(raw)
    const codeKeys = ['code', 'product_code', 'productCode', 'barcode', 'sku']
    codeKeys.forEach((key) => {
      const value = parsedUrl.searchParams.get(key)
      if (value) {
        candidates.push(value)
      }
    })

    const pathnameSegments = parsedUrl.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
    if (pathnameSegments.length > 0) {
      candidates.push(pathnameSegments[pathnameSegments.length - 1])
    }
  } catch {
    // 中文注释：普通条码/二维码文本不是 URL 时，直接按原文处理即可。
  }

  return uniqueValues(candidates)
}

function isExactProductMatch(product, candidate) {
  const target = normalizeCompareValue(candidate)
  if (!target) return false

  return [
    product?.barcode,
    product?.product_code,
    product?.sku,
  ].some((value) => normalizeCompareValue(value) === target)
}

function isExactVariantMatch(variant, candidate) {
  const target = normalizeCompareValue(candidate)
  if (!target) return false

  return [
    variant?.barcode,
    variant?.sku,
  ].some((value) => normalizeCompareValue(value) === target)
}

function uniqueProducts(products = []) {
  const map = new Map()
  products.forEach((product) => {
    if (product?.id) {
      map.set(Number(product.id), product)
    }
  })
  return [...map.values()]
}

function buildVariantProductFallback(variant) {
  return {
    id: Number(variant?.product_id || 0),
    name: variant?.product_name || '未知货品',
    sku: variant?.sku || '',
    product_code: '',
    barcode: variant?.barcode || '',
    category_name: variant?.category_name || '',
    unit: variant?.unit || '',
    selling_price: 0,
    is_active: variant?.is_active !== false,
  }
}

async function loadProductSnapshot(productId) {
  if (!productId) {
    productDetail.value = null
    return
  }

  const { data } = await api.get(`/products/${productId}`)
  productDetail.value = data
}

function pickPreferredWarehouseId(action) {
  const stockLevels = inventoryStockLevels.value
  if (stockLevels.length === 0) return ''
  if (stockLevels.length === 1) return String(stockLevels[0].warehouse_id || '')

  if (action === 'stockOut') {
    const bestWarehouse = [...stockLevels]
      .filter((item) => Number(item.warehouse_available_quantity) > 0)
      .sort((left, right) => Number(right.warehouse_available_quantity) - Number(left.warehouse_available_quantity))[0]
    return String(bestWarehouse?.warehouse_id || '')
  }

  return ''
}

async function searchProductsByCode(rawValue) {
  const candidates = extractLookupCandidates(rawValue)
  if (candidates.length === 0) {
    matchedProducts.value = []
    matchedVariant.value = null
    productDetail.value = null
    searchMode.value = 'empty'
    searchSummary.value = ''
    return
  }

  let fuzzyItems = []

  for (const candidate of candidates) {
    const [productResponse, variantResponse] = await Promise.all([
      api.get('/products', {
        params: {
          all: true,
          status: 'all',
          search: candidate,
        },
      }),
      api.get('/product-variants', {
        params: {
          all: true,
          status: 'all',
          search: candidate,
        },
      }),
    ])

    const items = Array.isArray(productResponse.data?.items) ? productResponse.data.items : []
    const variants = Array.isArray(variantResponse.data?.items) ? variantResponse.data.items : []
    const exactItems = items.filter((product) => isExactProductMatch(product, candidate))
    const exactVariants = variants.filter((variant) => isExactVariantMatch(variant, candidate))

    const exactProducts = uniqueProducts([
      ...exactItems,
      ...exactVariants.map((variant) => items.find((product) => Number(product.id) === Number(variant.product_id)) || buildVariantProductFallback(variant)),
    ])

    if (exactProducts.length === 1) {
      matchedProducts.value = exactProducts
      matchedVariant.value = exactVariants[0] || null
      await loadProductSnapshot(exactProducts[0].id)
      searchMode.value = 'exact'
      searchSummary.value = exactVariants.length > 0
        ? `已按 ${candidate} 精准匹配到 SKU，并同步带出当前库存。`
        : `已按 ${candidate} 精准匹配到货品，并同步带出当前库存。`
      return
    }

    if (exactProducts.length > 1) {
      matchedProducts.value = exactProducts
      matchedVariant.value = exactVariants[0] || null
      productDetail.value = null
      searchMode.value = 'exact'
      searchSummary.value = `已按 ${candidate} 找到多条完全匹配结果，请先点开正确货品。`
      return
    }

    if (fuzzyItems.length === 0 && items.length > 0) {
      fuzzyItems = items.slice(0, 8)
    }
  }

  if (fuzzyItems.length > 0) {
    matchedProducts.value = fuzzyItems
    matchedVariant.value = null
    productDetail.value = null
    searchMode.value = 'fuzzy'
    searchSummary.value = '没有完全匹配，先显示最接近的货品给你核对。'
    return
  }

  matchedProducts.value = []
  matchedVariant.value = null
  productDetail.value = null
  searchMode.value = 'none'
  searchSummary.value = '暂时找不到这个条码/二维码对应的货品。'
}

async function handleDetected(code) {
  const normalized = normalizeCode(code)
  if (!normalized) return

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(120)
  }

  lastScannedCode.value = normalized
  manualCode.value = normalized
  errorMessage.value = ''
  loading.value = true

  try {
    await searchProductsByCode(normalized)
  } catch (error) {
    matchedProducts.value = []
    matchedVariant.value = null
    productDetail.value = null
    searchMode.value = 'error'
    searchSummary.value = ''
    errorMessage.value = error.response?.data?.message || error.message || '扫码后查询货品失败。'
  } finally {
    loading.value = false
  }
}

async function handleManualSearch() {
  await handleDetected(manualCode.value)
}

function openProductDetail(productId) {
  if (!productId) return
  router.push({ name: 'product-detail', params: { id: String(productId) } })
}

function goToProductsPage() {
  router.push({ name: 'products', query: lastScannedCode.value ? { search: lastScannedCode.value } : undefined })
}

function goToInventoryAction(action) {
  if (!primaryProduct.value?.id || !resolvedVariantId.value) return

  const warehouseId = pickPreferredWarehouseId(action)
  router.push({
    name: 'inventory',
    query: {
      action,
      productId: String(primaryProduct.value.id),
      variantId: String(resolvedVariantId.value),
      warehouseId: warehouseId || undefined,
      scannedCode: lastScannedCode.value || undefined,
      prefillToken: String(Date.now()),
    },
  })
}
</script>

<template>
  <AppLayout>
    <section class="mx-auto w-full max-w-5xl">
      <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500">Mobile Scanner</p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">手机扫码查货品</h2>
            <p class="mt-2 max-w-2xl text-sm text-slate-500">
              用手机相机扫描条码或二维码，系统会自动帮你查货品资料。适合门店、仓库和出货现场快速核对。
            </p>
          </div>
          <button
            v-if="canOpenProductsPage"
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="goToProductsPage"
          >
            打开 Products 列表
          </button>
        </div>

        <div class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div class="rounded-3xl border border-slate-200 bg-slate-950 p-3">
            <BarcodeScanner
              auto-start
              start-label="重新开始扫码"
              stop-label="暂停相机"
              hint-text="建议使用手机后置摄像头，对准条码或二维码中央。"
              panel-class="rounded-3xl bg-slate-950 p-0"
              video-class="aspect-[3/4] w-full rounded-[1.4rem] bg-black object-cover"
            />
          </div>

          <div class="space-y-4">
            <div class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Scan Result</p>
              <p class="mt-2 break-all text-base font-semibold text-slate-900">
                {{ lastScannedCode || '还没有扫码结果' }}
              </p>
              <div class="mt-4 flex gap-2">
                <input
                  v-model="manualCode"
                  type="text"
                  placeholder="手动输入 barcode / QR / product code"
                  class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  @keyup.enter="handleManualSearch"
                />
                <button
                  type="button"
                  class="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                  @click="handleManualSearch"
                >
                  查询
                </button>
              </div>
              <p v-if="searchSummary" class="mt-3 text-sm text-emerald-700">{{ searchSummary }}</p>
              <p v-if="loading" class="mt-3 text-sm text-slate-500">正在查询货品资料...</p>
              <p v-if="errorMessage" class="mt-3 text-sm text-rose-600">{{ errorMessage }}</p>
            </div>

            <div v-if="primaryProduct" class="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Product Info</p>
                  <h3 class="mt-2 text-xl font-semibold text-slate-900">{{ primaryProduct.name }}</h3>
                  <p class="mt-1 text-sm text-slate-600">
                    {{ primaryProduct.category_name || '未分类' }}
                    <span v-if="primaryProduct.unit" class="ml-1">· {{ primaryProduct.unit }}</span>
                  </p>
                </div>
                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  :class="primaryProduct.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'"
                >
                  {{ primaryProduct.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>

              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl bg-white px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">SKU</p>
                  <p class="mt-1 font-medium text-slate-900">{{ primaryProduct.sku || '—' }}</p>
                </div>
                <div class="rounded-2xl bg-white px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Product Code</p>
                  <p class="mt-1 font-medium text-slate-900">{{ primaryProduct.product_code || '—' }}</p>
                </div>
                <div class="rounded-2xl bg-white px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Barcode</p>
                  <p class="mt-1 font-medium text-slate-900">{{ primaryProduct.barcode || '—' }}</p>
                </div>
                <div class="rounded-2xl bg-white px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Selling Price</p>
                  <p class="mt-1 font-medium text-slate-900">{{ Number(primaryProduct.selling_price || 0).toFixed(2) }}</p>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  @click="openProductDetail(primaryProduct.id)"
                >
                  查看详情
                </button>
                <button
                  type="button"
                  class="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!resolvedVariantId"
                  @click="goToInventoryAction('stockIn')"
                >
                  直接入库
                </button>
                <button
                  type="button"
                  class="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!resolvedVariantId"
                  @click="goToInventoryAction('stockOut')"
                >
                  直接出库
                </button>
                <button
                  v-if="canOpenProductsPage"
                  type="button"
                  class="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                  @click="goToProductsPage"
                >
                  在 Products 里查看
                </button>
              </div>
            </div>

            <div v-if="productDetail" class="rounded-3xl border border-slate-200 bg-white p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current Inventory</p>
                  <h3 class="mt-1 text-lg font-semibold text-slate-900">当前库存</h3>
                </div>
                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {{ inventorySummary.warehouseCount || 0 }} 个仓库
                </span>
              </div>

              <div class="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">On Hand</p>
                  <p class="mt-1 font-semibold text-slate-900">{{ inventorySummary.totalOnHand || 0 }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Allocated</p>
                  <p class="mt-1 font-semibold text-slate-900">{{ inventorySummary.totalAllocated || 0 }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Available</p>
                  <p class="mt-1 font-semibold text-slate-900">{{ inventorySummary.totalAvailable || 0 }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Matched SKU</p>
                  <p class="mt-1 font-semibold text-slate-900">{{ matchedVariant?.sku || primaryProduct.sku || '—' }}</p>
                </div>
              </div>

              <div class="mt-4 space-y-3">
                <div
                  v-for="stock in inventoryStockLevels"
                  :key="stock.id"
                  class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="font-semibold text-slate-900">{{ stock.warehouse_name }}</p>
                      <p class="mt-1 text-xs text-slate-500">{{ stock.warehouse_code }}</p>
                    </div>
                    <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      可用 {{ stock.warehouse_available_quantity }}
                    </span>
                  </div>
                  <p class="mt-2 text-xs text-slate-500">
                    On hand {{ stock.on_hand_quantity }} · Allocated {{ stock.order_allocated_quantity }}
                  </p>
                </div>
                <p v-if="inventoryStockLevels.length === 0" class="text-sm text-slate-500">
                  这件货目前还没有库存记录，你仍然可以直接带去做入库。
                </p>
              </div>
            </div>

            <div v-if="matchedProducts.length > 1" class="rounded-3xl border border-slate-200 bg-white p-4">
              <p class="text-sm font-semibold text-slate-900">候选货品</p>
              <div class="mt-3 space-y-3">
                <button
                  v-for="product in matchedProducts"
                  :key="product.id"
                  type="button"
                  class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left hover:border-emerald-300 hover:bg-emerald-50"
                  @click="openProductDetail(product.id)"
                >
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="font-semibold text-slate-900">{{ product.name }}</p>
                      <p class="mt-1 text-xs text-slate-500">
                        {{ product.sku || '—' }} · {{ product.product_code || '—' }} · {{ product.barcode || '—' }}
                      </p>
                    </div>
                    <span class="text-sm font-semibold text-slate-700">{{ Number(product.selling_price || 0).toFixed(2) }}</span>
                  </div>
                </button>
              </div>
            </div>

            <div v-if="searchMode === 'none'" class="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              没找到对应货品。你可以检查条码是否录入到商品资料，或手动输入 `product code / barcode / sku` 再查一次。
            </div>
          </div>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
