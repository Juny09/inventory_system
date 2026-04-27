<script setup>
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useCostAccessStore } from '../stores/costAccess'
import { useCurrencyStore } from '../stores/currency'
import { useToastStore } from '../stores/toast'
import { useLocaleStore } from '../stores/locale'
import { encodeCostToCode } from '../utils/costCode'
import { formatMoney } from '../utils/money'
import {
  buildDefaultPricingRules,
  buildProductQrDataUrl,
  exportQrLabelsToPdf,
  downloadDataUrl,
  generateLocalProductCode,
  markupPresets,
  printMultipleProductLabels,
  printProductLabel,
  pricingRuleTemplates,
  processProductImage,
  syncPricingRules,
} from '../utils/productHelpers'

const BarcodeScanner = defineAsyncComponent(() => import('../components/BarcodeScanner.vue'))
const router = useRouter()
const authStore = useAuthStore()
const costAccessStore = useCostAccessStore()
const currencyStore = useCurrencyStore()
const toastStore = useToastStore()
const localeStore = useLocaleStore()
const products = ref([])
const categories = ref([])
const errorMessage = ref('')
const loading = ref(false)
const imageProcessing = ref(false)
const searchKeyword = ref('')
const costPasscode = ref('')
const costCalculatorInput = ref('')
const selectedProductIds = ref([])
const pricingChannel = ref(localStorage.getItem('inventory_pricing_channel') || 'retail')
const filters = reactive({
  categoryId: '',
  status: 'all',
  hasBarcode: 'all',
})
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})
const form = reactive({
  id: null,
  name: '',
  sku: '',
  skuType: 'SINGLE',
  productCode: '',
  barcode: '',
  images: [],
  bundleItems: [],
  description: '',
  usageGuide: '',
  pros: '',
  cons: '',
  categoryId: '',
  unit: 'pcs',
  costPrice: 0,
  sellingPrice: 0,
  markupPercentage: 30,
  suggestedPrice: 0,
  pricingRules: buildDefaultPricingRules(0),
  reorderLevel: 0,
  isActive: true,
})
const qrPreview = ref('')
const dragImageIndex = ref(-1)

const canEditProducts = computed(() => ['ADMIN', 'MANAGER'].includes(authStore.user?.role || ''))
const canDeleteProducts = computed(() => (authStore.user?.role || '') === 'ADMIN')

function formatCurrency(value) {
  return formatMoney(value, currencyStore.currency, localeStore.locale)
}

function getSuggestedPrice(product) {
  return product.active_suggested_price ?? product.suggested_price ?? product.selling_price
}

function displayCost(value) {
  return value !== null && value !== undefined && costAccessStore.isUnlocked ? formatCurrency(value) : '******'
}

function displayCostCode(value) {
  const code = String(value || '').trim()
  return code ? code : '—'
}

function displayCostCodeFromProduct(product) {
  const direct = String(product?.cost_code || '').trim()
  if (direct) {
    return direct
  }
  if (product?.cost_price !== null && product?.cost_price !== undefined) {
    const fallback = encodeCostToCode(product.cost_price)
    return fallback || '—'
  }
  return '—'
}

function calculatedCostCode() {
  return encodeCostToCode(costCalculatorInput.value) || '—'
}

function getProductImage(product) {
  return product.images?.[0]?.image_data || product.image_data || ''
}

function recalculatePricingRules() {
  form.pricingRules = syncPricingRules(form.costPrice, form.pricingRules)
  const defaultRule = form.pricingRules.find((rule) => rule.isDefault) || form.pricingRules[0]

  if (defaultRule) {
    form.markupPercentage = Number(defaultRule.markupPercentage || 0)
    form.suggestedPrice = Number(defaultRule.suggestedPrice || 0)
  }
}

async function updateQrPreview(value = form.productCode) {
  qrPreview.value = await buildProductQrDataUrl(value)
}

function applyMarkup(markup) {
  form.pricingRules = form.pricingRules.map((rule, index) => ({
    ...rule,
    markupPercentage: rule.isDefault || index === 0 ? markup : rule.markupPercentage,
  }))
  recalculatePricingRules()
}

function addPricingRule(template) {
  form.pricingRules = [
    ...form.pricingRules,
    {
      ruleName: template?.ruleName || `Rule ${form.pricingRules.length + 1}`,
      markupPercentage: template?.markupPercentage || 0,
      description: template?.description || '',
      isDefault: false,
      sortOrder: form.pricingRules.length,
      suggestedPrice: 0,
    },
  ]
  recalculatePricingRules()
}

function removePricingRule(index) {
  form.pricingRules = form.pricingRules.filter((_, itemIndex) => itemIndex !== index)

  if (!form.pricingRules.length) {
    form.pricingRules = buildDefaultPricingRules(form.costPrice)
  } else if (!form.pricingRules.some((rule) => rule.isDefault)) {
    form.pricingRules[0].isDefault = true
  }

  recalculatePricingRules()
}

function setDefaultPricingRule(index) {
  form.pricingRules = form.pricingRules.map((rule, itemIndex) => ({
    ...rule,
    isDefault: itemIndex === index,
  }))
  recalculatePricingRules()
}

async function unlockCost() {
  try {
    await costAccessStore.unlock(costPasscode.value)
    costPasscode.value = ''
    toastStore.pushToast({
      tone: 'success',
      message:
        localeStore.locale === 'en'
          ? 'Cost fields are unlocked for this session.'
          : '成本信息已解锁，后端接口会返回成本字段。',
    })
    await loadPageData(pagination.value.page)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to unlock cost.'
  }
}

async function lockCost() {
  costAccessStore.lock()
  toastStore.pushToast({
    tone: 'info',
    message:
      localeStore.locale === 'en'
        ? 'Cost fields are hidden again.'
        : '成本信息已重新隐藏，后端接口将不再返回成本字段。',
  })
  await loadPageData(pagination.value.page)
}

async function loadPageData(page = pagination.value.page) {
  loading.value = true

  try {
    const [productResponse, categoryResponse] = await Promise.all([
      api.get('/products', {
        params: {
          search: searchKeyword.value,
          categoryId: filters.categoryId || undefined,
          status: filters.status,
          hasBarcode: filters.hasBarcode,
          pricingChannel: pricingChannel.value || undefined,
          page,
          pageSize: pagination.value.pageSize,
        },
      }),
      api.get('/categories', {
        params: {
          all: true,
        },
      }),
    ])

    products.value = productResponse.data.items
    pagination.value = productResponse.data.pagination
    categories.value = categoryResponse.data.items
    selectedProductIds.value = selectedProductIds.value.filter((id) =>
      products.value.some((product) => product.id === id),
    )
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load products.'
  } finally {
    loading.value = false
  }
}

async function editProduct(productId) {
  try {
    const { data } = await api.get(`/products/${productId}`, {
      params: {
        pricingChannel: pricingChannel.value || undefined,
      },
    })
    const pricingRules = data.pricingRules?.length
      ? data.pricingRules.map((rule, index) => ({
          ruleName: rule.rule_name,
          channelKey: rule.channel_key || String(rule.rule_name || '').toLowerCase(),
          markupPercentage: Number(rule.markup_percentage || 0),
          suggestedPrice: Number(rule.suggested_price || 0),
          isDefault: rule.is_default,
          sortOrder: Number(rule.sort_order ?? index),
        }))
      : buildDefaultPricingRules(Number(data.product.cost_price || 0))

    Object.assign(form, {
      id: data.product.id,
      name: data.product.name,
      sku: data.product.sku,
      skuType: data.product.sku_type || 'SINGLE',
      productCode: data.product.product_code || '',
      barcode: data.product.barcode || '',
      images: (data.images || []).map((image, index) => ({
        imageData: image.image_data,
        isPrimary: image.is_primary || index === 0,
        sortOrder: Number(image.sort_order ?? index),
      })),
      description: data.product.description || '',
      usageGuide: data.product.usage_guide || '',
      pros: data.product.pros || '',
      cons: data.product.cons || '',
      bundleItems: (data.product.bundle_items || []).map((item) => ({
        itemProductId: item.item_product_id,
        itemQuantity: Number(item.item_quantity || 1),
      })),
      categoryId: data.product.category_id || '',
      unit: data.product.unit,
      costPrice: Number(data.product.cost_price || 0),
      sellingPrice: Number(data.product.selling_price || 0),
      markupPercentage: Number(data.product.markup_percentage || 0),
      suggestedPrice: Number(data.product.suggested_price || data.product.selling_price || 0),
      pricingRules,
      reorderLevel: data.product.reorder_level,
      isActive: data.product.is_active,
    })
    recalculatePricingRules()
    updateQrPreview(data.product.product_code || '')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load product for edit.'
  }
}

function goToProductForm(productId = null) {
  if (productId) {
    router.push({ name: 'product-form', query: { id: String(productId) } })
    return
  }
  router.push({ name: 'product-form' })
}

function resetForm() {
  Object.assign(form, {
    id: null,
    name: '',
    sku: '',
    skuType: 'SINGLE',
    productCode: '',
    barcode: '',
    images: [],
    bundleItems: [],
    description: '',
    usageGuide: '',
    pros: '',
    cons: '',
    categoryId: '',
    unit: 'pcs',
    costPrice: 0,
    sellingPrice: 0,
    markupPercentage: 30,
    suggestedPrice: 0,
    pricingRules: buildDefaultPricingRules(0),
    reorderLevel: 0,
    isActive: true,
  })
  qrPreview.value = ''
}

async function saveProduct() {
  try {
    const isEditing = Boolean(form.id)
    const payload = {
      ...form,
      imageData: form.images[0]?.imageData || null,
      images: form.images,
      skuType: form.skuType,
      bundleItems: form.bundleItems,
      pricingRules: form.pricingRules,
      productCode: form.productCode || undefined,
    }

    if (form.id) {
      await api.put(`/products/${form.id}`, payload)
    } else {
      await api.post('/products', payload)
    }

    await loadPageData(1)
    toastStore.pushToast({
      tone: 'success',
      message:
        localeStore.locale === 'en'
          ? isEditing
            ? 'Product updated.'
            : 'Product created.'
          : isEditing
            ? '商品已更新。'
            : '商品已创建。',
    })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to save product.'
  }
}

async function deleteProduct(id) {
  try {
    await api.delete(`/products/${id}`)
    await loadPageData()
    toastStore.pushToast({
      tone: 'success',
      message: localeStore.locale === 'en' ? 'Product deleted.' : '商品已删除。',
    })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to delete product.'
  }
}

function handleBarcodeDetected(barcode) {
  if (String(barcode).toUpperCase().startsWith('PRD-')) {
    form.productCode = barcode
  } else {
    form.barcode = barcode
  }
  searchKeyword.value = barcode
  loadPageData(1)
}

function generateProductCode() {
  form.productCode = generateLocalProductCode()
}

async function handleImageChange(event) {
  const files = Array.from(event.target.files || [])

  if (!files.length) {
    return
  }

  imageProcessing.value = true

  try {
    const processedImages = await Promise.all(files.map((file) => processProductImage(file)))
    const nextImages = [
      ...form.images,
      ...processedImages.map((imageData, index) => ({
        imageData,
        isPrimary: form.images.length === 0 && index === 0,
        sortOrder: form.images.length + index,
      })),
    ]

    form.images = nextImages.map((image, index) => ({
      ...image,
      isPrimary: image.isPrimary || index === 0,
      sortOrder: index,
    }))

    toastStore.pushToast({
      tone: 'success',
      message:
        localeStore.locale === 'en'
          ? `Added ${processedImages.length} product images with auto crop/compress.`
          : `已加入 ${processedImages.length} 张商品图片，并自动裁剪压缩。`,
    })
  } catch {
    errorMessage.value = 'Failed to process product images.'
  } finally {
    imageProcessing.value = false
    event.target.value = ''
  }
}

function removeImage(index) {
  form.images = form.images.filter((_, itemIndex) => itemIndex !== index)

  if (form.images.length > 0 && !form.images.some((image) => image.isPrimary)) {
    form.images[0].isPrimary = true
  }

  form.images = form.images.map((image, itemIndex) => ({
    ...image,
    sortOrder: itemIndex,
    isPrimary: image.isPrimary || itemIndex === 0,
  }))
}

function addBundleItem() {
  form.bundleItems = [
    ...form.bundleItems,
    {
      itemProductId: '',
      itemQuantity: 1,
    },
  ]
}

function removeBundleItem(index) {
  form.bundleItems = form.bundleItems.filter((_, itemIndex) => itemIndex !== index)
}

function setPrimaryImage(index) {
  form.images = form.images.map((image, itemIndex) => ({
    ...image,
    isPrimary: itemIndex === index,
  }))
}

function startDragImage(index) {
  dragImageIndex.value = index
}

function dropImage(targetIndex) {
  if (dragImageIndex.value < 0 || dragImageIndex.value === targetIndex) {
    dragImageIndex.value = -1
    return
  }

  const nextImages = [...form.images]
  const [moved] = nextImages.splice(dragImageIndex.value, 1)
  nextImages.splice(targetIndex, 0, moved)

  form.images = nextImages.map((image, index) => ({
    ...image,
    sortOrder: index,
  }))

  dragImageIndex.value = -1
}

async function downloadQrCode() {
  if (!form.productCode) {
    return
  }

  const dataUrl = await buildProductQrDataUrl(form.productCode)
  downloadDataUrl(`${form.productCode}.png`, dataUrl)
}

async function printLabel() {
  if (!form.productCode) {
    return
  }

  const dataUrl = await buildProductQrDataUrl(form.productCode)
  printProductLabel(
    {
      name: form.name,
      sku: form.sku,
      productCode: form.productCode,
      barcode: form.barcode,
      description: form.description,
    },
    dataUrl,
  )
}

function isSelected(productId) {
  return selectedProductIds.value.includes(productId)
}

function toggleSelected(productId) {
  if (isSelected(productId)) {
    selectedProductIds.value = selectedProductIds.value.filter((id) => id !== productId)
    return
  }

  selectedProductIds.value = [...selectedProductIds.value, productId]
}

function toggleSelectAllCurrentPage() {
  const currentIds = products.value.map((product) => product.id)
  const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedProductIds.value.includes(id))

  if (allSelected) {
    selectedProductIds.value = selectedProductIds.value.filter((id) => !currentIds.includes(id))
    return
  }

  selectedProductIds.value = Array.from(new Set([...selectedProductIds.value, ...currentIds]))
}

async function batchPrintSelected() {
  const selectedProducts = products.value.filter((product) => selectedProductIds.value.includes(product.id))

  if (!selectedProducts.length) {
    return
  }

  const labelItems = await Promise.all(
    selectedProducts.map(async (product) => ({
      name: product.name,
      sku: product.sku,
      productCode: product.product_code,
      barcode: product.barcode,
      qrDataUrl: await buildProductQrDataUrl(product.product_code),
    })),
  )

  printMultipleProductLabels(labelItems)
}

async function batchDownloadSelectedPng() {
  const selectedProducts = products.value.filter((product) => selectedProductIds.value.includes(product.id))

  if (!selectedProducts.length) {
    return
  }

  for (const product of selectedProducts) {
    const qrDataUrl = await buildProductQrDataUrl(product.product_code)
    downloadDataUrl(`${product.product_code}.png`, qrDataUrl)
  }
}

async function batchDownloadSelectedPdf() {
  const selectedProducts = products.value.filter((product) => selectedProductIds.value.includes(product.id))

  if (!selectedProducts.length) {
    return
  }

  const labelItems = await Promise.all(
    selectedProducts.map(async (product) => ({
      name: product.name,
      sku: product.sku,
      productCode: product.product_code,
      barcode: product.barcode,
      qrDataUrl: await buildProductQrDataUrl(product.product_code),
    })),
  )

  await exportQrLabelsToPdf(`product-labels-${Date.now()}.pdf`, labelItems)
}

function handleSearch() {
  loadPageData(1)
}

function resetFilters() {
  Object.assign(filters, {
    categoryId: '',
    status: 'all',
    hasBarcode: 'all',
  })
  searchKeyword.value = ''
  selectedProductIds.value = []
  loadPageData(1)
}

onMounted(() => {
  recalculatePricingRules()
  loadPageData()
})

watch(pricingChannel, (value) => {
  localStorage.setItem('inventory_pricing_channel', value)
  loadPageData(1)
})

watch(
  () => form.productCode,
  (value) => {
    updateQrPreview(value)
  },
)

watch(
  () => form.costPrice,
  () => {
    recalculatePricingRules()
  },
)
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">
            {{ localeStore.locale === 'en' ? 'Catalog' : '商品目录' }}
          </p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Product list' : '商品列表' }}
          </h2>
          <p class="mt-2 text-sm text-slate-500">
            {{
              localeStore.locale === 'en'
                ? 'Manage product info and open product detail pages.'
                : '集中管理商品资料，并可打开单独的 product page 查看详情。'
            }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          @click="goToProductForm()"
        >
          {{ localeStore.locale === 'en' ? 'Add Product Page' : '新增商品页面' }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p class="text-sm font-semibold text-slate-900">{{ localeStore.locale === 'en' ? 'Cost Protection' : '成本保护' }}</p>
          <p class="mt-1 text-xs text-slate-500">
            {{
              localeStore.locale === 'en'
                ? 'Cost fields are masked as ******. Enter your current password to unlock in this session.'
                : '成本会以 ****** 隐藏，输入当前登录密码后才会在本次会话中显示。'
            }}
          </p>
        </div>
        <div v-if="!costAccessStore.isUnlocked" class="flex flex-wrap items-center gap-3">
          <input
            v-model="costPasscode"
            type="password"
            :placeholder="localeStore.locale === 'en' ? 'Enter passcode' : '输入 passcode'"
            class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="button"
            class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            :disabled="costAccessStore.loading"
            @click="unlockCost"
          >
            {{ costAccessStore.loading ? (localeStore.locale === 'en' ? 'Verifying...' : '验证中...') : (localeStore.locale === 'en' ? 'Unlock cost' : '查看成本') }}
          </button>
        </div>
        <button
          v-else
          type="button"
          class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          @click="lockCost"
        >
          {{ localeStore.locale === 'en' ? 'Hide cost again' : '重新隐藏成本' }}
        </button>
      </div>

      <div class="mt-3 rounded-3xl border border-slate-200 bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-900">{{ localeStore.locale === 'en' ? 'C-code calculator' : '成本编码计算器' }}</p>
            <p class="mt-1 text-xs text-slate-500">
              {{ localeStore.locale === 'en' ? 'Convert amount (块) to code like EHSTX / IHRTX.' : '把金额（块）转换为 EHSTX / IHRTX 这类编码。' }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <input
              v-model="costCalculatorInput"
              type="number"
              min="0"
              step="1"
              :placeholder="localeStore.locale === 'en' ? 'Enter amount' : '输入金额'"
              class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
            />
            <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
              {{ calculatedCostCode() }}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <div class="rounded-3xl border border-slate-200 p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-xl font-semibold text-slate-900">Product list</h3>
              <p class="mt-1 text-sm text-slate-500">
                {{
                  localeStore.locale === 'en'
                    ? 'Use the tools panel to filter and batch print labels.'
                    : '使用右侧工具面板进行筛选与批量打印标签。'
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-3">
              <select
                v-model="pricingChannel"
                class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
              >
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="vip">VIP</option>
              </select>
              <input
                v-model="searchKeyword"
                type="text"
                :placeholder="localeStore.locale === 'en' ? 'Search products / code / barcode / QR' : '搜索商品 / 编码 / 条码 / 二维码'"
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500 md:w-80"
                @input="handleSearch"
              />
              <button
                type="button"
                class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                :disabled="selectedProductIds.length === 0"
                @click="batchDownloadSelectedPng"
              >
                {{ localeStore.locale === 'en' ? 'Batch Download PNG' : '批量下载 PNG' }}
              </button>
              <button
                type="button"
                class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                :disabled="selectedProductIds.length === 0"
                @click="batchDownloadSelectedPdf"
              >
                {{ localeStore.locale === 'en' ? 'Batch Download PDF' : '批量下载 PDF' }}
              </button>
              <button
                type="button"
                class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="selectedProductIds.length === 0"
                @click="batchPrintSelected"
              >
                {{ localeStore.locale === 'en' ? 'Batch Print QR Labels' : '批量打印二维码标签' }}
              </button>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <button type="button" class="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700" @click="toggleSelectAllCurrentPage">
              {{ localeStore.locale === 'en' ? 'Select Current Page' : '当前页全选' }}
            </button>
            <span>{{ localeStore.locale === 'en' ? `Selected ${selectedProductIds.length} products` : `已选 ${selectedProductIds.length} 个商品` }}</span>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-4">
            <select
              v-model="filters.categoryId"
              class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              @change="handleSearch"
            >
              <option value="">{{ localeStore.locale === 'en' ? 'All categories' : '全部分类' }}</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
            <select
              v-model="filters.status"
              class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              @change="handleSearch"
            >
              <option value="all">{{ localeStore.locale === 'en' ? 'All status' : '全部状态' }}</option>
              <option value="active">{{ localeStore.locale === 'en' ? 'Active only' : '仅启用' }}</option>
              <option value="inactive">{{ localeStore.locale === 'en' ? 'Inactive only' : '仅停用' }}</option>
            </select>
            <select
              v-model="filters.hasBarcode"
              class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              @change="handleSearch"
            >
              <option value="all">{{ localeStore.locale === 'en' ? 'All barcode status' : '全部条码状态' }}</option>
              <option value="yes">{{ localeStore.locale === 'en' ? 'Has barcode only' : '仅有条码' }}</option>
              <option value="no">{{ localeStore.locale === 'en' ? 'No barcode only' : '仅无条码' }}</option>
            </select>
            <button
              type="button"
              class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              @click="resetFilters"
            >
              {{ localeStore.locale === 'en' ? 'Reset Filters' : '重置筛选' }}
            </button>
          </div>

          <div class="mt-4">
            <BarcodeScanner @detected="handleBarcodeDetected" />
          </div>

          <div v-if="loading" class="mt-5 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
            {{ localeStore.locale === 'en' ? 'Loading...' : '加载中...' }}
          </div>

          <div class="mt-5 grid gap-3 md:hidden">
            <article
              v-for="product in products"
              :key="product.id"
              class="rounded-3xl border border-slate-200 p-4"
            >
              <div class="mb-3 flex items-center justify-between gap-3">
                <label class="flex items-center gap-2 text-xs text-slate-500">
                  <input :checked="isSelected(product.id)" type="checkbox" class="size-4 rounded border-slate-300" @change="toggleSelected(product.id)" />
                  {{ localeStore.locale === 'en' ? 'Select for Print' : '选择打印' }}
                </label>
                <span class="text-xs text-slate-400">{{ product.images?.length || 0 }} images</span>
              </div>
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                  <img
                    v-if="getProductImage(product)"
                    :src="getProductImage(product)"
                    alt="Product"
                    class="h-14 w-14 rounded-2xl object-cover"
                  />
                  <div v-else class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-400">
                    IMG
                  </div>
                  <div>
                    <p class="font-medium text-slate-900">{{ product.name }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ product.sku }} · {{ product.barcode || 'No barcode' }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ product.product_code || 'No product code' }}</p>
                  </div>
                </div>
                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  :class="
                    product.is_active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-600'
                  "
                >
                  {{ product.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <p class="mt-3 text-sm text-slate-500">Category: {{ product.category_name || '—' }}</p>
              <p class="mt-1 text-sm text-slate-500">Cost {{ displayCost(product.cost_price) }}</p>
              <p class="mt-1 text-sm text-slate-500">C-code {{ displayCostCodeFromProduct(product) }}</p>
              <p class="mt-1 text-sm text-slate-500">
                Suggested {{ formatCurrency(getSuggestedPrice(product)) }} · Selling {{ formatCurrency(product.selling_price) }}
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <RouterLink
                  :to="{ name: 'product-detail', params: { id: product.id } }"
                  class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Open
                </RouterLink>
                <button
                  v-if="canEditProducts"
                  class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  @click="goToProductForm(product.id)"
                >
                  Edit
                </button>
                <button
                  v-if="canDeleteProducts"
                  class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                  @click="deleteProduct(product.id)"
                >
                  Delete
                </button>
              </div>
            </article>
          </div>

          <div class="mt-5 hidden overflow-x-auto md:block">
            <table class="min-w-full text-left text-sm">
              <thead class="text-slate-500">
                <tr class="border-b border-slate-200">
                  <th class="px-3 py-3">{{ localeStore.t('table.select') }}</th>
                  <th class="px-3 py-3">{{ localeStore.t('table.product') }}</th>
                  <th class="px-3 py-3">{{ localeStore.t('table.code') }}</th>
                  <th class="px-3 py-3">{{ localeStore.t('table.category') }}</th>
                  <th class="px-3 py-3">{{ localeStore.t('table.pricing') }}</th>
                  <th class="px-3 py-3">{{ localeStore.t('table.status') }}</th>
                  <th class="px-3 py-3">{{ localeStore.t('table.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="product in products" :key="product.id" class="border-b border-slate-100">
                  <td class="px-3 py-3">
                    <input :checked="isSelected(product.id)" type="checkbox" class="size-4 rounded border-slate-300" @change="toggleSelected(product.id)" />
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex items-center gap-3">
                      <img
                        v-if="getProductImage(product)"
                        :src="getProductImage(product)"
                        alt="Product"
                        class="h-12 w-12 rounded-2xl object-cover"
                      />
                      <div v-else class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-400">
                        IMG
                      </div>
                      <div>
                        <p class="font-medium text-slate-900">{{ product.name }}</p>
                        <p class="text-xs text-slate-500">{{ product.sku }} · {{ product.barcode || 'No barcode' }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3">
                    <p class="font-medium text-slate-900">{{ product.product_code || '—' }}</p>
                  </td>
                  <td class="px-3 py-3">{{ product.category_name || '—' }}</td>
                  <td class="px-3 py-3">
                    <p>Cost: {{ displayCost(product.cost_price) }}</p>
                    <p>C-code: {{ displayCostCodeFromProduct(product) }}</p>
                    <p>Suggested: {{ formatCurrency(getSuggestedPrice(product)) }}</p>
                    <p>Selling: {{ formatCurrency(product.selling_price) }}</p>
                  </td>
                  <td class="px-3 py-3">
                    <span
                      class="rounded-full px-3 py-1 text-xs font-semibold"
                      :class="
                        product.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      "
                    >
                      {{ product.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      <RouterLink
                        :to="{ name: 'product-detail', params: { id: product.id } }"
                        class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        Open
                      </RouterLink>
                      <button
                        v-if="canEditProducts"
                        class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                        @click="goToProductForm(product.id)"
                      >
                        Edit
                      </button>
                      <button
                        v-if="canDeleteProducts"
                        class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                        @click="deleteProduct(product.id)"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar :pagination="pagination" @change="loadPageData" />
        </div>
      </div>
    </section>
  </AppLayout>
</template>
