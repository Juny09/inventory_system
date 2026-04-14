<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { useLocaleStore } from '../stores/locale'

const authStore = useAuthStore()
const toastStore = useToastStore()
const localeStore = useLocaleStore()
const alerts = ref([])
const warehouses = ref([])
const assignees = ref([])
const errorMessage = ref('')
const loading = ref(false)
const savingAlertKey = ref('')
const selectedAlertItems = ref([])
const summary = reactive({
  total_alerts: 0,
  out_of_stock: 0,
  affected_products: 0,
})
const filters = reactive({
  search: '',
  warehouseId: '',
  status: 'all',
})
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})
const bulkForm = reactive({
  status: 'READ',
  assignedTo: '',
})

const canAssign = computed(() => ['ADMIN', 'MANAGER'].includes(authStore.user?.role))
const allSelected = computed(
  () => alerts.value.length > 0 && alerts.value.every((item) => isAlertSelected(item)),
)

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

function getAlertKey(item) {
  return `${item.product_id || item.productId}-${item.warehouse_id || item.warehouseId}`
}

function toSelectedAlert(item) {
  return {
    productId: item.product_id || item.productId,
    warehouseId: item.warehouse_id || item.warehouseId,
    status: item.alert_status || item.status || 'OPEN',
    assignedTo: item.assigned_to ?? item.assignedTo ?? null,
    notes: item.alert_notes || item.notes || '',
    productName: item.product_name || item.productName || '',
  }
}

function isAlertSelected(item) {
  return selectedAlertItems.value.some((selectedItem) => getAlertKey(selectedItem) === getAlertKey(item))
}

async function loadWarehouses() {
  const { data } = await api.get('/warehouses', {
    params: {
      all: true,
      activeOnly: true,
    },
  })

  warehouses.value = data.items
}

async function loadAssignees() {
  if (!canAssign.value) {
    assignees.value = []
    return
  }

  const { data } = await api.get('/users', {
    params: {
      all: true,
    },
  })

  assignees.value = data.items
}

async function loadAlerts(page = pagination.value.page) {
  loading.value = true

  try {
    const { data } = await api.get('/alerts/low-stock', {
      params: {
        search: filters.search || undefined,
        warehouseId: filters.warehouseId || undefined,
        status: filters.status,
        page,
        pageSize: pagination.value.pageSize,
      },
    })

    alerts.value = data.items
    pagination.value = data.pagination
    Object.assign(summary, data.summary)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load alerts.'
  } finally {
    loading.value = false
  }
}

async function fetchAllFilteredAlerts() {
  const { data } = await api.get('/alerts/low-stock', {
    params: {
      search: filters.search || undefined,
      warehouseId: filters.warehouseId || undefined,
      status: filters.status,
      all: true,
    },
  })

  return data.items
}

async function updateAlert(item, overrides = {}) {
  const alertKey = `${item.product_id}-${item.warehouse_id}`
  savingAlertKey.value = alertKey

  try {
    await api.put(`/alerts/low-stock/${item.product_id}/${item.warehouse_id}`, {
      status: overrides.status || item.alert_status || 'OPEN',
      assignedTo: overrides.assignedTo ?? item.assigned_to ?? null,
      notes: overrides.notes ?? item.alert_notes ?? '',
    })
    await loadAlerts(pagination.value.page)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to update alert.'
  } finally {
    savingAlertKey.value = ''
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    const currentPageKeys = alerts.value.map((item) => getAlertKey(item))
    selectedAlertItems.value = selectedAlertItems.value.filter(
      (item) => !currentPageKeys.includes(getAlertKey(item)),
    )
    return
  }

  const mergedMap = new Map(selectedAlertItems.value.map((item) => [getAlertKey(item), item]))
  alerts.value.forEach((item) => {
    mergedMap.set(getAlertKey(item), toSelectedAlert(item))
  })
  selectedAlertItems.value = Array.from(mergedMap.values())
}

function toggleSelectAlert(item) {
  const key = getAlertKey(item)

  if (isAlertSelected(item)) {
    selectedAlertItems.value = selectedAlertItems.value.filter((selectedItem) => getAlertKey(selectedItem) !== key)
    return
  }

  selectedAlertItems.value = [
    ...selectedAlertItems.value,
    toSelectedAlert(item),
  ]
}

async function selectCurrentFilteredResults() {
  savingAlertKey.value = 'select-filtered'

  try {
    const items = await fetchAllFilteredAlerts()
    selectedAlertItems.value = items.map((item) => toSelectedAlert(item))
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to select filtered alerts.'
  } finally {
    savingAlertKey.value = ''
  }
}

function clearSelection() {
  selectedAlertItems.value = []
}

async function undoBulkAction(previousItems) {
  savingAlertKey.value = 'undo-bulk'

  try {
    await api.post('/alerts/low-stock/bulk-update', {
      items: previousItems.map((item) => ({
        productId: item.productId,
        warehouseId: item.warehouseId,
        status: item.status,
        assignedTo: item.assignedTo,
        notes: item.notes,
      })),
    })

    await loadAlerts(pagination.value.page)
    toastStore.pushToast({
      tone: 'info',
      message: tr('Last bulk alert action has been undone.', '已撤销最近一次批量提醒操作。'),
    })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to undo bulk update.'
  } finally {
    savingAlertKey.value = ''
  }
}

async function applyBulkAction() {
  if (selectedAlertItems.value.length === 0) {
    return
  }

  savingAlertKey.value = 'bulk'

  try {
    const previousItems = selectedAlertItems.value.map((item) => ({ ...item }))
    await api.post('/alerts/low-stock/bulk-update', {
      items: selectedAlertItems.value,
      status: bulkForm.status,
      assignedTo: bulkForm.assignedTo || null,
    })

    selectedAlertItems.value = []
    toastStore.pushToast({
      tone: 'success',
      message: tr(
        `Updated ${previousItems.length} alerts in bulk.`,
        `已批量更新 ${previousItems.length} 条提醒。`,
      ),
      actionLabel: 'Undo',
      onAction: () => undoBulkAction(previousItems),
      duration: 7000,
    })
    await loadAlerts(pagination.value.page)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to bulk update alerts.'
  } finally {
    savingAlertKey.value = ''
  }
}

function handleFilter() {
  loadAlerts(1)
}

function resetFilters() {
  Object.assign(filters, {
    search: '',
    warehouseId: '',
    status: 'all',
  })
  selectedAlertItems.value = []
  loadAlerts(1)
}

onMounted(async () => {
  await loadWarehouses()
  await loadAssignees()
  await loadAlerts()
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Alerts</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Low stock alert center', '低库存提醒中心') }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ tr('Monitor low-stock and out-of-stock products in one place.', '集中查看低库存与缺货商品，及时安排补货或调拨。') }}</p>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 grid gap-4 sm:grid-cols-3">
        <div class="rounded-3xl border border-slate-200 p-5">
          <p class="text-sm text-slate-500">{{ tr('Low stock records', '低库存记录') }}</p>
          <p class="mt-3 text-3xl font-semibold text-slate-900">{{ summary.total_alerts }}</p>
        </div>
        <div class="rounded-3xl border border-slate-200 p-5">
          <p class="text-sm text-slate-500">{{ tr('Out-of-stock records', '缺货记录') }}</p>
          <p class="mt-3 text-3xl font-semibold text-slate-900">{{ summary.out_of_stock }}</p>
        </div>
        <div class="rounded-3xl border border-slate-200 p-5">
          <p class="text-sm text-slate-500">{{ tr('Affected products', '受影响商品') }}</p>
          <p class="mt-3 text-3xl font-semibold text-slate-900">{{ summary.affected_products }}</p>
        </div>
      </div>

      <div class="mt-6 rounded-3xl border border-slate-200 p-5">
        <div class="mb-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_180px_220px_180px]">
          <div>
            <p class="text-sm font-medium text-slate-900">{{ tr('Bulk actions', '批量操作') }}</p>
            <p class="mt-1 text-xs text-slate-500">
              {{
                tr(
                  `${selectedAlertItems.length} alerts selected. Apply status or assignee in one action.`,
                  `已选 ${selectedAlertItems.length} 条提醒，可统一标记状态或指派负责人。`,
                )
              }}
            </p>
          </div>
          <select
            v-model="bulkForm.status"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          >
            <option value="OPEN">OPEN</option>
            <option value="READ">READ</option>
            <option value="IGNORED">IGNORED</option>
          </select>
          <select
            v-if="canAssign"
            v-model="bulkForm.assignedTo"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          >
            <option value="">{{ tr('Keep assignee unchanged', '不调整负责人') }}</option>
            <option v-for="user in assignees" :key="user.id" :value="user.id">
              {{ user.full_name }}
            </option>
          </select>
          <button
            type="button"
            class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="selectedAlertItems.length === 0 || savingAlertKey === 'bulk'"
            @click="applyBulkAction"
          >
            {{ savingAlertKey === 'bulk' ? tr('Processing...', '处理中...') : tr('Apply bulk action', '应用批量操作') }}
          </button>
        </div>

        <div class="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="savingAlertKey === 'select-filtered'"
            @click="selectCurrentFilteredResults"
          >
            {{ savingAlertKey === 'select-filtered' ? tr('Processing...', '处理中...') : tr('Select all filtered results', '仅对当前筛选结果全选') }}
          </button>
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="selectedAlertItems.length === 0"
            @click="clearSelection"
          >
            {{ tr('Clear selection', '清空选择') }}
          </button>
        </div>

        <div class="grid gap-3 lg:grid-cols-4">
          <input
            v-model="filters.search"
            type="text"
            :placeholder="tr('Search product, SKU, warehouse', '搜索商品、SKU、仓库')"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @input="handleFilter"
          />
          <select
            v-model="filters.warehouseId"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @change="handleFilter"
          >
            <option value="">{{ tr('All warehouses', '全部仓库') }}</option>
            <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }}
            </option>
          </select>
          <select
            v-model="filters.status"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @change="handleFilter"
          >
            <option value="all">{{ tr('All alert status', '全部提醒状态') }}</option>
            <option value="OPEN">OPEN</option>
            <option value="READ">READ</option>
            <option value="IGNORED">IGNORED</option>
          </select>
          <div>
            <button
              type="button"
              class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              @click="resetFilters"
            >
              {{ tr('Reset filters', '重置筛选') }}
            </button>
          </div>
        </div>

        <div v-if="loading" class="mt-5 text-sm text-slate-500">{{ tr('Loading...', '加载中...') }}</div>

        <div class="mt-5 grid gap-3 md:hidden">
          <article v-for="item in alerts" :key="item.id" class="rounded-3xl border border-slate-200 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <input
                  :checked="isAlertSelected(item)"
                  type="checkbox"
                  class="mt-1 size-4 rounded border-slate-300"
                  @change="toggleSelectAlert(item)"
                />
                <div>
                  <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ item.sku }} · {{ item.warehouse_name }}</p>
                </div>
              </div>
              <span class="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                {{ item.alert_status }}
              </span>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div class="rounded-2xl bg-slate-50 px-3 py-3">
                <p class="text-xs text-slate-400">{{ tr('Current stock', '当前库存') }}</p>
                <p class="mt-1 font-semibold text-slate-900">{{ item.quantity }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 px-3 py-3">
                <p class="text-xs text-slate-400">{{ tr('Reorder level', '补货线') }}</p>
                <p class="mt-1 font-semibold text-slate-900">{{ item.reorder_level }}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 px-3 py-3">
                <p class="text-xs text-slate-400">{{ tr('Shortage', '缺口') }}</p>
                <p class="mt-1 font-semibold text-amber-700">{{ item.shortage }}</p>
              </div>
            </div>
            <div class="mt-4 grid gap-3">
              <select
                :value="item.alert_status"
                class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                @change="updateAlert(item, { status: $event.target.value })"
              >
                <option value="OPEN">OPEN</option>
                <option value="READ">READ</option>
                <option value="IGNORED">IGNORED</option>
              </select>
              <select
                v-if="canAssign"
                :value="item.assigned_to || ''"
                class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                @change="updateAlert(item, { assignedTo: $event.target.value || null })"
              >
                <option value="">{{ tr('Unassigned', '未指派') }}</option>
                <option v-for="user in assignees" :key="user.id" :value="user.id">
                  {{ user.full_name }}
                </option>
              </select>
              <p class="text-xs text-slate-500">
                {{
                  savingAlertKey === `${item.product_id}-${item.warehouse_id}`
                    ? tr('Saving...', '保存中...')
                    : tr(
                        `Current assignee: ${item.assigned_to_name || 'Unassigned'}`,
                        `当前负责人：${item.assigned_to_name || '未指派'}`,
                      )
                }}
              </p>
            </div>
          </article>
        </div>

        <div class="mt-5 hidden overflow-x-auto md:block">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-4">
                  <input
                    :checked="allSelected"
                    type="checkbox"
                    class="size-4 rounded border-slate-300"
                    @change="toggleSelectAll"
                  />
                </th>
                <th class="px-4 py-4">{{ tr('Product', '商品') }}</th>
                <th class="px-4 py-4">{{ tr('Warehouse', '仓库') }}</th>
                <th class="px-4 py-4">{{ tr('Current stock', '当前库存') }}</th>
                <th class="px-4 py-4">{{ tr('Reorder', '补货线') }}</th>
                <th class="px-4 py-4">{{ tr('Shortage', '缺口') }}</th>
                <th class="px-4 py-4">{{ tr('Status', '状态') }}</th>
                <th class="px-4 py-4">{{ tr('Assignee', '负责人') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in alerts" :key="item.id" class="border-t border-slate-100">
                <td class="px-4 py-4">
                  <input
                    :checked="isAlertSelected(item)"
                    type="checkbox"
                    class="size-4 rounded border-slate-300"
                    @change="toggleSelectAlert(item)"
                  />
                </td>
                <td class="px-4 py-4">
                  <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                  <p class="text-xs text-slate-500">{{ item.sku }}</p>
                </td>
                <td class="px-4 py-4">{{ item.warehouse_name }}</td>
                <td class="px-4 py-4">
                  <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {{ item.quantity }}
                  </span>
                </td>
                <td class="px-4 py-4">{{ item.reorder_level }}</td>
                <td class="px-4 py-4">{{ item.shortage }}</td>
                <td class="px-4 py-4">
                  <select
                    :value="item.alert_status"
                    class="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500"
                    @change="updateAlert(item, { status: $event.target.value })"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="READ">READ</option>
                    <option value="IGNORED">IGNORED</option>
                  </select>
                </td>
                <td class="px-4 py-4">
                  <select
                    v-if="canAssign"
                    :value="item.assigned_to || ''"
                    class="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-brand-500"
                    @change="updateAlert(item, { assignedTo: $event.target.value || null })"
                  >
                    <option value="">{{ tr('Unassigned', '未指派') }}</option>
                    <option v-for="user in assignees" :key="user.id" :value="user.id">
                      {{ user.full_name }}
                    </option>
                  </select>
                  <p v-else class="text-sm text-slate-500">{{ item.assigned_to_name || tr('Unassigned', '未指派') }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <PaginationBar :pagination="pagination" @change="loadAlerts" />
      </div>
    </section>
  </AppLayout>
</template>
