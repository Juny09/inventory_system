<script setup>
import { onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { exportToCsv, exportToPdf } from '../utils/export'

const inventoryReport = ref([])
const movementReport = ref([])
const errorMessage = ref('')
const loading = ref(false)
const exportLoading = ref('')
const filters = reactive({
  startDate: '',
  endDate: '',
  search: '',
})
const inventoryPagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})
const movementPagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})

const inventoryColumns = [
  { key: 'product_name', label: '商品' },
  { key: 'sku', label: 'SKU' },
  { key: 'warehouse_name', label: '仓库' },
  { key: 'quantity', label: '数量' },
  { key: 'reorder_level', label: '补货线' },
  { key: 'stock_value', label: '库存金额' },
]

const movementColumns = [
  { key: 'movement_type', label: '类型' },
  { key: 'product_name', label: '商品' },
  { key: 'source_warehouse_name', label: '来源' },
  { key: 'destination_warehouse_name', label: '去向' },
  { key: 'quantity', label: '数量' },
  { key: 'created_by_name', label: '操作人' },
  { key: 'created_at', label: '时间' },
]

async function loadReports(
  inventoryPage = inventoryPagination.value.page,
  movementPage = movementPagination.value.page,
) {
  loading.value = true

  try {
    const [inventoryResponse, movementResponse] = await Promise.all([
      api.get('/reports/inventory', {
        params: {
          search: filters.search || undefined,
          page: inventoryPage,
          pageSize: inventoryPagination.value.pageSize,
        },
      }),
      api.get('/reports/movements', {
        params: {
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          search: filters.search || undefined,
          page: movementPage,
          pageSize: movementPagination.value.pageSize,
        },
      }),
    ])

    inventoryReport.value = inventoryResponse.data.items
    movementReport.value = movementResponse.data.items
    inventoryPagination.value = inventoryResponse.data.pagination
    movementPagination.value = movementResponse.data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load reports.'
  } finally {
    loading.value = false
  }
}

function getInventoryParams(extra = {}) {
  return {
    search: filters.search || undefined,
    ...extra,
  }
}

function getMovementParams(extra = {}) {
  return {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    search: filters.search || undefined,
    ...extra,
  }
}

async function fetchAllInventoryRows() {
  const { data } = await api.get('/reports/inventory', {
    params: getInventoryParams({ all: true }),
  })

  return data.items
}

async function fetchAllMovementRows() {
  const { data } = await api.get('/reports/movements', {
    params: getMovementParams({ all: true }),
  })

  return data.items
}

async function exportInventoryCsv() {
  exportLoading.value = 'inventory-csv'

  try {
    const rows = await fetchAllInventoryRows()
    exportToCsv('inventory-report.csv', inventoryColumns, rows)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to export inventory report.'
  } finally {
    exportLoading.value = ''
  }
}

async function exportInventoryPdf() {
  exportLoading.value = 'inventory-pdf'

  try {
    const rows = await fetchAllInventoryRows()
    await exportToPdf('Inventory Report', 'inventory-report.pdf', inventoryColumns, rows)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to export inventory report.'
  } finally {
    exportLoading.value = ''
  }
}

async function exportMovementCsv() {
  exportLoading.value = 'movement-csv'

  try {
    const rows = await fetchAllMovementRows()
    exportToCsv('movement-report.csv', movementColumns, rows)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to export movement report.'
  } finally {
    exportLoading.value = ''
  }
}

async function exportMovementPdf() {
  exportLoading.value = 'movement-pdf'

  try {
    const rows = await fetchAllMovementRows()
    await exportToPdf('Movement Report', 'movement-report.pdf', movementColumns, rows)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to export movement report.'
  } finally {
    exportLoading.value = ''
  }
}

onMounted(loadReports)
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Analytics</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">Reports</h2>
        </div>

        <form class="flex flex-wrap gap-3" @submit.prevent="loadReports">
          <input
            v-model="filters.search"
            type="text"
            placeholder="搜索商品/仓库/单号"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          />
          <input
            v-model="filters.startDate"
            type="date"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          />
          <input
            v-model="filters.endDate"
            type="date"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          />
          <button class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Apply</button>
        </form>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="loading" class="mt-6 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
        报表加载中...
      </div>
      <div
        v-if="exportLoading"
        class="mt-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 text-sm text-brand-700"
      >
        正在按当前筛选条件导出全部结果...
      </div>

      <div class="mt-6 grid gap-6">
        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h3 class="text-xl font-semibold text-slate-900">Inventory valuation report</h3>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-2xl border border-slate-300 px-4 py-2 text-sm"
                @click="exportInventoryCsv"
              >
                {{ exportLoading === 'inventory-csv' ? '导出中...' : '导出全部 CSV' }}
              </button>
              <button
                type="button"
                class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
                @click="exportInventoryPdf"
              >
                {{ exportLoading === 'inventory-pdf' ? '导出中...' : '导出全部 PDF' }}
              </button>
            </div>
          </div>
          <div class="grid gap-3 p-4 md:hidden">
            <article
              v-for="row in inventoryReport"
              :key="`${row.sku}-${row.warehouse_name}`"
              class="rounded-3xl border border-slate-200 p-4"
            >
              <p class="font-medium text-slate-900">{{ row.product_name }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ row.sku }} · {{ row.barcode || 'No barcode' }}</p>
              <div class="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div class="rounded-2xl bg-slate-50 px-3 py-3">仓库：{{ row.warehouse_name }}</div>
                <div class="rounded-2xl bg-slate-50 px-3 py-3">数量：{{ row.quantity }}</div>
                <div class="rounded-2xl bg-slate-50 px-3 py-3">补货线：{{ row.reorder_level }}</div>
                <div class="rounded-2xl bg-slate-50 px-3 py-3">金额：${{ Number(row.stock_value).toFixed(2) }}</div>
              </div>
            </article>
          </div>
          <div class="hidden overflow-x-auto md:block">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-4">Product</th>
                  <th class="px-4 py-4">Warehouse</th>
                  <th class="px-4 py-4">Quantity</th>
                  <th class="px-4 py-4">Reorder Level</th>
                  <th class="px-4 py-4">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in inventoryReport" :key="`${row.sku}-${row.warehouse_name}`" class="border-t border-slate-100">
                  <td class="px-4 py-4">
                    <p class="font-medium text-slate-900">{{ row.product_name }}</p>
                    <p class="text-xs text-slate-500">{{ row.sku }} · {{ row.barcode || 'No barcode' }}</p>
                  </td>
                  <td class="px-4 py-4">{{ row.warehouse_name }}</td>
                  <td class="px-4 py-4">{{ row.quantity }}</td>
                  <td class="px-4 py-4">{{ row.reorder_level }}</td>
                  <td class="px-4 py-4">${{ Number(row.stock_value).toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar :pagination="inventoryPagination" @change="(page) => loadReports(page, movementPagination.page)" />
        </div>

        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h3 class="text-xl font-semibold text-slate-900">Movement report</h3>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-2xl border border-slate-300 px-4 py-2 text-sm"
                @click="exportMovementCsv"
              >
                {{ exportLoading === 'movement-csv' ? '导出中...' : '导出全部 CSV' }}
              </button>
              <button
                type="button"
                class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
                @click="exportMovementPdf"
              >
                {{ exportLoading === 'movement-pdf' ? '导出中...' : '导出全部 PDF' }}
              </button>
            </div>
          </div>
          <div class="grid gap-3 p-4 md:hidden">
            <article v-for="row in movementReport" :key="row.id" class="rounded-3xl border border-slate-200 p-4">
              <div class="flex items-start justify-between gap-3">
                <p class="font-medium text-slate-900">{{ row.movement_type }}</p>
                <span class="text-xs text-slate-400">{{ new Date(row.created_at).toLocaleString() }}</span>
              </div>
              <p class="mt-3 text-sm text-slate-700">{{ row.product_name }} · {{ row.sku }}</p>
              <p class="mt-1 text-sm text-slate-500">
                {{ row.source_warehouse_name || 'Supplier' }} → {{ row.destination_warehouse_name || 'Customer' }}
              </p>
              <p class="mt-1 text-sm text-slate-500">
                Qty {{ row.quantity }} · {{ row.created_by_name || 'System' }}
              </p>
            </article>
          </div>
          <div class="hidden overflow-x-auto md:block">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-4">Type</th>
                  <th class="px-4 py-4">Product</th>
                  <th class="px-4 py-4">From</th>
                  <th class="px-4 py-4">To</th>
                  <th class="px-4 py-4">Qty</th>
                  <th class="px-4 py-4">Operator</th>
                  <th class="px-4 py-4">Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in movementReport" :key="row.id" class="border-t border-slate-100">
                  <td class="px-4 py-4 font-medium text-slate-900">{{ row.movement_type }}</td>
                  <td class="px-4 py-4">{{ row.product_name }} · {{ row.sku }}</td>
                  <td class="px-4 py-4">{{ row.source_warehouse_name || 'Supplier' }}</td>
                  <td class="px-4 py-4">{{ row.destination_warehouse_name || 'Customer' }}</td>
                  <td class="px-4 py-4">{{ row.quantity }}</td>
                  <td class="px-4 py-4">{{ row.created_by_name || 'System' }}</td>
                  <td class="px-4 py-4">{{ new Date(row.created_at).toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar :pagination="movementPagination" @change="(page) => loadReports(inventoryPagination.page, page)" />
        </div>
      </div>
    </section>
  </AppLayout>
</template>
