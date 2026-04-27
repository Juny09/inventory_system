<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import HelpHint from '../components/HelpHint.vue'
import StatCard from '../components/StatCard.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
)

const authStore = useAuthStore()
const localeStore = useLocaleStore()
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const errorMessage = ref('')
const userSearch = ref('')
const dragChartKey = ref('')
const activeTab = ref(String(route.query.tab || 'overview'))
const chartPreferencesCollapsed = ref(false)
const createUserOpen = ref(false)
const chartPreferences = reactive({
  showMovementTrend: true,
  movementTrendType: 'line',
  movementTrendSize: 'md',
  showCategoryChart: true,
  categoryChartType: 'doughnut',
  categoryChartSize: 'md',
  showWarehouseChart: true,
  warehouseChartType: 'bar',
  warehouseChartSize: 'md',
})
const chartOrder = ref(['movementTrend', 'categoryChart', 'warehouseChart'])
const userPagination = ref({
  total: 0,
  page: 1,
  pageSize: 5,
  totalPages: 1,
})
const summary = reactive({
  cards: {
    products: 0,
    warehouses: 0,
    lowStockItems: 0,
    totalOnHand: 0,
  },
  recentMovements: [],
  lowStockPreview: [],
  users: [],
  charts: {
    movementTrend: [],
    stockByWarehouse: [],
    stockByCategory: [],
  },
})

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

const userForm = reactive({
  fullName: '',
  email: '',
  password: '',
  role: 'STAFF',
})
const editingUserId = ref(null)
const savingUserId = ref(null)
const editUserForm = reactive({
  fullName: '',
  email: '',
  role: 'STAFF',
  isActive: true,
  password: '',
})

const movementTrendData = computed(() => ({
  labels: summary.charts.movementTrend.map((item) => item.month),
  datasets: [
    {
      label: tr('Monthly movement', '月度流水'),
      data: summary.charts.movementTrend.map((item) => item.total),
      borderColor: '#4338ca',
      backgroundColor: 'rgba(67, 56, 202, 0.15)',
      tension: 0.35,
      fill: true,
    },
  ],
}))

const warehouseChartData = computed(() => ({
  labels: summary.charts.stockByWarehouse.map((item) => item.label),
  datasets: [
    {
      label: tr('Stock by warehouse', '仓库库存'),
      data: summary.charts.stockByWarehouse.map((item) => item.total),
      backgroundColor: ['#4338ca', '#16a34a', '#f59e0b', '#ef4444', '#0ea5e9'],
    },
  ],
}))

const categoryChartData = computed(() => ({
  labels: summary.charts.stockByCategory.map((item) => item.label),
  datasets: [
    {
      label: tr('Stock by category', '分类库存'),
      data: summary.charts.stockByCategory.map((item) => item.total),
      backgroundColor: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'],
    },
  ],
}))

const chartComponentMap = {
  line: Line,
  bar: Bar,
  doughnut: Doughnut,
}

const visibleChartsCount = computed(
  () =>
    Number(chartPreferences.showMovementTrend) +
    Number(chartPreferences.showCategoryChart) +
    Number(chartPreferences.showWarehouseChart),
)

const dashboardTabs = computed(() => {
  const role = authStore.user?.role || 'STAFF'
  const base = [
    { key: 'overview', label: tr('Overview', '总览') },
    { key: 'charts', label: tr('Charts', '图表') },
  ]
  if (role === 'ADMIN' || role === 'MANAGER') {
    base.push({ key: 'users', label: tr('Users', '用户') })
  }
  return base
})

function setActiveTab(tabKey) {
  const next = String(tabKey || 'overview')
  activeTab.value = next
  router.replace({
    query: {
      ...route.query,
      tab: next,
    },
  })
}

const chartPanelStorageKey = computed(() => `inventory_dashboard_chart_panel_${authStore.user?.id || 'guest'}`)

function loadChartPanelState() {
  chartPreferencesCollapsed.value = localStorage.getItem(chartPanelStorageKey.value) === 'true'
}

function toggleChartPanel() {
  chartPreferencesCollapsed.value = !chartPreferencesCollapsed.value
  localStorage.setItem(chartPanelStorageKey.value, String(chartPreferencesCollapsed.value))
}

const movementTrendComponent = computed(
  () => chartComponentMap[chartPreferences.movementTrendType] || Line,
)

const categoryChartComponent = computed(
  () => chartComponentMap[chartPreferences.categoryChartType] || Doughnut,
)

const warehouseChartComponent = computed(
  () => chartComponentMap[chartPreferences.warehouseChartType] || Bar,
)

const chartDefinitions = computed(() => ({
  movementTrend: {
    key: 'movementTrend',
    title: 'Movement trend',
    description: tr('View stock movement trend for the last 6 months.', '查看最近 6 个月的库存流水变化。'),
    visible: chartPreferences.showMovementTrend,
    component: movementTrendComponent.value,
    data: movementTrendData.value,
    size: chartPreferences.movementTrendSize,
  },
  categoryChart: {
    key: 'categoryChart',
    title: 'Stock by category',
    description: tr('Compare stock distribution by category.', '看哪些分类占了更多库存。'),
    visible: chartPreferences.showCategoryChart,
    component: categoryChartComponent.value,
    data: categoryChartData.value,
    size: chartPreferences.categoryChartSize,
  },
  warehouseChart: {
    key: 'warehouseChart',
    title: 'Stock by warehouse',
    description: tr('Compare stock quantity by warehouse for transfer decisions.', '对比各仓库存量，方便调拨决策。'),
    visible: chartPreferences.showWarehouseChart,
    component: warehouseChartComponent.value,
    data: warehouseChartData.value,
    size: chartPreferences.warehouseChartSize,
  },
}))

const orderedVisibleCharts = computed(() =>
  [...chartOrder.value, 'movementTrend', 'categoryChart', 'warehouseChart']
    .filter((key, index, array) => array.indexOf(key) === index)
    .map((key) => chartDefinitions.value[key])
    .filter((chart) => chart?.visible),
)

function persistChartSettings() {
  const storageKey = `inventory_dashboard_charts_${authStore.user?.id || 'guest'}`
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      preferences: { ...chartPreferences },
      order: chartOrder.value,
    }),
  )
}

function loadChartSettings() {
  const storageKey = `inventory_dashboard_charts_${authStore.user?.id || 'guest'}`
  const rawValue = localStorage.getItem(storageKey)

  if (!rawValue) {
    return
  }

  try {
    const parsedValue = JSON.parse(rawValue)

    if (parsedValue.preferences) {
      Object.assign(chartPreferences, parsedValue.preferences)
    } else {
      Object.assign(chartPreferences, parsedValue)
    }

    if (Array.isArray(parsedValue.order) && parsedValue.order.length > 0) {
      chartOrder.value = [...parsedValue.order, 'movementTrend', 'categoryChart', 'warehouseChart'].filter(
        (key, index, array) => array.indexOf(key) === index,
      )
    }
  } catch {
    localStorage.removeItem(storageKey)
  }
}

function onChartDragStart(chartKey) {
  dragChartKey.value = chartKey
}

function onChartDrop(targetKey) {
  if (!dragChartKey.value || dragChartKey.value === targetKey) {
    dragChartKey.value = ''
    return
  }

  const nextOrder = [...chartOrder.value]
  const fromIndex = nextOrder.indexOf(dragChartKey.value)
  const toIndex = nextOrder.indexOf(targetKey)

  if (fromIndex === -1 || toIndex === -1) {
    dragChartKey.value = ''
    return
  }

  const [movedItem] = nextOrder.splice(fromIndex, 1)
  nextOrder.splice(toIndex, 0, movedItem)
  chartOrder.value = nextOrder
  dragChartKey.value = ''
}

function getChartHeightClass(size) {
  if (size === 'sm') {
    return 'h-64'
  }

  if (size === 'lg') {
    return 'h-96'
  }

  return 'h-80'
}

async function loadDashboard(page = userPagination.value.page) {
  loading.value = true
  errorMessage.value = ''

  try {
    const [summaryResponse, userResponse] = await Promise.all([
      api.get('/dashboard/summary'),
      authStore.user?.role === 'ADMIN' || authStore.user?.role === 'MANAGER'
        ? api.get('/users', {
            params: {
              search: userSearch.value,
              page,
              pageSize: userPagination.value.pageSize,
            },
          })
        : Promise.resolve({
            data: {
              items: [],
              pagination: { total: 0, page: 1, pageSize: 5, totalPages: 1 },
            },
          }),
    ])

    summary.cards = summaryResponse.data.cards
    summary.recentMovements = summaryResponse.data.recentMovements
    summary.lowStockPreview = summaryResponse.data.lowStockPreview
    summary.charts = summaryResponse.data.charts
    summary.users = userResponse.data.items
    userPagination.value = userResponse.data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load dashboard.'
  } finally {
    loading.value = false
  }
}

async function createUser() {
  try {
    await api.post('/users', userForm)
    Object.assign(userForm, {
      fullName: '',
      email: '',
      password: '',
      role: 'STAFF',
    })
    await loadDashboard(1)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to create user.'
  }
}

function startEditUser(userItem) {
  editingUserId.value = userItem.id
  Object.assign(editUserForm, {
    fullName: userItem.full_name,
    email: userItem.email,
    role: userItem.role,
    isActive: Boolean(userItem.is_active),
    password: '',
  })
}

function cancelEditUser() {
  editingUserId.value = null
  Object.assign(editUserForm, {
    fullName: '',
    email: '',
    role: 'STAFF',
    isActive: true,
    password: '',
  })
}

async function saveUserUpdate(userId) {
  savingUserId.value = userId
  errorMessage.value = ''

  try {
    await api.put(`/users/${userId}`, {
      fullName: editUserForm.fullName,
      email: editUserForm.email,
      role: editUserForm.role,
      isActive: editUserForm.isActive,
      password: editUserForm.password || undefined,
    })
    cancelEditUser()
    await loadDashboard(userPagination.value.page)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to update user.'
  } finally {
    savingUserId.value = null
  }
}

async function deleteUser(userItem) {
  if (!window.confirm(`Delete user ${userItem.full_name}?`)) {
    return
  }

  savingUserId.value = userItem.id
  errorMessage.value = ''
  try {
    await api.delete(`/users/${userItem.id}`)
    await loadDashboard(1)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to delete user.'
  } finally {
    savingUserId.value = null
  }
}

function handleUserSearch() {
  loadDashboard(1)
}

onMounted(async () => {
  if (!authStore.user) {
    await authStore.fetchMe()
  }

  loadChartPanelState()
  loadChartSettings()
  await loadDashboard()
})

watch(
  () => route.query.tab,
  (value) => {
    const next = String(value || 'overview')
    if (next !== activeTab.value) {
      activeTab.value = next
    }
  },
)

watch(
  dashboardTabs,
  (tabs) => {
    if (!tabs.some((tab) => tab.key === activeTab.value)) {
      setActiveTab('overview')
    }
  },
  { immediate: true },
)

watch(
  chartPreferences,
  () => {
    persistChartSettings()
  },
  { deep: true },
)

watch(chartOrder, persistChartSettings, { deep: true })
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-slate-400 sm:text-sm sm:tracking-[0.3em]">{{ localeStore.t('common.inventory') }}</p>
          <h2 class="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{{ localeStore.t('dashboard.title') }}</h2>
          <p class="mt-2 text-sm leading-6 text-slate-500">{{ localeStore.t('dashboard.subtitle') }}</p>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="loading" class="mt-6 rounded-2xl border border-slate-200 p-6 text-slate-500">
        Loading dashboard...
      </div>

      <template v-else>
        <div class="mt-6 flex flex-wrap gap-2">
          <button
            v-for="tab in dashboardTabs"
            :key="tab.key"
            type="button"
            class="rounded-full border px-4 py-2 text-sm font-semibold transition"
            :class="activeTab === tab.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
            @click="setActiveTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="activeTab === 'overview'">
          <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Products" :value="summary.cards.products" hint="Active SKUs in catalog" />
            <StatCard title="Warehouses" :value="summary.cards.warehouses" hint="Available storage locations" />
            <StatCard title="Low Stock" :value="summary.cards.lowStockItems" hint="Items at or below reorder level" />
            <StatCard title="On Hand" :value="summary.cards.totalOnHand" hint="Total units across all warehouses" />
          </div>

          <div class="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-slate-900 sm:text-xl">Low stock reminders</h3>
                <p class="mt-1 text-sm text-slate-500">{{ tr('Prioritize products that are closest to stockout.', '优先关注最接近断货的商品。') }}</p>
              </div>
              <RouterLink
                :to="{ name: 'alerts' }"
                class="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {{ tr('Open Alerts', '打开提醒中心') }}
              </RouterLink>
            </div>
            <div class="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="item in summary.lowStockPreview"
                :key="`${item.sku}-${item.warehouse_name}`"
                class="rounded-2xl border border-amber-200 bg-white px-4 py-4"
              >
                <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ item.sku }} · {{ item.warehouse_name }}</p>
                <p class="mt-3 text-sm text-amber-700">
                  {{ tr('Current', '当前') }} {{ item.quantity }} / {{ tr('Reorder', '补货线') }} {{ item.reorder_level }}
                </p>
              </div>
              <p v-if="summary.lowStockPreview.length === 0" class="text-sm text-slate-500">{{ tr('No low-stock alert currently.', '当前没有低库存提醒。') }}</p>
            </div>
          </div>

          <div class="mt-6 rounded-3xl border border-slate-200 p-4 sm:p-5">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold text-slate-900 sm:text-xl">Recent stock movements</h3>
                <p class="mt-1 text-sm text-slate-500">Latest incoming, outgoing and transfer records.</p>
              </div>
            </div>

            <div class="mt-4 grid gap-3 md:hidden">
              <article
                v-for="movement in summary.recentMovements"
                :key="movement.id"
                class="rounded-2xl border border-slate-200 p-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <p class="font-medium text-slate-900">{{ movement.movement_type }}</p>
                  <span class="text-xs text-slate-400">{{ new Date(movement.created_at).toLocaleString() }}</span>
                </div>
                <p class="mt-2 text-sm text-slate-700">{{ movement.product_name }} · {{ movement.sku }}</p>
                <p class="mt-1 text-sm text-slate-500">Qty {{ movement.quantity }}</p>
              </article>
              <p v-if="summary.recentMovements.length === 0" class="text-sm text-slate-500">No movement data.</p>
            </div>

            <div class="mt-5 hidden overflow-x-auto md:block">
              <table class="min-w-full text-left text-sm">
                <thead class="text-slate-500">
                  <tr class="border-b border-slate-200">
                    <th class="px-3 py-3">{{ localeStore.t('table.type') }}</th>
                    <th class="px-3 py-3">{{ localeStore.t('table.product') }}</th>
                    <th class="px-3 py-3">{{ localeStore.t('table.qty') }}</th>
                    <th class="px-3 py-3">{{ localeStore.t('table.time') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="movement in summary.recentMovements"
                    :key="movement.id"
                    class="border-b border-slate-100 last:border-none"
                  >
                    <td class="px-3 py-3 font-medium text-slate-900">{{ movement.movement_type }}</td>
                    <td class="px-3 py-3">{{ movement.product_name }} · {{ movement.sku }}</td>
                    <td class="px-3 py-3">{{ movement.quantity }}</td>
                    <td class="px-3 py-3">{{ new Date(movement.created_at).toLocaleString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'charts'">
          <div class="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
                  Chart preferences
                  <HelpHint :text="tr('Choose which charts to show and how they look.', '选择要显示哪些图表，以及展示样式。')" />
                </h3>
                <p class="mt-1 text-sm text-slate-500">{{ tr('Each user can customize visible charts and chart types.', '每个用户可自定义 Dashboard 要显示哪些图表，以及图表类型。') }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                  {{ tr(`Showing ${visibleChartsCount} charts`, `当前显示 ${visibleChartsCount} 个图表`) }}
                </span>
                <button
                  type="button"
                  class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                  @click="toggleChartPanel"
                >
                  {{ chartPreferencesCollapsed ? tr('Expand', '展开') : tr('Collapse', '收起') }}
                </button>
              </div>
            </div>
            <div v-if="!chartPreferencesCollapsed" class="mt-5 grid gap-4 xl:grid-cols-3">
              <div class="rounded-3xl border border-slate-200 bg-white p-4">
                <label class="flex items-center justify-between gap-3">
                  <span class="text-sm font-medium text-slate-900">Movement trend</span>
                  <input v-model="chartPreferences.showMovementTrend" type="checkbox" class="size-4 rounded border-slate-300" />
                </label>
                <select
                  v-model="chartPreferences.movementTrendType"
                  class="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                >
                  <option value="line">Line</option>
                  <option value="bar">Bar</option>
                </select>
                <select
                  v-model="chartPreferences.movementTrendSize"
                  class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
              <div class="rounded-3xl border border-slate-200 bg-white p-4">
                <label class="flex items-center justify-between gap-3">
                  <span class="text-sm font-medium text-slate-900">Stock by category</span>
                  <input v-model="chartPreferences.showCategoryChart" type="checkbox" class="size-4 rounded border-slate-300" />
                </label>
                <select
                  v-model="chartPreferences.categoryChartType"
                  class="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                >
                  <option value="doughnut">Doughnut</option>
                  <option value="bar">Bar</option>
                </select>
                <select
                  v-model="chartPreferences.categoryChartSize"
                  class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
              <div class="rounded-3xl border border-slate-200 bg-white p-4">
                <label class="flex items-center justify-between gap-3">
                  <span class="text-sm font-medium text-slate-900">Stock by warehouse</span>
                  <input v-model="chartPreferences.showWarehouseChart" type="checkbox" class="size-4 rounded border-slate-300" />
                </label>
                <select
                  v-model="chartPreferences.warehouseChartType"
                  class="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                >
                  <option value="bar">Bar</option>
                  <option value="doughnut">Doughnut</option>
                </select>
                <select
                  v-model="chartPreferences.warehouseChartSize"
                  class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
            </div>
          </div>

          <div class="mt-6 grid gap-4 sm:gap-6 xl:grid-cols-2 2xl:grid-cols-3">
            <article
              v-for="chart in orderedVisibleCharts"
              :key="chart.key"
              draggable="true"
              class="rounded-3xl border border-slate-200 p-4 transition sm:p-5"
              :class="dragChartKey === chart.key ? 'scale-[0.99] border-brand-300 bg-brand-50' : 'bg-white'"
              @dragstart="onChartDragStart(chart.key)"
              @dragover.prevent
              @drop="onChartDrop(chart.key)"
              @dragend="dragChartKey = ''"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-lg font-semibold text-slate-900 sm:text-xl">{{ chart.title }}</h3>
                  <p class="mt-1 text-sm text-slate-500">{{ chart.description }}</p>
                </div>
                <span class="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">
                  {{ tr('Drag to reorder', '拖拽排序') }}
                </span>
              </div>
              <div class="mt-4" :class="getChartHeightClass(chart.size)">
                <component :is="chart.component" :data="chart.data" />
              </div>
            </article>
          </div>

          <div
            v-if="visibleChartsCount === 0"
            class="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500"
          >
            {{ tr('No chart is enabled. Please enable at least one chart in chart preferences.', '当前没有启用任何图表，请在上方 Chart preferences 中选择至少一个图表。') }}
          </div>
        </div>

        <div v-else-if="activeTab === 'users'">
          <div v-if="authStore.user?.role === 'ADMIN'" class="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
                  Create user
                  <HelpHint :text="tr('Create a new staff account.', '创建新的员工账号。')" />
                </h3>
                <p class="mt-1 text-sm text-slate-500">Add staff accounts and control role permissions.</p>
              </div>
              <button
                type="button"
                class="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                @click="createUserOpen = !createUserOpen"
              >
                {{ createUserOpen ? tr('Hide', '收起') : tr('Create', '新增') }}
              </button>
            </div>

            <form v-if="createUserOpen" class="mt-5 grid gap-4 sm:grid-cols-2" @submit.prevent="createUser">
              <div class="relative sm:col-span-2">
                <input v-model="userForm.fullName" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 bg-white px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
                <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
                  {{ tr('Full name', '姓名') }}
                </label>
              </div>
              <div class="relative sm:col-span-2">
                <input v-model="userForm.email" type="email" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 bg-white px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
                <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
                  Email
                </label>
              </div>
              <div class="relative">
                <input v-model="userForm.password" type="password" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 bg-white px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
                <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
                  {{ tr('Password', '密码') }}
                </label>
              </div>
              <select v-model="userForm.role" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500">
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="STAFF">Staff</option>
              </select>
              <button class="sm:col-span-2 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                {{ tr('Add User', '新增用户') }}
              </button>
            </form>
          </div>

          <div class="mt-6 rounded-3xl border border-slate-200 p-4 sm:p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-slate-900 sm:text-xl">User access list</h3>
              <input
                v-model="userSearch"
                type="text"
                :placeholder="tr('Search users', '搜索用户')"
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500 lg:w-64"
                @input="handleUserSearch"
              />
            </div>
            <div class="mt-4 space-y-3">
              <div
                v-for="userItem in summary.users"
                :key="userItem.id"
                class="rounded-2xl border border-slate-200 p-4"
              >
                <div v-if="editingUserId !== userItem.id" class="flex items-center justify-between gap-4">
                  <div>
                    <p class="font-medium text-slate-900">
                      {{ userItem.full_name }}
                      <span
                        class="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        :class="userItem.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'"
                      >
                        {{ userItem.is_active ? 'ACTIVE' : 'INACTIVE' }}
                      </span>
                    </p>
                    <p class="text-sm text-slate-500">{{ userItem.email }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      {{ userItem.role }}
                    </span>
                    <button
                      v-if="authStore.user?.role === 'ADMIN'"
                      class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      @click="startEditUser(userItem)"
                    >
                      Edit
                    </button>
                    <button
                      v-if="authStore.user?.role === 'ADMIN' && Number(authStore.user?.id) !== Number(userItem.id)"
                      class="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700"
                      :disabled="savingUserId === userItem.id"
                      @click="deleteUser(userItem)"
                    >
                      {{ savingUserId === userItem.id ? 'Deleting...' : 'Delete' }}
                    </button>
                  </div>
                </div>
                <form v-else class="space-y-3" @submit.prevent="saveUserUpdate(userItem.id)">
                  <input
                    v-model="editUserForm.fullName"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <input
                    v-model="editUserForm.email"
                    type="email"
                    class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <div class="grid gap-2 sm:grid-cols-3">
                    <select
                      v-model="editUserForm.role"
                      class="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="STAFF">Staff</option>
                    </select>
                    <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input v-model="editUserForm.isActive" type="checkbox" class="rounded border-slate-300" />
                      Active
                    </label>
                    <input
                      v-model="editUserForm.password"
                      type="password"
                      placeholder="New password (optional)"
                      class="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      :disabled="savingUserId === userItem.id"
                    >
                      {{ savingUserId === userItem.id ? 'Saving...' : 'Save' }}
                    </button>
                    <button
                      type="button"
                      class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      @click="cancelEditUser"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
              <p v-if="summary.users.length === 0" class="text-sm text-slate-500">
                User list is only visible for admin and manager roles.
              </p>
            </div>
            <PaginationBar :pagination="userPagination" @change="loadDashboard" />
          </div>
        </div>
      </template>
    </section>
  </AppLayout>
</template>
