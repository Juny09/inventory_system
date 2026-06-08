<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'

const authStore = useAuthStore()
const localeStore = useLocaleStore()
const route = useRoute()
const inventory = ref([])
const variants = ref([])
const warehouses = ref([])
const warehouseLocations = ref([])
const categories = ref([])
const suppliers = ref([])
const transactions = ref([])
const errorMessage = ref('')
const loading = ref(false)
const scannerPrefillMessage = ref('')
const scannerPrefillHandledKey = ref('')
const selectorsLoaded = ref(false)
const inventorySearch = ref('')
const transactionSearch = ref('')
const inventoryFilters = reactive({
  categoryId: '',
  warehouseId: '',
  lowStockOnly: false,
})
const transactionFilters = reactive({
  movementType: 'all',
})
const inventoryPagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})
const transactionPagination = ref({
  total: 0,
  page: 1,
  pageSize: 6,
  totalPages: 1,
})

const stockInForm = reactive({
  variantId: '',
  warehouseId: '',
  locationId: '',
  locationCode: '',
  locationName: '',
  zone: '',
  shelf: '',
  bin: '',
  level: '',
  supplierId: '',
  quantity: 1,
  unit: '',
  unitCost: '',
  referenceNo: '',
  purchaseReason: '',
  notes: '',
})

const stockOutForm = reactive({
  variantId: '',
  warehouseId: '',
  locationId: '',
  unit: '',
  quantity: 1,
  referenceNo: '',
  notes: '',
})

const transferForm = reactive({
  variantId: '',
  sourceWarehouseId: '',
  sourceLocationId: '',
  destinationWarehouseId: '',
  destinationLocationId: '',
  unit: '',
  quantity: 1,
  referenceNo: '',
  notes: '',
})

const allocationForm = reactive({
  variantId: '',
  warehouseId: '',
  unit: '',
  quantity: 1,
  mode: 'reserve',
  referenceNo: '',
  notes: '',
})

// Modal state for stock movement forms
const activeModal = ref('') // '' | 'stockIn' | 'stockOut' | 'transfer' | 'allocation'

function openModal(name) {
  activeModal.value = name
}

function closeModal() {
  activeModal.value = ''
}

async function loadSelectors() {
  const [variantResponse, warehouseResponse, locationResponse, categoryResponse, supplierResponse] = await Promise.all([
    api.get('/product-variants', {
      params: {
        all: true,
        status: 'active',
      },
    }),
    api.get('/warehouses', {
      params: {
        all: true,
        activeOnly: true,
      },
    }),
    api.get('/warehouse-locations', {
      params: {
        all: true,
        activeOnly: true,
      },
    }),
    api.get('/categories', {
      params: {
        all: true,
      },
    }),
    api.get('/suppliers', {
      params: {
        status: 'active',
        page: 1,
        pageSize: 200,
      },
    }),
  ])

  variants.value = variantResponse.data.items
  warehouses.value = warehouseResponse.data.items
  warehouseLocations.value = locationResponse.data.items
  categories.value = categoryResponse.data.items
  suppliers.value = supplierResponse.data.items
  selectorsLoaded.value = true
}

async function loadInventoryPage(
  inventoryPage = inventoryPagination.value.page,
  movementPage = transactionPagination.value.page,
) {
  loading.value = true

  try {
    const [inventoryResponse, transactionResponse] = await Promise.all([
      api.get('/inventory', {
        params: {
          search: inventorySearch.value,
          categoryId: inventoryFilters.categoryId || undefined,
          warehouseId: inventoryFilters.warehouseId || undefined,
          lowStockOnly: inventoryFilters.lowStockOnly || undefined,
          page: inventoryPage,
          pageSize: inventoryPagination.value.pageSize,
        },
      }),
      api.get('/inventory/transactions', {
        params: {
          search: transactionSearch.value,
          movementType: transactionFilters.movementType,
          page: movementPage,
          pageSize: transactionPagination.value.pageSize,
        },
      }),
    ])

    inventory.value = inventoryResponse.data.items
    inventoryPagination.value = inventoryResponse.data.pagination
    transactions.value = transactionResponse.data.items
    transactionPagination.value = transactionResponse.data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load inventory.'
  } finally {
    loading.value = false
  }
}

function resetForms() {
  Object.assign(stockInForm, {
    variantId: '',
    warehouseId: '',
    locationId: '',
    locationCode: '',
    locationName: '',
    zone: '',
    shelf: '',
    bin: '',
    level: '',
    supplierId: '',
    quantity: 1,
    unit: '',
    unitCost: '',
    referenceNo: '',
    purchaseReason: '',
    notes: '',
  })
  Object.assign(stockOutForm, {
    variantId: '',
    warehouseId: '',
    locationId: '',
    unit: '',
    quantity: 1,
    referenceNo: '',
    notes: '',
  })
  Object.assign(transferForm, {
    variantId: '',
    sourceWarehouseId: '',
    sourceLocationId: '',
    destinationWarehouseId: '',
    destinationLocationId: '',
    quantity: 1,
    referenceNo: '',
    notes: '',
  })
  Object.assign(allocationForm, {
    variantId: '',
    warehouseId: '',
    quantity: 1,
    mode: 'reserve',
    referenceNo: '',
    notes: '',
  })
}

function findVariantById(variantId) {
  const targetId = Number(variantId)
  if (!targetId) return null
  return variants.value.find((item) => Number(item.id) === targetId) || null
}

function findLocationById(locationId) {
  const targetId = Number(locationId)
  if (!targetId) return null
  return warehouseLocations.value.find((item) => Number(item.id) === targetId) || null
}

function filterLocationsByWarehouseId(warehouseId) {
  const targetWarehouseId = Number(warehouseId)
  if (!targetWarehouseId) return []
  return warehouseLocations.value.filter((item) => Number(item.warehouse_id) === targetWarehouseId)
}

function formatLocationOption(location) {
  const parts = [
    location?.location_code,
    location?.location_name,
    location?.shelf ? `Shelf ${location.shelf}` : '',
    location?.bin ? `Bin ${location.bin}` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

const stockInWarehouseLocations = computed(() => filterLocationsByWarehouseId(stockInForm.warehouseId))
const stockOutWarehouseLocations = computed(() => filterLocationsByWarehouseId(stockOutForm.warehouseId))
const transferSourceLocations = computed(() => filterLocationsByWarehouseId(transferForm.sourceWarehouseId))
const transferDestinationLocations = computed(() => filterLocationsByWarehouseId(transferForm.destinationWarehouseId))

function applyStockInLocationDetails(locationId) {
  const location = findLocationById(locationId)
  if (!location) return

  Object.assign(stockInForm, {
    locationId: String(location.id),
    locationCode: location.location_code || '',
    locationName: location.location_name || '',
    zone: location.zone || '',
    shelf: location.shelf || '',
    bin: location.bin || '',
    level: location.level || '',
  })
}

function buildScannerPrefillKey() {
  return [
    route.query.action || '',
    route.query.variantId || '',
    route.query.warehouseId || '',
    route.query.locationId || '',
    route.query.scannedCode || '',
    route.query.prefillToken || '',
  ].join('|')
}

function applyScannerPrefill() {
  if (!selectorsLoaded.value) return

  const action = String(route.query.action || '')
  if (action !== 'stockIn' && action !== 'stockOut') {
    scannerPrefillMessage.value = ''
    return
  }

  const prefillKey = buildScannerPrefillKey()
  if (!prefillKey || prefillKey === scannerPrefillHandledKey.value) return

  const variant = findVariantById(route.query.variantId)
  if (!variant) {
    scannerPrefillMessage.value = localeStore.locale === 'en'
      ? 'Scanned SKU was not found in inventory selector.'
      : '扫码带入的 SKU 在库存表单里找不到。'
    scannerPrefillHandledKey.value = prefillKey
    return
  }

  const warehouseId = String(route.query.warehouseId || '')
  const locationId = String(route.query.locationId || '')
  const locationCode = String(route.query.locationCode || '')
  const locationName = String(route.query.locationName || '')
  const zone = String(route.query.zone || '')
  const shelf = String(route.query.shelf || '')
  const bin = String(route.query.bin || '')
  const level = String(route.query.level || '')
  const scannedCode = String(route.query.scannedCode || '')

  if (scannedCode) {
    inventorySearch.value = scannedCode
    loadInventoryPage(1, transactionPagination.value.page)
  }

  if (action === 'stockIn') {
    Object.assign(stockInForm, {
      variantId: String(variant.id),
      warehouseId,
      locationId,
      locationCode,
      locationName,
      zone,
      shelf,
      bin,
      level,
      supplierId: '',
      quantity: 1,
      unit: variant.unit || '',
      unitCost: '',
      referenceNo: '',
      purchaseReason: '',
      notes: scannedCode ? `Scanned from mobile: ${scannedCode}` : '',
    })
  }

  if (action === 'stockOut') {
    Object.assign(stockOutForm, {
      variantId: String(variant.id),
      warehouseId,
      locationId,
      unit: variant.unit || '',
      quantity: 1,
      referenceNo: '',
      notes: scannedCode ? `Scanned from mobile: ${scannedCode}` : '',
    })
  }

  openModal(action)
  scannerPrefillMessage.value = localeStore.locale === 'en'
    ? `Scanned item ${variant.product_name} · ${variant.sku} has been loaded into the ${action === 'stockIn' ? 'stock in' : 'stock out'} form.`
    : `已把扫码商品 ${variant.product_name} · ${variant.sku} 带入${action === 'stockIn' ? '入库' : '出库'}表单。`
  scannerPrefillHandledKey.value = prefillKey
}

async function submitMovement(endpoint, payload) {
  try {
    await api.post(endpoint, payload)
    resetForms()
    closeModal()
    await loadInventoryPage(1, 1)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to create stock movement.'
  }
}

function handleInventorySearch() {
  loadInventoryPage(1, transactionPagination.value.page)
}

function handleTransactionSearch() {
  loadInventoryPage(inventoryPagination.value.page, 1)
}

function resetInventoryFilters() {
  Object.assign(inventoryFilters, {
    categoryId: '',
    warehouseId: '',
    lowStockOnly: false,
  })
  inventorySearch.value = ''
  loadInventoryPage(1, transactionPagination.value.page)
}

function resetTransactionFilters() {
  Object.assign(transactionFilters, {
    movementType: 'all',
  })
  transactionSearch.value = ''
  loadInventoryPage(inventoryPagination.value.page, 1)
}

function getUnitStep(unit) {
  const unitLower = String(unit || '').toLowerCase()
  if (unitLower.includes('kg') || unitLower.includes('gram') || unitLower.includes('g')) {
    return '0.001'
  }
  return '1'
}

function resetStockInLocationIfWarehouseChanged() {
  const matchedLocation = findLocationById(stockInForm.locationId)
  if (matchedLocation && Number(matchedLocation.warehouse_id) === Number(stockInForm.warehouseId)) {
    return
  }

  Object.assign(stockInForm, {
    locationId: '',
    locationCode: '',
    locationName: '',
    zone: '',
    shelf: '',
    bin: '',
    level: '',
  })
}

function resetStockOutLocationIfWarehouseChanged() {
  const matchedLocation = findLocationById(stockOutForm.locationId)
  if (matchedLocation && Number(matchedLocation.warehouse_id) === Number(stockOutForm.warehouseId)) {
    return
  }
  stockOutForm.locationId = ''
}

function resetTransferLocationIfWarehouseChanged(type) {
  if (type === 'source') {
    const matchedLocation = findLocationById(transferForm.sourceLocationId)
    if (matchedLocation && Number(matchedLocation.warehouse_id) === Number(transferForm.sourceWarehouseId)) {
      return
    }
    transferForm.sourceLocationId = ''
    return
  }

  const matchedLocation = findLocationById(transferForm.destinationLocationId)
  if (matchedLocation && Number(matchedLocation.warehouse_id) === Number(transferForm.destinationWarehouseId)) {
    return
  }
  transferForm.destinationLocationId = ''
}

onMounted(async () => {
  if (!authStore.user) {
    await authStore.fetchMe()
  }

  await loadSelectors()
  await loadInventoryPage()
  applyScannerPrefill()
})

watch(
  () => [
    route.query.action,
    route.query.variantId,
    route.query.warehouseId,
    route.query.locationId,
    route.query.locationCode,
    route.query.locationName,
    route.query.zone,
    route.query.shelf,
    route.query.bin,
    route.query.level,
    route.query.scannedCode,
    route.query.prefillToken,
  ],
  () => {
    applyScannerPrefill()
  },
)

watch(() => stockInForm.warehouseId, resetStockInLocationIfWarehouseChanged)
watch(() => stockOutForm.warehouseId, resetStockOutLocationIfWarehouseChanged)
watch(() => transferForm.sourceWarehouseId, () => resetTransferLocationIfWarehouseChanged('source'))
watch(() => transferForm.destinationWarehouseId, () => resetTransferLocationIfWarehouseChanged('destination'))
watch(() => stockInForm.locationId, (value) => {
  if (!value) return
  applyStockInLocationDetails(value)
})
</script>

<template>
  <AppLayout>
    <template #sidebar>
      <div>
        <h3 class="text-base font-semibold text-slate-900">{{ localeStore.locale === 'en' ? 'Inventory Tools' : '库存工具' }}</h3>
        <p class="mt-1 text-xs text-slate-500">
          {{ localeStore.locale === 'en' ? 'Filter inventory and transactions.' : '筛选库存与流水。' }}
        </p>
      </div>

      <details open class="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
        <summary class="cursor-pointer list-none text-sm font-semibold text-slate-900">{{ localeStore.locale === 'en' ? 'Filters' : '筛选' }}</summary>
        <div class="mt-4 space-y-4">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{{ localeStore.locale === 'en' ? 'Inventory' : '库存' }}</p>
            <input
              v-model="inventorySearch"
              type="text"
              :placeholder="localeStore.locale === 'en' ? 'Search inventory' : '搜索库存'"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
              @input="handleInventorySearch"
            />
            <select
              v-model="inventoryFilters.categoryId"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
              @change="handleInventorySearch"
            >
              <option value="">{{ localeStore.locale === 'en' ? 'All categories' : '全部分类' }}</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
            <select
              v-model="inventoryFilters.warehouseId"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
              @change="handleInventorySearch"
            >
              <option value="">{{ localeStore.locale === 'en' ? 'All warehouses' : '全部仓库' }}</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
            <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <input v-model="inventoryFilters.lowStockOnly" type="checkbox" class="size-4 rounded border-slate-300" @change="handleInventorySearch" />
              {{ localeStore.locale === 'en' ? 'Low stock only' : '仅看低库存' }}
            </label>
            <button type="button" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700" @click="resetInventoryFilters">
              {{ localeStore.locale === 'en' ? 'Reset inventory filters' : '重置库存筛选' }}
            </button>
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{{ localeStore.locale === 'en' ? 'Transactions' : '流水' }}</p>
            <input
              v-model="transactionSearch"
              type="text"
              :placeholder="localeStore.locale === 'en' ? 'Search transactions' : '搜索流水'"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
              @input="handleTransactionSearch"
            />
            <select
              v-model="transactionFilters.movementType"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
              @change="handleTransactionSearch"
            >
              <option value="all">{{ localeStore.locale === 'en' ? 'All types' : '全部类型' }}</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="TRANSFER">TRANSFER</option>
            </select>
            <button type="button" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700" @click="resetTransactionFilters">
              {{ localeStore.locale === 'en' ? 'Reset transaction filters' : '重置流水筛选' }}
            </button>
          </div>
        </div>
      </details>
    </template>

    <section>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">
        {{ localeStore.locale === 'en' ? 'Operations' : '运营' }}
      </p>
      <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ localeStore.t('inventory.title') }}</h2>

      <div class="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          @click="openModal('stockIn')"
        >
          <span class="text-lg leading-none">＋</span>
          {{ localeStore.locale === 'en' ? 'Stock in' : '入库' }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
          @click="openModal('stockOut')"
        >
          <span class="text-lg leading-none">－</span>
          {{ localeStore.locale === 'en' ? 'Stock out' : '出库' }}
        </button>
        <button
          v-if="authStore.user?.role === 'ADMIN' || authStore.user?.role === 'MANAGER'"
          type="button"
          class="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          @click="openModal('transfer')"
        >
          <span class="text-lg leading-none">⇄</span>
          {{ localeStore.locale === 'en' ? 'Transfer' : '调拨' }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          @click="openModal('allocation')"
        >
          <span class="text-lg leading-none">◎</span>
          {{ localeStore.locale === 'en' ? 'Allocate' : '分配' }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>
      <p v-if="scannerPrefillMessage" class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        {{ scannerPrefillMessage }}
      </p>

      <div class="mt-8 space-y-6">
        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 class="text-xl font-semibold text-slate-900">Inventory by warehouse</h3>
              <p class="mt-1 text-sm text-slate-500">
                {{ localeStore.locale === 'en' ? 'Use the tools panel for filters and search.' : '使用右侧工具面板进行筛选与搜索。' }}
              </p>
            </div>
          </div>
          <div v-if="loading" class="px-5 py-4 text-sm text-slate-500">{{ localeStore.locale === 'en' ? 'Loading...' : '加载中...' }}</div>
          <div class="grid gap-3 p-4 md:hidden">
            <article
              v-for="item in inventory"
              :key="item.id"
              class="rounded-3xl border border-slate-200 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ item.sku }} · {{ item.category_name || 'No category' }}<span v-if="item.unit"> · {{ localeStore.locale === 'en' ? 'Unit' : '单位' }}: {{ item.unit }}</span>
                  </p>
                </div>
                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  :class="
                    Number(item.warehouse_available_quantity) <= Number(item.reorder_level)
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  "
                >
                  {{ item.warehouse_available_quantity }}
                </span>
              </div>
              <p class="mt-3 text-sm text-slate-500">Warehouse: {{ item.warehouse_name }}</p>
              <p class="mt-1 text-sm text-slate-500">
                Location: {{ item.location_code || '—' }}<span v-if="item.shelf || item.bin"> · Shelf {{ item.shelf || '—' }} / Bin {{ item.bin || '—' }}</span>
              </p>
              <p class="mt-1 text-sm text-slate-500">On hand: {{ item.on_hand_quantity }}</p>
              <p class="mt-1 text-sm text-slate-500">Allocated: {{ item.order_allocated_quantity }}</p>
              <p class="mt-1 text-sm text-slate-500">Reorder: {{ item.reorder_level }}</p>
            </article>
          </div>
          <div class="hidden overflow-x-auto md:block">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-4">{{ localeStore.t('table.product') }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('table.warehouse') }}</th>
                  <th class="px-4 py-4">{{ localeStore.locale === 'en' ? 'Location' : '仓位' }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('table.onHand') }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('table.allocated') }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('table.available') }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('table.reorder') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in inventory" :key="item.id" class="border-t border-slate-100">
                  <td class="px-4 py-4">
                    <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                    <p class="text-xs text-slate-500">
                      {{ item.sku }} · {{ item.category_name || 'No category' }}<span v-if="item.unit"> · {{ localeStore.locale === 'en' ? 'Unit' : '单位' }}: {{ item.unit }}</span>
                    </p>
                  </td>
                  <td class="px-4 py-4">{{ item.warehouse_name }}</td>
                  <td class="px-4 py-4">
                    <p class="font-medium text-slate-900">{{ item.location_code || '—' }}</p>
                    <p class="text-xs text-slate-500">
                      Shelf {{ item.shelf || '—' }} / Bin {{ item.bin || '—' }}
                    </p>
                  </td>
                  <td class="px-4 py-4">
                    <span
                      class="rounded-full px-3 py-1 text-xs font-semibold"
                      :class="
                        Number(item.warehouse_available_quantity) <= Number(item.reorder_level)
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      "
                    >
                      {{ item.on_hand_quantity }}
                    </span>
                  </td>
                  <td class="px-4 py-4">{{ item.order_allocated_quantity }}</td>
                  <td class="px-4 py-4">{{ item.warehouse_available_quantity }}</td>
                  <td class="px-4 py-4">{{ item.reorder_level }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar :pagination="inventoryPagination" @change="(page) => loadInventoryPage(page, transactionPagination.page)" />
        </div>

        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div class="border-b border-slate-200 px-5 py-4">
            <div>
              <h3 class="text-xl font-semibold text-slate-900">Recent transactions</h3>
              <p class="mt-1 text-sm text-slate-500">
                {{ localeStore.locale === 'en' ? 'Use the tools panel for transaction filters.' : '使用右侧工具面板进行流水筛选。' }}
              </p>
            </div>
          </div>
          <div class="space-y-3 p-5">
            <div
              v-for="transaction in transactions"
              :key="transaction.id"
              class="rounded-2xl border border-slate-200 p-4"
            >
              <div class="flex items-center justify-between gap-4">
                <p class="font-medium text-slate-900">{{ transaction.movement_type }}</p>
                <span class="text-xs text-slate-500">{{ new Date(transaction.created_at).toLocaleString() }}</span>
              </div>
              <p class="mt-2 text-sm text-slate-700">
                {{ transaction.product_name }} · {{ transaction.sku }}<span v-if="transaction.variant_label"> · {{ transaction.variant_label }}</span>
              </p>
              <p class="mt-1 text-sm text-slate-500">
                Qty {{ transaction.quantity }} · Ref {{ transaction.reference_no || 'N/A' }}
              </p>
              <p class="mt-1 text-xs text-slate-400">
                {{ transaction.source_warehouse_name || 'Supplier' }}
                →
                {{ transaction.destination_warehouse_name || 'Customer' }}
              </p>
              <p class="mt-1 text-xs text-slate-400">
                {{ transaction.source_location_code || '—' }}
                <span v-if="transaction.source_shelf || transaction.source_bin">
                  · Shelf {{ transaction.source_shelf || '—' }} / Bin {{ transaction.source_bin || '—' }}
                </span>
                →
                {{ transaction.destination_location_code || '—' }}
                <span v-if="transaction.destination_shelf || transaction.destination_bin">
                  · Shelf {{ transaction.destination_shelf || '—' }} / Bin {{ transaction.destination_bin || '—' }}
                </span>
              </p>
            </div>
          </div>
          <PaginationBar :pagination="transactionPagination" @change="(page) => loadInventoryPage(inventoryPagination.page, page)" />
        </div>
      </div>
    </section>

    <!-- Stock movement modals -->
    <Teleport to="body">
      <div
        v-if="activeModal"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
        @click.self="closeModal"
      >
        <div class="w-full max-w-lg rounded-3xl bg-white shadow-xl">
          <!-- Stock In -->
          <form
            v-if="activeModal === 'stockIn'"
            @submit.prevent="submitMovement('/inventory/stock-in', stockInForm)"
          >
            <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 class="text-lg font-semibold text-slate-900">
                {{ localeStore.locale === 'en' ? 'Stock in' : '入库' }}
              </h3>
              <button type="button" class="text-slate-400 hover:text-slate-600" @click="closeModal">✕</button>
            </div>
            <div class="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
              <select v-model="stockInForm.variantId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select SKU' : '选择 SKU' }}</option>
                <option v-for="variant in variants" :key="variant.id" :value="variant.id">
                  {{ variant.product_name }} · {{ variant.sku }}<span v-if="variant.variant_label"> · {{ variant.variant_label }}</span>
                </option>
              </select>
              <select v-model="stockInForm.warehouseId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select warehouse' : '选择仓库' }}</option>
                <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                  {{ warehouse.name }}
                </option>
              </select>
              <select v-model="stockInForm.locationId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select existing location (optional)' : '选择现有仓位（可选）' }}</option>
                <option v-for="location in stockInWarehouseLocations" :key="location.id" :value="location.id">
                  {{ formatLocationOption(location) }}
                </option>
              </select>
              <input v-model="stockInForm.locationCode" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Location code (optional)' : '仓位编码（可选）'" />
              <input v-model="stockInForm.locationName" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Location name (optional)' : '仓位名称（可选）'" />
              <div class="grid gap-3 sm:grid-cols-2">
                <input v-model="stockInForm.zone" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Zone (optional)' : 'Zone 分区（可选）'" />
                <input v-model="stockInForm.level" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Level (optional)' : '层级（可选）'" />
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <input v-model="stockInForm.shelf" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Shelf (optional)' : 'Shelf 货架（可选）'" />
                <input v-model="stockInForm.bin" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Bin (optional)' : 'Bin 格位（可选）'" />
              </div>
              <select v-model="stockInForm.unit" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select unit (optional)' : '选择单位（可选）' }}</option>
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="gram">gram</option>
                <option value="box">box</option>
                <option value="carton">carton</option>
              </select>
              <select v-model="stockInForm.supplierId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select supplier (optional)' : '选择供应商（可选）' }}</option>
                <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                  {{ supplier.name }}
                </option>
              </select>
              <input v-model="stockInForm.quantity" :step="getUnitStep(stockInForm.unit)" type="number" min="1" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Quantity' : '数量'" />
              <input v-model="stockInForm.unitCost" type="number" min="0" step="0.01" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Unit cost (optional)' : '单价（可选）'" />
              <input v-model="stockInForm.referenceNo" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Reference no' : '单号'" />
              <input v-model="stockInForm.purchaseReason" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Purchase reason (optional)' : '采购原因（可选）'" />
              <textarea v-model="stockInForm.notes" rows="2" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Notes' : '备注'" />
            </div>
            <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" @click="closeModal">
                {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
              </button>
              <button type="submit" class="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                {{ localeStore.locale === 'en' ? 'Confirm stock in' : '确认入库' }}
              </button>
            </div>
          </form>

          <!-- Stock Out -->
          <form
            v-else-if="activeModal === 'stockOut'"
            @submit.prevent="submitMovement('/inventory/stock-out', stockOutForm)"
          >
            <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 class="text-lg font-semibold text-slate-900">
                {{ localeStore.locale === 'en' ? 'Stock out' : '出库' }}
              </h3>
              <button type="button" class="text-slate-400 hover:text-slate-600" @click="closeModal">✕</button>
            </div>
            <div class="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
              <select v-model="stockOutForm.variantId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select SKU' : '选择 SKU' }}</option>
                <option v-for="variant in variants" :key="variant.id" :value="variant.id">
                  {{ variant.product_name }} · {{ variant.sku }}<span v-if="variant.variant_label"> · {{ variant.variant_label }}</span>
                </option>
              </select>
              <select v-model="stockOutForm.warehouseId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select warehouse' : '选择仓库' }}</option>
                <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                  {{ warehouse.name }}
                </option>
              </select>
              <select v-model="stockOutForm.locationId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select location (recommended)' : '选择仓位（建议填写）' }}</option>
                <option v-for="location in stockOutWarehouseLocations" :key="location.id" :value="location.id">
                  {{ formatLocationOption(location) }}
                </option>
              </select>
              <select v-model="stockOutForm.unit" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select unit (optional)' : '选择单位（可选）' }}</option>
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="gram">gram</option>
                <option value="box">box</option>
                <option value="carton">carton</option>
              </select>
              <input v-model="stockOutForm.quantity" :step="getUnitStep(stockOutForm.unit)" type="number" min="1" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Quantity' : '数量'" />
              <input v-model="stockOutForm.referenceNo" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Reference no' : '单号'" />
              <textarea v-model="stockOutForm.notes" rows="2" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Notes' : '备注'" />
            </div>
            <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" @click="closeModal">
                {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
              </button>
              <button type="submit" class="rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-600">
                {{ localeStore.locale === 'en' ? 'Confirm stock out' : '确认出库' }}
              </button>
            </div>
          </form>

          <!-- Transfer -->
          <form
            v-else-if="activeModal === 'transfer'"
            @submit.prevent="submitMovement('/inventory/transfer', transferForm)"
          >
            <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 class="text-lg font-semibold text-slate-900">
                {{ localeStore.locale === 'en' ? 'Stock transfer' : '库存调拨' }}
              </h3>
              <button type="button" class="text-slate-400 hover:text-slate-600" @click="closeModal">✕</button>
            </div>
            <div class="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
              <select v-model="transferForm.variantId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select SKU' : '选择 SKU' }}</option>
                <option v-for="variant in variants" :key="variant.id" :value="variant.id">
                  {{ variant.product_name }} · {{ variant.sku }}<span v-if="variant.variant_label"> · {{ variant.variant_label }}</span>
                </option>
              </select>
              <select v-model="transferForm.sourceWarehouseId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Source warehouse' : '源仓库' }}</option>
                <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                  {{ warehouse.name }}
                </option>
              </select>
              <select v-model="transferForm.sourceLocationId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Source location (optional)' : '源仓位（可选）' }}</option>
                <option v-for="location in transferSourceLocations" :key="location.id" :value="location.id">
                  {{ formatLocationOption(location) }}
                </option>
              </select>
              <select v-model="transferForm.unit" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select unit (optional)' : '选择单位（可选）' }}</option>
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="gram">gram</option>
                <option value="box">box</option>
                <option value="carton">carton</option>
              </select>
              <select v-model="transferForm.destinationWarehouseId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Destination warehouse' : '目标仓库' }}</option>
                <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                  {{ warehouse.name }}
                </option>
              </select>
              <select v-model="transferForm.destinationLocationId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Destination location (optional)' : '目标仓位（可选）' }}</option>
                <option v-for="location in transferDestinationLocations" :key="location.id" :value="location.id">
                  {{ formatLocationOption(location) }}
                </option>
              </select>
              <input v-model="transferForm.quantity" :step="getUnitStep(transferForm.unit)" type="number" min="1" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Quantity' : '数量'" />
              <input v-model="transferForm.referenceNo" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Reference no' : '单号'" />
              <textarea v-model="transferForm.notes" rows="2" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Notes' : '备注'" />
            </div>
            <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" @click="closeModal">
                {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
              </button>
              <button type="submit" class="rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                {{ localeStore.locale === 'en' ? 'Confirm transfer' : '确认调拨' }}
              </button>
            </div>
          </form>

          <!-- Allocation -->
          <form
            v-else-if="activeModal === 'allocation'"
            @submit.prevent="submitMovement('/inventory/allocate', allocationForm)"
          >
            <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 class="text-lg font-semibold text-slate-900">
                {{ localeStore.locale === 'en' ? 'Order allocation' : '订单分配' }}
              </h3>
              <button type="button" class="text-slate-400 hover:text-slate-600" @click="closeModal">✕</button>
            </div>
            <div class="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-5">
              <select v-model="allocationForm.variantId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select SKU' : '选择 SKU' }}</option>
                <option v-for="variant in variants" :key="variant.id" :value="variant.id">
                  {{ variant.product_name }} · {{ variant.sku }}<span v-if="variant.variant_label"> · {{ variant.variant_label }}</span>
                </option>
              </select>
              <select v-model="allocationForm.warehouseId" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select warehouse' : '选择仓库' }}</option>
                <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                  {{ warehouse.name }}
                </option>
              </select>
              <select v-model="allocationForm.unit" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select unit (optional)' : '选择单位（可选）' }}</option>
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="gram">gram</option>
                <option value="box">box</option>
                <option value="carton">carton</option>
              </select>
              <select v-model="allocationForm.mode" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="reserve">{{ localeStore.locale === 'en' ? 'Reserve' : '预留' }}</option>
                <option value="release">{{ localeStore.locale === 'en' ? 'Release' : '释放' }}</option>
              </select>
              <input v-model="allocationForm.quantity" :step="getUnitStep(allocationForm.unit)" type="number" min="1" required class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Quantity' : '数量'" />
              <input v-model="allocationForm.referenceNo" type="text" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Reference no' : '单号'" />
              <textarea v-model="allocationForm.notes" rows="2" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Notes' : '备注'" />
            </div>
            <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" @click="closeModal">
                {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
              </button>
              <button type="submit" class="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600">
                {{ localeStore.locale === 'en' ? 'Confirm allocation' : '确认分配' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
