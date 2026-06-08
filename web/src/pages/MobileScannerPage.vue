<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import BarcodeScanner from '../components/BarcodeScanner.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'

const router = useRouter()
const authStore = useAuthStore()
const localeStore = useLocaleStore()

const manualCode = ref('')
const lastScannedCode = ref('')
const loading = ref(false)
const errorMessage = ref('')
const searchSummary = ref('')
const searchMode = ref('')
const matchedProducts = ref([])

const canOpenProductDetail = computed(() => ['ADMIN', 'MANAGER'].includes(authStore.user?.role || ''))
const primaryProduct = computed(() => matchedProducts.value[0] || null)

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

async function searchProductsByCode(rawValue) {
  const candidates = extractLookupCandidates(rawValue)
  if (candidates.length === 0) {
    matchedProducts.value = []
    searchMode.value = 'empty'
    searchSummary.value = ''
    return
  }

  let fuzzyItems = []

  for (const candidate of candidates) {
    const { data } = await api.get('/products', {
      params: {
        all: true,
        status: 'all',
        search: candidate,
      },
    })
    const items = Array.isArray(data?.items) ? data.items : []
    const exactItems = items.filter((product) => isExactProductMatch(product, candidate))

    if (exactItems.length > 0) {
      matchedProducts.value = exactItems
      searchMode.value = 'exact'
      searchSummary.value = `已按 ${candidate} 精准匹配到 ${exactItems.length} 个货品。`
      return
    }

    if (fuzzyItems.length === 0 && items.length > 0) {
      fuzzyItems = items.slice(0, 8)
    }
  }

  if (fuzzyItems.length > 0) {
    matchedProducts.value = fuzzyItems
    searchMode.value = 'fuzzy'
    searchSummary.value = '没有完全匹配，先显示最接近的货品给你核对。'
    return
  }

  matchedProducts.value = []
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
  if (!productId || !canOpenProductDetail.value) return
  router.push({ name: 'product-detail', params: { id: String(productId) } })
}

function goToProductsPage() {
  router.push({ name: 'products', query: lastScannedCode.value ? { search: lastScannedCode.value } : undefined })
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

            <div
              v-if="primaryProduct"
              class="rounded-3xl border border-emerald-200 bg-emerald-50 p-4"
            >
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
                  v-if="canOpenProductDetail"
                  type="button"
                  class="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  @click="openProductDetail(primaryProduct.id)"
                >
                  查看详情
                </button>
                <button
                  type="button"
                  class="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                  @click="goToProductsPage"
                >
                  在 Products 里查看
                </button>
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
