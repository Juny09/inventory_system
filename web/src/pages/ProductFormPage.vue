<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import HelpHint from '../components/HelpHint.vue'
import { useLocaleStore } from '../stores/locale'
import { useToastStore } from '../stores/toast'
import { useCostAccessStore } from '../stores/costAccess'
import { buildDefaultPricingRules, generateLocalProductCode, processProductImage } from '../utils/productHelpers'
import { encodeCostToCode } from '../utils/costCode'

const route = useRoute()
const router = useRouter()
const localeStore = useLocaleStore()
const toastStore = useToastStore()
const costAccessStore = useCostAccessStore()
const categories = ref([])
const products = ref([])
const suppliers = ref([])
const errorMessage = ref('')
const loading = ref(false)
const imageProcessing = ref(false)
const costPasscode = ref('')
const initialCostPrice = ref(null)
const costChangeReason = ref('')
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
  primarySupplierId: '',
})

const qrPreview = ref('')

function toNumber(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toOptionalNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function recalculateSuggested() {
  const cost = toOptionalNumber(form.costPrice)
  if (cost === null) {
    return
  }
  const markup = toNumber(form.markupPercentage)
  form.suggestedPrice = Number((cost * (1 + markup / 100)).toFixed(2))
}

async function loadSelectors() {
  const [categoryResponse, productResponse] = await Promise.all([
    api.get('/categories', { params: { all: true } }),
    api.get('/products', { params: { all: true, status: 'all' } }),
  ])
  categories.value = categoryResponse.data.items
  products.value = productResponse.data.items

  const supplierResponse = await api.get('/suppliers', {
    params: { status: 'active', page: 1, pageSize: 200 },
  })
  suppliers.value = supplierResponse.data.items
}

async function loadProductById(id) {
  const { data } = await api.get(`/products/${id}`)
  initialCostPrice.value = data.product.cost_price === null ? null : toNumber(data.product.cost_price)
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
    bundleItems: (data.product.bundle_items || []).map((item) => ({
      itemProductId: item.item_product_id,
      itemQuantity: Number(item.item_quantity || 1),
    })),
    description: data.product.description || '',
    usageGuide: data.product.usage_guide || '',
    pros: data.product.pros || '',
    cons: data.product.cons || '',
    categoryId: data.product.category_id || '',
    unit: data.product.unit || 'pcs',
    costPrice: data.product.cost_price === null ? null : toNumber(data.product.cost_price),
    sellingPrice: toNumber(data.product.selling_price),
    markupPercentage: toNumber(data.product.markup_percentage || 30),
    suggestedPrice: toNumber(data.product.suggested_price),
    pricingRules: data.pricingRules?.length ? data.pricingRules : buildDefaultPricingRules(toNumber(data.product.cost_price)),
    reorderLevel: toNumber(data.product.reorder_level),
    isActive: Boolean(data.product.is_active),
    primarySupplierId: data.supplier?.id ? String(data.supplier.id) : '',
  })
  if (costAccessStore.isUnlocked || data.product.cost_price !== null) {
    recalculateSuggested()
  }
}

async function saveProduct() {
  loading.value = true
  errorMessage.value = ''
  try {
    const oldCost = initialCostPrice.value === null ? null : toNumber(initialCostPrice.value)
    const newCost = toNumber(form.costPrice)
    const costChanged = form.id && oldCost !== null && oldCost !== newCost
    if (costChanged && !String(costChangeReason.value || '').trim()) {
      errorMessage.value = localeStore.locale === 'en' ? 'Cost change reason is required.' : '修改成本时必须填写原因。'
      return
    }

    const payload = {
      ...form,
      imageData: form.images[0]?.imageData || null,
      images: form.images,
      pricingRules: form.pricingRules,
      productCode: form.productCode || undefined,
      primarySupplierId: form.primarySupplierId || null,
      costChangeReason: costChanged ? String(costChangeReason.value || '').trim() : undefined,
    }

    if (form.id) {
      if (!costAccessStore.isUnlocked) {
        delete payload.costPrice
      }
      await api.put(`/products/${form.id}`, payload)
      toastStore.pushToast({ tone: 'success', message: localeStore.locale === 'en' ? 'Product updated.' : '商品已更新。' })
    } else {
      await api.post('/products', payload)
      toastStore.pushToast({ tone: 'success', message: localeStore.locale === 'en' ? 'Product created.' : '商品已创建。' })
    }
    router.push({ name: 'products' })
  } catch (error) {
    if (Number(error.response?.status) === 403) {
      errorMessage.value =
        localeStore.locale === 'en'
          ? 'Permission denied. Please login as Admin/Manager, or unlock cost if you are changing cost price.'
          : '没有权限。请用管理员/经理账号登录；如果你在修改成本价，需要先解锁成本。'
    } else {
      errorMessage.value = error.response?.data?.message || 'Failed to save product.'
    }
  } finally {
    loading.value = false
  }
}

async function unlockCost() {
  errorMessage.value = ''
  try {
    const ok = await costAccessStore.unlock(costPasscode.value)
    if (!ok) {
      errorMessage.value = localeStore.locale === 'en' ? 'Invalid passcode.' : 'passcode 不正确。'
      return
    }
    costPasscode.value = ''
    if (form.id) {
      await loadProductById(form.id)
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || (localeStore.locale === 'en' ? 'Failed to unlock cost.' : '解锁成本失败。')
  }
}

function cancel() {
  router.push({ name: 'products' })
}

function generateProductCode() {
  form.productCode = generateLocalProductCode()
}

function addBundleItem() {
  form.bundleItems = [...form.bundleItems, { itemProductId: '', itemQuantity: 1 }]
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

function removeImage(index) {
  form.images = form.images
    .filter((_, itemIndex) => itemIndex !== index)
    .map((image, itemIndex) => ({
      ...image,
      isPrimary: itemIndex === 0 ? true : image.isPrimary,
      sortOrder: itemIndex,
    }))
}

async function handleImageChange(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) {
    return
  }
  imageProcessing.value = true
  try {
    const processedImages = await Promise.all(files.map((file) => processProductImage(file)))
    form.images = [
      ...form.images,
      ...processedImages.map((imageData, index) => ({
        imageData,
        isPrimary: form.images.length === 0 && index === 0,
        sortOrder: form.images.length + index,
      })),
    ]
  } catch (error) {
    errorMessage.value = error.message || 'Failed to process image.'
  } finally {
    imageProcessing.value = false
  }
}

onMounted(async () => {
  await loadSelectors()
  const id = route.query.id ? Number(route.query.id) : null
  if (id) {
    await loadProductById(id)
  } else {
    recalculateSuggested()
  }
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">{{ localeStore.locale === 'en' ? 'Catalog' : '商品目录' }}</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">
            {{ form.id ? (localeStore.locale === 'en' ? 'Edit product' : '编辑商品') : (localeStore.locale === 'en' ? 'Add product' : '新增商品') }}
          </h2>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          @click="cancel"
        >
          {{ localeStore.locale === 'en' ? 'Back to Product List' : '返回商品列表' }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="form.id" class="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
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
              class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
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
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            @click="costAccessStore.lock()"
          >
            {{ localeStore.locale === 'en' ? 'Hide cost again' : '重新隐藏成本' }}
          </button>
        </div>
      </div>

      <form class="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5" @submit.prevent="saveProduct">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="relative sm:col-span-2">
            <input v-model="form.name" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ localeStore.locale === 'en' ? 'Product name' : '商品名称' }}
            </label>
          </div>
          <div class="relative">
            <input v-model="form.sku" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              SKU
            </label>
          </div>
          <select v-model="form.skuType" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
            <option value="SINGLE">{{ localeStore.t('products.skuTypeSingle') }}</option>
            <option value="COMBO">{{ localeStore.t('products.skuTypeCombo') }}</option>
          </select>
          <div class="flex gap-2 sm:col-span-2">
            <div class="relative w-full">
              <input v-model="form.productCode" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
              <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
                {{ localeStore.locale === 'en' ? 'Product code' : '商品编码' }}
              </label>
            </div>
            <button type="button" class="shrink-0 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" @click="generateProductCode">
              Generate
            </button>
          </div>
          <div class="relative sm:col-span-2">
            <input v-model="form.barcode" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ localeStore.locale === 'en' ? 'Barcode' : '条码' }}
            </label>
          </div>
          <label class="sm:col-span-2 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600">
            <input type="file" accept="image/*" multiple class="hidden" @change="handleImageChange" />
            {{ imageProcessing ? (localeStore.locale === 'en' ? 'Processing...' : '处理中...') : 'Add product photos' }}
          </label>
          <select v-model="form.categoryId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
            <option value="">Select category</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <select v-model="form.primarySupplierId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
            <option value="">{{ localeStore.locale === 'en' ? 'Select supplier (optional)' : '选择供应商（可选）' }}</option>
            <option v-for="item in suppliers" :key="item.id" :value="String(item.id)">
              {{ item.name }}
            </option>
          </select>
          <div class="relative">
            <input v-model="form.unit" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ localeStore.locale === 'en' ? 'Unit' : '单位' }}
            </label>
          </div>
          <div class="relative">
            <input
              v-model="form.costPrice"
              :type="form.id ? (costAccessStore.isUnlocked ? 'number' : 'password') : 'number'"
              min="0"
              step="0.01"
              placeholder=" "
              class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500 disabled:bg-slate-100"
              :disabled="form.id && !costAccessStore.isUnlocked"
              @input="recalculateSuggested"
            />
            <label class="pointer-events-none absolute left-4 top-3 flex items-center gap-2 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ localeStore.locale === 'en' ? 'Cost price' : '成本价' }}
              <HelpHint :text="localeStore.locale === 'en' ? 'Your purchase cost (number).' : '进货成本（数字）。'" />
            </label>
          </div>
          <div class="relative">
            <input
              :value="encodeCostToCode(form.costPrice) || ''"
              type="text"
              readonly
              placeholder=" "
              class="peer w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 pb-2 pt-5 outline-none"
            />
            <label class="pointer-events-none absolute left-4 top-3 flex items-center gap-2 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400">
              {{ localeStore.locale === 'en' ? 'C-code' : '成本编码' }}
              <HelpHint :text="localeStore.locale === 'en' ? 'Auto-generated code from cost price.' : '由成本价自动生成的编码。'" />
            </label>
          </div>
          <div class="relative">
            <input v-model="form.sellingPrice" type="number" min="0" step="0.01" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ localeStore.locale === 'en' ? 'Selling price' : '售价' }}
            </label>
          </div>
          <div class="relative">
            <input v-model="form.markupPercentage" type="number" min="0" step="0.01" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" @input="recalculateSuggested" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ localeStore.locale === 'en' ? 'Markup %' : '加价率 %' }}
            </label>
          </div>
          <div class="relative">
            <input :value="form.suggestedPrice" type="number" readonly placeholder=" " class="peer w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 pb-2 pt-5 outline-none" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400">
              {{ localeStore.locale === 'en' ? 'Suggested price' : '建议价' }}
            </label>
          </div>
          <textarea
            v-if="form.id && initialCostPrice !== null && Number(form.costPrice) !== Number(initialCostPrice)"
            v-model="costChangeReason"
            rows="2"
            :placeholder="localeStore.locale === 'en' ? 'Reason for cost change (required)' : '修改成本原因（必填）'"
            class="sm:col-span-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          />
          <div class="relative">
            <input v-model="form.reorderLevel" type="number" min="0" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ localeStore.locale === 'en' ? 'Reorder level' : '补货线' }}
            </label>
          </div>
          <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <input v-model="form.isActive" type="checkbox" class="size-4 rounded border-slate-300" />
            Product is active
          </label>
          <div v-if="form.skuType === 'COMBO'" class="sm:col-span-2 rounded-3xl border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-slate-900">Bundle components</p>
              <button type="button" class="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="addBundleItem">
                + Add item
              </button>
            </div>
            <div class="mt-4 space-y-3">
              <div v-for="(bundleItem, index) in form.bundleItems" :key="`bundle-${index}`" class="grid gap-3 sm:grid-cols-[1fr_140px_90px]">
                <select v-model="bundleItem.itemProductId" class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                  <option value="">Select item SKU</option>
                  <option v-for="product in products.filter((item) => item.id !== form.id)" :key="`bundle-opt-${product.id}`" :value="product.id">
                    {{ product.name }} · {{ product.sku }}
                  </option>
                </select>
                <input v-model="bundleItem.itemQuantity" type="number" min="0.001" step="0.001" class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
                <button type="button" class="rounded-2xl border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-600" @click="removeBundleItem(index)">
                  Delete
                </button>
              </div>
            </div>
          </div>
          <textarea v-model="form.description" rows="3" placeholder="Product description" class="sm:col-span-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
          <textarea v-model="form.usageGuide" rows="3" placeholder="Usage guide" class="sm:col-span-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
          <textarea v-model="form.pros" rows="2" placeholder="Pros" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
          <textarea v-model="form.cons" rows="2" placeholder="Cons" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
          <div class="sm:col-span-2 rounded-3xl border border-slate-200 bg-white p-3">
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Gallery Preview</p>
            <div class="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2">
              <div v-for="(image, index) in form.images" :key="`${image.sortOrder}-${index}`" class="rounded-2xl border border-slate-200 bg-white p-3">
                <img :src="image.imageData" alt="Product gallery preview" class="h-28 w-full rounded-2xl object-cover" />
                <div class="mt-3 flex gap-2">
                  <button type="button" class="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold" :class="image.isPrimary ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'" @click="setPrimaryImage(index)">
                    {{ image.isPrimary ? 'Cover' : 'Set Cover' }}
                  </button>
                  <button type="button" class="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600" @click="removeImage(index)">
                    Remove
                  </button>
                </div>
              </div>
              <p v-if="form.images.length === 0" class="col-span-full text-center text-xs text-slate-400">Uploaded images will be auto-cropped and compressed</p>
            </div>
          </div>
          <div class="sm:col-span-2 rounded-3xl border border-slate-200 bg-white p-3">
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">QR Preview</p>
            <div class="mt-3 flex min-h-40 items-center justify-center rounded-2xl bg-slate-50 p-3">
              <img v-if="form.productCode" :src="`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(form.productCode)}`" alt="Product QR Code" class="h-36 w-36 rounded-xl object-contain" />
              <p v-else class="text-center text-xs text-slate-400">Generate or save product code to preview QR</p>
            </div>
          </div>
        </div>

        <div class="mt-4 flex gap-3">
          <button class="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" :disabled="loading">
            {{ loading ? (localeStore.locale === 'en' ? 'Saving...' : '保存中...') : (localeStore.locale === 'en' ? 'Save' : '保存') }}
          </button>
          <button type="button" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" @click="cancel">
            {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
          </button>
        </div>
      </form>

    </section>
  </AppLayout>
</template>
