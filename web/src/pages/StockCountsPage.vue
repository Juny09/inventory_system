<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'
import { exportToCsv, exportToPdf, printHtmlDocument } from '../utils/export'

const authStore = useAuthStore()
const localeStore = useLocaleStore()
const warehouses = ref([])
const stockCounts = ref([])
const selectedCount = ref(null)
const errorMessage = ref('')
const loading = ref(false)
const saving = ref(false)
const filters = reactive({
  search: '',
  status: 'all',
})
const createForm = reactive({
  warehouseId: '',
  notes: '',
})
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})

const canApply = computed(() => ['ADMIN', 'MANAGER'].includes(authStore.user?.role))
const stockCountColumns = [
  { key: 'product_name', label: localeStore.locale === 'en' ? 'Product' : '商品' },
  { key: 'sku', label: 'SKU' },
  { key: 'expected_quantity', label: localeStore.locale === 'en' ? 'Expected' : '账面库存' },
  { key: 'countedQuantity', label: localeStore.locale === 'en' ? 'Counted' : '实盘库存' },
  { key: 'difference', label: localeStore.locale === 'en' ? 'Difference' : '差异' },
  { key: 'notes', label: localeStore.locale === 'en' ? 'Notes' : '备注' },
]

async function loadWarehouses() {
  const { data } = await api.get('/warehouses', {
    params: {
      all: true,
      activeOnly: true,
    },
  })

  warehouses.value = data.items
}

async function loadCounts(page = pagination.value.page, keepSelection = true) {
  loading.value = true

  try {
    const { data } = await api.get('/stock-counts', {
      params: {
        search: filters.search || undefined,
        status: filters.status,
        page,
        pageSize: pagination.value.pageSize,
      },
    })

    stockCounts.value = data.items
    pagination.value = data.pagination

    const selectedId = keepSelection ? selectedCount.value?.id : null
    const targetId = selectedId || data.items[0]?.id

    if (targetId) {
      await loadCountDetail(targetId)
    } else {
      selectedCount.value = null
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load stock counts.'
  } finally {
    loading.value = false
  }
}

async function loadCountDetail(id) {
  const { data } = await api.get(`/stock-counts/${id}`)
  selectedCount.value = {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      countedQuantity: Number(item.counted_quantity ?? item.expected_quantity),
      notes: item.notes || '',
    })),
  }
}

async function createCount() {
  saving.value = true

  try {
    const { data } = await api.post('/stock-counts', createForm)
    createForm.notes = ''
    await loadCounts(1, false)
    await loadCountDetail(data.id)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to create stock count.'
  } finally {
    saving.value = false
  }
}

async function saveItems() {
  if (!selectedCount.value) {
    return
  }

  saving.value = true

  try {
    await api.put(`/stock-counts/${selectedCount.value.id}/items`, {
      items: selectedCount.value.items.map((item) => ({
        id: item.id,
        countedQuantity: Number(item.countedQuantity),
        notes: item.notes,
      })),
    })
    await loadCountDetail(selectedCount.value.id)
    await loadCounts(pagination.value.page)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to save stock count.'
  } finally {
    saving.value = false
  }
}

async function completeCount() {
  if (!selectedCount.value) {
    return
  }

  saving.value = true

  try {
    await saveItems()
    await api.post(`/stock-counts/${selectedCount.value.id}/complete`)
    await loadCountDetail(selectedCount.value.id)
    await loadCounts(pagination.value.page)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to complete stock count.'
  } finally {
    saving.value = false
  }
}

async function applyCount() {
  if (!selectedCount.value) {
    return
  }

  saving.value = true

  try {
    await api.post(`/stock-counts/${selectedCount.value.id}/apply`)
    await loadCountDetail(selectedCount.value.id)
    await loadCounts(pagination.value.page)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to apply stock count.'
  } finally {
    saving.value = false
  }
}

function handleFilter() {
  loadCounts(1, false)
}

function getExportRows() {
  if (!selectedCount.value) {
    return []
  }

  return selectedCount.value.items.map((item) => ({
    ...item,
    difference: Number(item.countedQuantity) - Number(item.expected_quantity),
  }))
}

function exportCountCsv() {
  if (!selectedCount.value) {
    return
  }

  exportToCsv(`stock-count-${selectedCount.value.id}.csv`, stockCountColumns, getExportRows())
}

async function exportCountPdf() {
  if (!selectedCount.value) {
    return
  }

  await exportToPdf(`Stock Count #${selectedCount.value.id}`, `stock-count-${selectedCount.value.id}.pdf`, stockCountColumns, getExportRows())
}

function printCount() {
  if (!selectedCount.value) {
    return
  }

  const rowsHtml = selectedCount.value.items
    .map(
      (item) => `
        <tr>
          <td>${item.product_name}<br/><small>${item.sku}</small></td>
          <td>${item.expected_quantity} ${item.unit}</td>
          <td>${item.countedQuantity} ${item.unit}</td>
          <td>${Number(item.countedQuantity) - Number(item.expected_quantity)}</td>
          <td>${item.notes || ''}</td>
        </tr>
      `,
    )
    .join('')

  printHtmlDocument(
    `Stock Count #${selectedCount.value.id}`,
    `
      <h1>Stock Count #${selectedCount.value.id}</h1>
      <p>Warehouse: ${selectedCount.value.warehouse_name}</p>
      <p>Status: ${selectedCount.value.status}</p>
      <p>Notes: ${selectedCount.value.notes || '—'}</p>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Expected</th>
            <th>Counted</th>
            <th>Diff</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `,
  )
}

onMounted(async () => {
  await loadWarehouses()
  if (warehouses.value[0] && !createForm.warehouseId) {
    createForm.warehouseId = warehouses.value[0].id
  }
  await loadCounts()
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Stock Count</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Stock count sheets' : '库存盘点单' }}
          </h2>
          <p class="mt-2 text-sm text-slate-500">
            {{
              localeStore.locale === 'en'
                ? 'Create a count sheet, input counted qty, then apply differences.'
                : '先生成盘点单，再录入实盘数量，最后由主管应用差异。'
            }}
          </p>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 grid gap-6 2xl:grid-cols-[380px_1fr]">
        <div class="space-y-6">
          <form class="rounded-3xl border border-slate-200 bg-slate-50 p-5" @submit.prevent="createCount">
            <h3 class="text-xl font-semibold text-slate-900">
              {{ localeStore.locale === 'en' ? 'Create stock count' : '新建盘点单' }}
            </h3>
            <div class="mt-5 space-y-4">
              <select
                v-model="createForm.warehouseId"
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              >
                <option value="">{{ localeStore.locale === 'en' ? 'Select warehouse' : '选择仓库' }}</option>
                <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                  {{ warehouse.name }}
                </option>
              </select>
              <textarea
                v-model="createForm.notes"
                rows="4"
                :placeholder="localeStore.locale === 'en' ? 'Count notes' : '盘点说明'"
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              />
              <button class="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                {{ saving ? (localeStore.locale === 'en' ? 'Processing...' : '处理中...') : (localeStore.locale === 'en' ? 'Create sheet' : '生成盘点单') }}
              </button>
            </div>
          </form>

          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="grid gap-3">
              <input
                v-model="filters.search"
                type="text"
                :placeholder="localeStore.locale === 'en' ? 'Search warehouse or notes' : '搜索仓库或备注'"
                class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                @input="handleFilter"
              />
              <select
                v-model="filters.status"
                class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                @change="handleFilter"
              >
                <option value="all">{{ localeStore.locale === 'en' ? 'All status' : '全部状态' }}</option>
                <option value="OPEN">OPEN</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="APPLIED">APPLIED</option>
              </select>
            </div>

            <div class="mt-5 space-y-3">
              <button
                v-for="count in stockCounts"
                :key="count.id"
                type="button"
                class="w-full rounded-2xl border p-4 text-left transition"
                :class="
                  selectedCount?.id === count.id
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300'
                "
                @click="loadCountDetail(count.id)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="font-medium text-slate-900">#{{ count.id }} · {{ count.warehouse_name }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ new Date(count.created_at).toLocaleString() }}</p>
                  </div>
                  <span class="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {{ count.status }}
                  </span>
                </div>
                <p class="mt-2 text-sm text-slate-500">
                  {{ localeStore.locale === 'en' ? `${count.item_count} items · Diff ${count.total_difference}` : `${count.item_count} 项 · 差异 ${count.total_difference}` }}
                </p>
              </button>
            </div>

            <PaginationBar :pagination="pagination" @change="(page) => loadCounts(page, false)" />
          </div>
        </div>

        <div class="rounded-3xl border border-slate-200 p-5">
          <div v-if="loading" class="text-sm text-slate-500">{{ localeStore.locale === 'en' ? 'Loading...' : '加载中...' }}</div>

          <template v-else-if="selectedCount">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Count #{{ selectedCount.id }}</p>
                <h3 class="mt-2 text-2xl font-semibold text-slate-900">{{ selectedCount.warehouse_name }}</h3>
                <p class="mt-2 text-sm text-slate-500">{{ selectedCount.notes || (localeStore.locale === 'en' ? 'No additional notes' : '无额外说明') }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                  {{ selectedCount.status }}
                </span>
                <button
                  type="button"
                  class="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  @click="exportCountCsv"
                >
                  {{ localeStore.locale === 'en' ? 'Export CSV' : '导出 CSV' }}
                </button>
                <button
                  type="button"
                  class="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  @click="exportCountPdf"
                >
                  {{ localeStore.locale === 'en' ? 'Export PDF' : '导出 PDF' }}
                </button>
                <button
                  type="button"
                  class="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  @click="printCount"
                >
                  {{ localeStore.locale === 'en' ? 'Print' : '打印' }}
                </button>
                <button
                  v-if="selectedCount.status === 'OPEN'"
                  type="button"
                  class="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  @click="saveItems"
                >
                  {{ localeStore.locale === 'en' ? 'Save entries' : '保存录入' }}
                </button>
                <button
                  v-if="selectedCount.status === 'OPEN'"
                  type="button"
                  class="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                  @click="completeCount"
                >
                  {{ localeStore.locale === 'en' ? 'Complete count' : '完成盘点' }}
                </button>
                <button
                  v-if="selectedCount.status === 'COMPLETED' && canApply"
                  type="button"
                  class="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  @click="applyCount"
                >
                  {{ localeStore.locale === 'en' ? 'Apply difference' : '应用差异' }}
                </button>
              </div>
            </div>

            <div class="mt-5 grid gap-3 md:hidden">
              <article
                v-for="item in selectedCount.items"
                :key="item.id"
                class="rounded-3xl border border-slate-200 p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ item.sku }}</p>
                  </div>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    差异 {{ Number(item.countedQuantity) - Number(item.expected_quantity) }}
                  </span>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-3">
                  <div class="rounded-2xl bg-slate-50 px-3 py-3">
                    <p class="text-xs text-slate-400">账面</p>
                    <p class="mt-1 font-semibold text-slate-900">{{ item.expected_quantity }} {{ item.unit }}</p>
                  </div>
                  <div class="rounded-2xl bg-slate-50 px-3 py-3">
                    <p class="text-xs text-slate-400">实盘</p>
                    <input
                      v-model="item.countedQuantity"
                      :disabled="selectedCount.status !== 'OPEN'"
                      type="number"
                      min="0"
                      class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>
                <input
                  v-model="item.notes"
                  :disabled="selectedCount.status !== 'OPEN'"
                  type="text"
                  placeholder="备注"
                  class="mt-4 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100"
                />
              </article>
            </div>

            <div class="mt-5 hidden overflow-x-auto md:block">
              <table class="min-w-full text-left text-sm">
                <thead class="bg-slate-50 text-slate-500">
                  <tr>
                    <th class="px-4 py-4">商品</th>
                    <th class="px-4 py-4">账面</th>
                    <th class="px-4 py-4">实盘</th>
                    <th class="px-4 py-4">差异</th>
                    <th class="px-4 py-4">备注</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedCount.items" :key="item.id" class="border-t border-slate-100">
                    <td class="px-4 py-4">
                      <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                      <p class="text-xs text-slate-500">{{ item.sku }}</p>
                    </td>
                    <td class="px-4 py-4">{{ item.expected_quantity }} {{ item.unit }}</td>
                    <td class="px-4 py-4">
                      <input
                        v-model="item.countedQuantity"
                        :disabled="selectedCount.status !== 'OPEN'"
                        type="number"
                        min="0"
                        class="w-28 rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100"
                      />
                    </td>
                    <td class="px-4 py-4">
                      {{ Number(item.countedQuantity) - Number(item.expected_quantity) }}
                    </td>
                    <td class="px-4 py-4">
                      <input
                        v-model="item.notes"
                        :disabled="selectedCount.status !== 'OPEN'"
                        type="text"
                        class="w-full min-w-40 rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <div v-else class="text-sm text-slate-500">暂无盘点单，请先生成一张盘点单。</div>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
