<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { useLocaleStore } from '../stores/locale'
import { useRoute } from 'vue-router'

const authStore = useAuthStore()
const toastStore = useToastStore()
const localeStore = useLocaleStore()
const route = useRoute()
const alerts = ref([])
const activeTab = ref('low-stock')
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

const notifications = ref([])
const notificationsLoading = ref(false)
const notificationsUnreadOnly = ref(true)
const notificationsPagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})

const canAssign = computed(() => ['ADMIN', 'MANAGER'].includes(authStore.user?.role))
const allSelected = computed(
  () => alerts.value.length > 0 && alerts.value.every((item) => isAlertSelected(item)),
)

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

function normalizeTab(value) {
  const raw = String(value || '').trim()
  return raw === 'price-change' ? 'price-change' : 'low-stock'
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

async function loadNotifications(page = notificationsPagination.value.page) {
  notificationsLoading.value = true

  try {
    const { data } = await api.get('/notifications', {
      params: {
        type: 'PRICE_CHANGE',
        unreadOnly: notificationsUnreadOnly.value ? 'true' : 'false',
        page,
        pageSize: notificationsPagination.value.pageSize,
      },
    })
    notifications.value = data.items
    notificationsPagination.value = data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load notifications.'
  } finally {
    notificationsLoading.value = false
  }
}

async function markNotificationRead(notificationId) {
  savingAlertKey.value = `notification-${notificationId}`

  try {
    await api.post(`/notifications/${notificationId}/read`)
    await loadNotifications(notificationsPagination.value.page)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to update notification.'
  } finally {
    savingAlertKey.value = ''
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
  activeTab.value = normalizeTab(route.query.tab)
  await loadWarehouses()
  await loadAssignees()
  await loadAlerts()
  await loadNotifications(1)
})

watch(
  () => route.query.tab,
  (value) => {
    activeTab.value = normalizeTab(value)
  },
)
</script>

<template>
  <AppLayout>
    <template #sidebar>
      <div>
        <h3 class="text-base font-semibold text-slate-900">{{ tr('Alert Tools', '提醒工具') }}</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            class="rounded-full border px-3 py-1.5 text-xs font-semibold"
            :class="activeTab === 'low-stock' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'"
            @click="activeTab = 'low-stock'"
          >
            {{ tr('Low stock', '低库存') }}
          </button>
          <button
            class="rounded-full border px-3 py-1.5 text-xs font-semibold"
            :class="activeTab === 'price-change' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'"
            @click="activeTab = 'price-change'"
          >
            {{ tr('Price changes', '价格变动') }}
          </button>
        </div>
      </div>

      <template v-if="activeTab === 'low-stock'">
        <p class="mt-1 text-xs text-slate-500">
          {{
            tr(
              `${selectedAlertItems.length} selected. Bulk update and filters live here.`,
              `已选 ${selectedAlertItems.length} 条提醒，批量操作与筛选在此处。`,
            )
          }}
        </p>

        <div class="mt-4 space-y-3">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{{ tr('Bulk Action', '批量操作') }}</p>
          <select v-model="bulkForm.status" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500">
            <option value="OPEN">OPEN</option>
            <option value="READ">READ</option>
            <option value="IGNORED">IGNORED</option>
          </select>
          <select
            v-if="canAssign"
            v-model="bulkForm.assignedTo"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
          >
            <option value="">{{ tr('Keep assignee unchanged', '不调整负责人') }}</option>
            <option v-for="user in assignees" :key="user.id" :value="user.id">
              {{ user.full_name }}
            </option>
          </select>
          <button
            type="button"
            class="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="selectedAlertItems.length === 0 || savingAlertKey === 'bulk'"
            @click="applyBulkAction"
          >
            {{ savingAlertKey === 'bulk' ? tr('Processing...', '处理中...') : tr('Apply bulk action', '应用批量操作') }}
          </button>
        </div>

        <div class="mt-4 grid gap-2">
          <button
            type="button"
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="savingAlertKey === 'select-filtered'"
            @click="selectCurrentFilteredResults"
          >
            {{ savingAlertKey === 'select-filtered' ? tr('Processing...', '处理中...') : tr('Select all filtered results', '仅对当前筛选结果全选') }}
          </button>
          <button
            type="button"
            class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="selectedAlertItems.length === 0"
            @click="clearSelection"
          >
            {{ tr('Clear selection', '清空选择') }}
          </button>
        </div>

        <div class="mt-5 border-t border-slate-200 pt-4 space-y-3">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{{ tr('Filters', '筛选') }}</p>
          <input
            v-model="filters.search"
            type="text"
            :placeholder="tr('Search product, SKU, warehouse', '搜索商品、SKU、仓库')"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
            @input="handleFilter"
          />
          <select
            v-model="filters.warehouseId"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
            @change="handleFilter"
          >
            <option value="">{{ tr('All warehouses', '全部仓库') }}</option>
            <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
              {{ warehouse.name }}
            </option>
          </select>
          <select
            v-model="filters.status"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
            @change="handleFilter"
          >
            <option value="all">{{ tr('All alert status', '全部提醒状态') }}</option>
            <option value="OPEN">OPEN</option>
            <option value="READ">READ</option>
            <option value="IGNORED">IGNORED</option>
          </select>
          <button
            type="button"
            class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            @click="resetFilters"
          >
            {{ tr('Reset filters', '重置筛选') }}
          </button>
        </div>
      </template>

      <template v-else>
        <p class="mt-1 text-xs text-slate-500">{{ tr('Monitor cost price changes and mark them as read.', '查看成本变动提醒并标记已读。') }}</p>
        <label class="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <input v-model="notificationsUnreadOnly" type="checkbox" class="size-4 rounded border-slate-300" @change="loadNotifications(1)" />
          {{ tr('Unread only', '仅未读') }}
        </label>
        <button
          type="button"
          class="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          :disabled="notificationsLoading"
          @click="loadNotifications(1)"
        >
          {{ notificationsLoading ? tr('Refreshing...', '刷新中...') : tr('Refresh', '刷新') }}
        </button>
      </template>
    </template>

    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">{{ tr('Operations', '运营') }}</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Alerts center', '提醒中心') }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ tr('Low stock alerts and cost price change notifications.', '包含低库存提醒与成本变动提醒。') }}</p>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          class="rounded-full border px-4 py-2 text-sm font-semibold"
          :class="activeTab === 'low-stock' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'"
          @click="activeTab = 'low-stock'"
        >
          {{ tr('Low stock', '低库存') }}
        </button>
        <button
          class="rounded-full border px-4 py-2 text-sm font-semibold"
          :class="activeTab === 'price-change' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'"
          @click="activeTab = 'price-change'"
        >
          {{ tr('Price changes', '价格变动') }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <template v-if="activeTab === 'low-stock'">
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
                  <p class="mt-1 text-xs text-slate-500">{{ tr('Supplier', '供应商') }}: {{ item.supplier_name || '—' }}</p>
                  <p v-if="item.last_purchase_at" class="mt-1 text-xs text-slate-500">
                    {{ tr('Last purchase', '最近采购') }}: {{ item.last_purchase_at }} · {{ tr('Qty', '数量') }} {{ item.last_purchase_quantity || '—' }}
                  </p>
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
                <th class="px-4 py-4">{{ tr('Supplier', '供应商') }}</th>
                <th class="px-4 py-4">{{ tr('Current stock', '当前库存') }}</th>
                <th class="px-4 py-4">{{ tr('Reorder', '补货线') }}</th>
                <th class="px-4 py-4">{{ tr('Shortage', '缺口') }}</th>
                <th class="px-4 py-4">{{ tr('Last purchase', '最近采购') }}</th>
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
                  <p class="font-medium text-slate-900">{{ item.supplier_name || '—' }}</p>
                  <p class="text-xs text-slate-500">{{ item.supplier_phone || item.supplier_email || '—' }}</p>
                </td>
                <td class="px-4 py-4">
                  <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {{ item.quantity }}
                  </span>
                </td>
                <td class="px-4 py-4">{{ item.reorder_level }}</td>
                <td class="px-4 py-4">{{ item.shortage }}</td>
                <td class="px-4 py-4 text-slate-600">
                  <p>{{ item.last_purchase_at || '—' }}</p>
                  <p class="text-xs text-slate-500">
                    {{ tr('Qty', '数量') }} {{ item.last_purchase_quantity || '—' }} · {{ tr('Unit', '单价') }} {{ item.last_purchase_unit_cost ?? '—' }}
                  </p>
                </td>
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
      </template>

      <template v-else>
        <div class="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <div class="border-b border-slate-200 bg-slate-50 px-4 py-4">
            <h3 class="text-xl font-semibold text-slate-900">{{ tr('Cost price change notifications', '成本变动提醒') }}</h3>
            <p class="mt-1 text-sm text-slate-500">{{ tr('Notifications are generated when cost changes exceed threshold.', '当成本变动超过阈值时自动生成提醒。') }}</p>
          </div>
          <div v-if="notificationsLoading" class="px-4 py-4 text-sm text-slate-500">{{ tr('Loading...', '加载中...') }}</div>
          <div v-else class="space-y-3 p-4">
            <article v-for="item in notifications" :key="item.id" class="rounded-3xl border border-slate-200 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-semibold text-slate-900">{{ item.title }}</p>
                  <p class="mt-1 text-sm text-slate-600">{{ item.message }}</p>
                  <p class="mt-2 text-xs text-slate-500">{{ item.created_at }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="item.is_read ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-700'">
                    {{ item.is_read ? tr('Read', '已读') : tr('Unread', '未读') }}
                  </span>
                  <button
                    v-if="!item.is_read"
                    class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    :disabled="savingAlertKey === `notification-${item.id}`"
                    @click="markNotificationRead(item.id)"
                  >
                    {{ savingAlertKey === `notification-${item.id}` ? tr('Saving...', '保存中...') : tr('Mark read', '标记已读') }}
                  </button>
                </div>
              </div>
            </article>
            <p v-if="notifications.length === 0" class="text-sm text-slate-500">{{ tr('No notifications.', '暂无提醒。') }}</p>
          </div>
          <PaginationBar :pagination="notificationsPagination" @change="loadNotifications" />
        </div>
      </template>
    </section>
  </AppLayout>
</template>
