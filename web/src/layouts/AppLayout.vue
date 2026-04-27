<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import HelpHint from '../components/HelpHint.vue'
import OnboardingTour from '../components/OnboardingTour.vue'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'
import { useNotificationsStore } from '../stores/notifications'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const localeStore = useLocaleStore()
const slots = useSlots()
const mobileMenuOpen = ref(false)
const navMode = ref('navbar')
const storedSidebarCollapsed = localStorage.getItem('inventory_sidebar_collapsed')
const sidebarCollapsed = ref(storedSidebarCollapsed === null ? navMode.value === 'navbar' : storedSidebarCollapsed === 'true')
const userActionsHidden = ref(localStorage.getItem('inventory_user_actions_hidden') !== 'false')
const canGoBack = ref(false)
const navGroupState = ref({})
const navGroupStorageKey = computed(() => `inventory_sidebar_groups_${authStore.user?.role || 'STAFF'}`)
const openNavGroup = ref('')
const openMobileNavGroup = ref('')
const notificationsOpen = ref(false)
const notificationsStore = useNotificationsStore()
const notificationsRef = ref(null)
const onboardingOpen = ref(false)

const guideTooltip = computed(() => localeStore.t('common.quickGuide'))

const onboardingMap = {
  dashboard: [
    {
      title: { en: 'Overview', cn: '总览' },
      text: { en: 'Check key stats and recent movements. Use tabs to switch Charts and Users.', cn: '查看关键指标与最近流水，使用 Tab 切换到图表与用户管理。' },
    },
    {
      title: { en: 'Charts', cn: '图表' },
      text: { en: 'Open Charts tab to customize visible charts and drag to reorder.', cn: '在 Charts 里选择显示哪些图表，并支持拖拽排序。' },
    },
  ],
  products: [
    {
      title: { en: 'Search & filters', cn: '搜索与筛选' },
      text: { en: 'Use filters to narrow down products. Table headers support multi-language.', cn: '使用筛选快速定位商品，表格表头支持多语言。' },
    },
    {
      title: { en: 'Edit permissions', cn: '编辑权限' },
      text: { en: 'Edit is for Admin/Manager; delete is Admin only.', cn: '编辑仅限管理员/经理；删除仅限管理员。' },
    },
  ],
  inventory: [
    {
      title: { en: 'Inventory by warehouse', cn: '按仓库库存' },
      text: { en: 'Left shows inventory rows. Use Tools panel for filters and movements.', cn: '左侧显示库存列表，右侧 Tools 用于筛选和出入库操作。' },
    },
    {
      title: { en: 'Transactions', cn: '流水' },
      text: { en: 'Recent transactions are listed below for quick audits.', cn: '下方展示最近流水，方便快速核对。' },
    },
  ],
  alerts: [
    {
      title: { en: 'Low stock', cn: '低库存' },
      text: { en: 'Track low stock by warehouse and assign status.', cn: '按仓库查看低库存并更新状态。' },
    },
    {
      title: { en: 'Price changes', cn: '成本变动' },
      text: { en: 'Cost price change notifications can be marked as read.', cn: '成本变动提醒可批量标记已读。' },
    },
  ],
  reports: [
    {
      title: { en: 'Exports', cn: '导出' },
      text: { en: 'Export CSV/PDF for inventory and movements.', cn: '支持导出库存与流水的 CSV/PDF。' },
    },
  ],
  'stock-counts': [
    {
      title: { en: 'Count sheet', cn: '盘点单' },
      text: { en: 'Create a sheet, enter counted qty, then apply differences.', cn: '生成盘点单，录入实盘数量，再应用差异。' },
    },
  ],
  settings: [
    {
      title: { en: 'Preferences', cn: '偏好设置' },
      text: { en: 'Currency preference is saved to your account and applied next login.', cn: '货币单位会保存到账号，下次登录自动生效。' },
    },
  ],
  todos: [
    {
      title: { en: 'Track work', cn: '跟踪工作' },
      text: { en: 'Add tasks, mark done, and clear completed items. Saved locally per user.', cn: '添加待办、勾选完成、清理已完成；按用户本地保存。' },
    },
  ],
  'bank-statements': [
    {
      title: { en: 'Upload', cn: '上传' },
      text: { en: 'Upload your monthly bank statement in PDF, image, or Excel format.', cn: '上传每个月的银行对账单，支持 PDF、图片、Excel。' },
    },
    {
      title: { en: 'History', cn: '历史记录' },
      text: { en: 'Download or delete previous uploads from the history list.', cn: '在历史记录里下载或删除已上传文件。' },
    },
  ],
}

const onboardingSteps = computed(() => {
  const key = String(activeRouteName.value || '')
  const entries = onboardingMap[key] || []
  return entries.map((item) => ({
    title: item.title?.[localeStore.locale] || item.title?.en || '',
    text: item.text?.[localeStore.locale] || item.text?.en || '',
  }))
})

function startOnboarding() {
  if (onboardingSteps.value.length) {
    onboardingOpen.value = true
    return
  }
  router.push({ name: 'tutorial-center' })
}

function handleOnboardingComplete(payload) {
  onboardingOpen.value = false
}

const navItems = [
  { label: 'Dashboard', routeName: 'dashboard', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'DB', icon: 'dashboard', group: 'Overview' },
  { label: 'Alerts', routeName: 'alerts', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'AL', icon: 'alerts', group: 'Operations' },
  { label: 'Inventory', routeName: 'inventory', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'IV', icon: 'inventory', group: 'Operations' },
  { label: 'Orders', routeName: 'orders', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'OR', icon: 'reports', group: 'Operations' },
  { label: 'Stock Counts', routeName: 'stock-counts', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'SC', icon: 'counts', group: 'Operations' },
  { label: 'Marketplace', routeName: 'marketplace-center', roles: ['ADMIN', 'MANAGER'], shortLabel: 'MP', icon: 'alerts', group: 'Operations' },
  { label: 'Categories', routeName: 'categories', roles: ['ADMIN', 'MANAGER'], shortLabel: 'CT', icon: 'categories', group: 'Master Data' },
  { label: 'Warehouses', routeName: 'warehouses', roles: ['ADMIN', 'MANAGER'], shortLabel: 'WH', icon: 'warehouses', group: 'Master Data' },
  { label: 'Products', routeName: 'products', roles: ['ADMIN', 'MANAGER'], shortLabel: 'PD', icon: 'products', group: 'Master Data' },
  { label: 'Suppliers', routeName: 'suppliers', roles: ['ADMIN', 'MANAGER'], shortLabel: 'SP', icon: 'guide', group: 'Master Data' },
  { label: 'Reports', routeName: 'reports', roles: ['ADMIN', 'MANAGER'], shortLabel: 'RP', icon: 'reports', group: 'Analytics' },
  { label: 'Bank Statements', routeName: 'bank-statements', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'BS', icon: 'reports', group: 'Analytics' },
  { label: 'Audit Logs', routeName: 'audit-logs', roles: ['ADMIN', 'MANAGER'], shortLabel: 'AU', icon: 'audit', group: 'Governance' },
  { label: 'Settings', routeName: 'settings', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'ST', icon: 'guide', group: 'Governance' },
  { label: 'Access Guide', routeName: 'access-guide', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'RG', icon: 'guide', group: 'Support' },
  { label: 'Tutorial Center', routeName: 'tutorial-center', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'TC', icon: 'guide', group: 'Support' },
  { label: 'To-do', routeName: 'todos', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'TD', icon: 'counts', group: 'Support' },
]

const navLabelMap = {
  Dashboard: { en: 'Dashboard', cn: '仪表盘' },
  Alerts: { en: 'Alerts', cn: '提醒中心' },
  Inventory: { en: 'Inventory', cn: '库存' },
  Orders: { en: 'Orders', cn: '订单' },
  'Stock Counts': { en: 'Stock Counts', cn: '盘点单' },
  Marketplace: { en: 'Marketplace', cn: '电商连接' },
  Categories: { en: 'Categories', cn: '分类' },
  Warehouses: { en: 'Warehouses', cn: '仓库' },
  Products: { en: 'Products', cn: '商品' },
  Suppliers: { en: 'Suppliers', cn: '供应商' },
  Reports: { en: 'Reports', cn: '报表' },
  'Bank Statements': { en: 'Bank Statements', cn: '银行对账单' },
  'Audit Logs': { en: 'Audit Logs', cn: '审计日志' },
  Settings: { en: 'Settings', cn: '设置' },
  'Access Guide': { en: 'Access Guide', cn: '权限说明' },
  'Tutorial Center': { en: 'Tutorial Center', cn: '教学中心' },
  'To-do': { en: 'To-do', cn: '待办' },
}

const groupLabelMap = {
  Overview: { en: 'Overview', cn: '总览' },
  Operations: { en: 'Operations', cn: '运营' },
  'Master Data': { en: 'Master Data', cn: '主数据' },
  Analytics: { en: 'Analytics', cn: '分析' },
  Governance: { en: 'Governance', cn: '治理' },
  Support: { en: 'Support', cn: '支持' },
}

const visibleNavItems = computed(() =>
  navItems.filter((item) => item.roles.includes(authStore.user?.role || 'STAFF')),
)

const navGroups = computed(() => {
  const groups = []

  visibleNavItems.value.forEach((item) => {
    const targetGroup = groups.find((group) => group.label === item.group)

    if (targetGroup) {
      targetGroup.items.push(item)
      return
    }

    groups.push({
      label: item.group,
      items: [item],
    })
  })

  return groups
})

const activeRouteName = computed(() => route.meta?.navKey || route.name)

const currentNavItem = computed(
  () => visibleNavItems.value.find((item) => item.routeName === activeRouteName.value) || visibleNavItems.value[0],
)

const breadcrumbs = computed(() => {
  const groupLabel = currentNavItem.value?.group || 'Inventory'
  const groupRouteName =
    visibleNavItems.value.find((item) => item.group === groupLabel)?.routeName ||
    visibleNavItems.value[0]?.routeName ||
    'dashboard'

  return [
    { label: localeStore.t('common.workspace'), key: 'workspace', routeName: 'dashboard' },
    { label: localizedGroupLabel(groupLabel), key: 'group', routeName: groupRouteName },
    { label: localizedNavLabel(currentNavItem.value?.label || 'Dashboard'), key: 'current' },
  ]
})

const userInitials = computed(() => {
  const name = authStore.user?.full_name || authStore.user?.fullName || 'Inventory User'
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
})

function selectNav(routeName) {
  mobileMenuOpen.value = false
  openNavGroup.value = ''
  openMobileNavGroup.value = ''
  router.push({ name: routeName })
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('inventory_sidebar_collapsed', String(sidebarCollapsed.value))
}

function toggleNavGroup(groupLabel) {
  openNavGroup.value = openNavGroup.value === groupLabel ? '' : groupLabel
}

function toggleMobileNavGroup(groupLabel) {
  openMobileNavGroup.value = openMobileNavGroup.value === groupLabel ? '' : groupLabel
}

const hasPageSidebar = computed(() => Boolean(slots.sidebar))

function isGroupCollapsed(groupLabel) {
  return Boolean(navGroupState.value[groupLabel])
}

function toggleGroup(groupLabel) {
  navGroupState.value = {
    ...navGroupState.value,
    [groupLabel]: !navGroupState.value[groupLabel],
  }
  localStorage.setItem(navGroupStorageKey.value, JSON.stringify(navGroupState.value))
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({ name: 'dashboard' })
}

function handleResize() {
  if (window.innerWidth >= 1024) {
    mobileMenuOpen.value = false
  }
}

function logout() {
  authStore.clearAuth()
  router.push({ name: 'login' })
}

async function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value
  if (notificationsOpen.value && authStore.token && !notificationsStore.loadedOnce) {
    await notificationsStore.refresh().catch(() => {})
  }
}

async function refreshNotifications() {
  await notificationsStore.refresh().catch(() => {})
}

async function markNotificationRead(notificationId) {
  await notificationsStore.markAsRead(notificationId).catch(() => {})
}

function openNotificationsCenter() {
  notificationsOpen.value = false
  router.push({ name: 'alerts', query: { tab: 'price-change' } })
}

function toggleUserActions() {
  userActionsHidden.value = !userActionsHidden.value
  localStorage.setItem('inventory_user_actions_hidden', String(userActionsHidden.value))
}

function localizedNavLabel(label) {
  return navLabelMap[label]?.[localeStore.locale] || label
}

function localizedGroupLabel(label) {
  return groupLabelMap[label]?.[localeStore.locale] || label
}

function handleGlobalClick(event) {
  if (!notificationsOpen.value) return
  const target = event.target
  if (!notificationsRef.value || !(target instanceof Node)) return
  if (!notificationsRef.value.contains(target)) {
    notificationsOpen.value = false
  }
}

onMounted(() => {
  canGoBack.value = window.history.length > 1
  navGroupState.value = JSON.parse(localStorage.getItem(navGroupStorageKey.value) || '{}')
  window.addEventListener('resize', handleResize)
  window.addEventListener('click', handleGlobalClick)
  if (authStore.token) {
    notificationsStore.refresh().catch(() => {})
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', handleGlobalClick)
})

watch(
  () => route.fullPath,
  () => {
    canGoBack.value = window.history.length > 1
    mobileMenuOpen.value = false
    openNavGroup.value = ''
    openMobileNavGroup.value = ''
    notificationsOpen.value = false
    onboardingOpen.value = false
  },
)

watch(
  navGroupStorageKey,
  (storageKey) => {
    navGroupState.value = JSON.parse(localStorage.getItem(storageKey) || '{}')
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-screen bg-slate-100">
    <div
      v-if="navMode === 'sidebar' && mobileMenuOpen"
      class="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
      @click="mobileMenuOpen = false"
    />

    <aside
      v-if="navMode === 'sidebar'"
      class="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-80 flex-col bg-slate-950 px-4 py-4 text-white shadow-2xl transition-transform duration-200 lg:hidden"
      :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.2em] text-slate-500">{{ localeStore.t('common.inventory') }}</p>
          <h1 class="mt-1 text-lg font-semibold">{{ localeStore.t('layout.controlCenter') }}</h1>
        </div>
        <button class="rounded-xl border border-slate-700 p-2 text-sm" @click="mobileMenuOpen = false">
          <AppIcon name="chevronLeft" class="h-4 w-4" />
        </button>
      </div>

      <nav class="mt-5 space-y-4 overflow-y-auto">
        <section v-for="group in navGroups" :key="group.label" class="space-y-2">
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 transition hover:bg-slate-900"
            @click="toggleGroup(group.label)"
          >
            <span>{{ localizedGroupLabel(group.label) }}</span>
            <AppIcon
              name="chevronLeft"
              class="h-3.5 w-3.5 -rotate-90 transition-transform"
              :class="isGroupCollapsed(group.label) ? 'rotate-180' : 'rotate-90'"
            />
          </button>
          <div v-if="!isGroupCollapsed(group.label)" class="space-y-2">
            <button
              v-for="item in group.items"
              :key="item.routeName"
              class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition"
              :class="
                activeRouteName === item.routeName
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
              "
              @click="selectNav(item.routeName)"
            >
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                <AppIcon :name="item.icon" class="h-4 w-4" />
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ localizedNavLabel(item.label) }}</span>
                <span class="block truncate text-[11px] text-slate-400">{{ localizedGroupLabel(item.group) }}</span>
              </span>
            </button>
          </div>
        </section>
      </nav>

      <div class="mt-5 rounded-3xl bg-slate-900 p-4">
        <p class="text-xs uppercase tracking-[0.25em] text-slate-500">{{ localeStore.t('layout.currentUser') }}</p>
        <p class="mt-3 font-medium">{{ authStore.user?.full_name || authStore.user?.fullName }}</p>
        <p class="text-sm text-slate-400">{{ authStore.user?.role }}</p>
        <button
          class="mt-4 w-full rounded-2xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
          @click="toggleUserActions"
        >
          {{ userActionsHidden ? localeStore.t('layout.showActions') : localeStore.t('layout.hideActions') }}
        </button>
        <div v-if="!userActionsHidden" class="mt-3 grid grid-cols-2 gap-2">
          <button
            class="rounded-2xl border border-slate-700 px-2 py-3 text-xs font-semibold text-white"
            @click="localeStore.toggleLocale()"
          >
            {{ localeStore.locale === 'en' ? localeStore.t('layout.switchToChinese') : localeStore.t('layout.switchToEnglish') }}
          </button>
          <button
            class="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            @click="logout"
          >
            {{ localeStore.t('common.logout') }}
          </button>
        </div>
      </div>
    </aside>

    <div class="flex min-h-screen w-full">
      <aside
        v-if="navMode === 'sidebar'"
        class="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5 text-white lg:flex"
        :class="sidebarCollapsed ? 'w-24' : 'w-64'"
      >
        <div class="flex items-start justify-between gap-3">
          <div v-if="!sidebarCollapsed">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-500">{{ localeStore.t('common.inventory') }}</p>
            <h1 class="mt-2 text-2xl font-semibold">{{ localeStore.t('layout.controlCenter') }}</h1>
            <p class="mt-2 text-sm text-slate-400">{{ localeStore.t('layout.mobileDesc') }}</p>
          </div>
          <div v-else class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold">
            {{ userInitials }}
          </div>
          <button class="rounded-xl border border-slate-700 p-2 text-sm" @click="toggleSidebar">
            <AppIcon
              name="chevronLeft"
              class="h-4 w-4 transition-transform"
              :class="sidebarCollapsed ? 'rotate-180' : ''"
            />
          </button>
        </div>

        <nav class="mt-6 space-y-4 overflow-y-auto">
          <section v-for="group in navGroups" :key="group.label" class="space-y-2">
            <button
              v-if="!sidebarCollapsed"
              type="button"
              class="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 transition hover:bg-slate-900"
              @click="toggleGroup(group.label)"
            >
              <span>{{ localizedGroupLabel(group.label) }}</span>
              <AppIcon
                name="chevronLeft"
                class="h-3.5 w-3.5 -rotate-90 transition-transform"
                :class="isGroupCollapsed(group.label) ? 'rotate-180' : 'rotate-90'"
              />
            </button>
            <div
              v-if="sidebarCollapsed || !isGroupCollapsed(group.label)"
              class="space-y-2"
            >
              <button
                v-for="item in group.items"
                :key="item.routeName"
                :title="sidebarCollapsed ? `${group.label} · ${item.label}` : undefined"
                class="group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition duration-200"
                :class="
                  activeRouteName === item.routeName
                    ? 'translate-x-1 bg-brand-600 text-white shadow-lg shadow-brand-950/30 ring-1 ring-white/10'
                    : 'bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white'
                "
                @click="selectNav(item.routeName)"
              >
                <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <AppIcon :name="item.icon" class="h-4 w-4" />
                </span>
                <span v-if="!sidebarCollapsed" class="min-w-0">
                  <span class="block truncate text-sm font-medium">{{ localizedNavLabel(item.label) }}</span>
                  <span class="block truncate text-[11px] text-slate-400">{{ localizedGroupLabel(item.group) }}</span>
                </span>
                <span
                  v-if="sidebarCollapsed"
                  class="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100"
                >
                  {{ localizedNavLabel(item.label) }}
                </span>
              </button>
            </div>
          </section>
        </nav>

        <div class="mt-auto rounded-3xl bg-slate-900 p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-sm font-semibold">
              {{ userInitials }}
            </div>
            <div v-if="!sidebarCollapsed" class="min-w-0">
              <p class="truncate text-sm font-medium">{{ authStore.user?.full_name || authStore.user?.fullName }}</p>
              <p class="truncate text-xs text-slate-400">{{ authStore.user?.role }}</p>
            </div>
          </div>
          <button
            v-if="!sidebarCollapsed"
            class="mt-4 w-full rounded-2xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
            @click="toggleUserActions"
          >
            {{ userActionsHidden ? localeStore.t('layout.showActions') : localeStore.t('layout.hideActions') }}
          </button>
          <div v-if="!userActionsHidden" class="mt-3 space-y-3">
            <button
              class="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-white"
              @click="localeStore.toggleLocale()"
            >
              {{ localeStore.locale === 'en' ? localeStore.t('layout.switchToChinese') : localeStore.t('layout.switchToEnglish') }}
            </button>
            <button
              class="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
              @click="logout"
            >
              {{ sidebarCollapsed ? 'Out' : localeStore.t('common.logout') }}
            </button>
          </div>
        </div>
      </aside>

      <main class="min-w-0 flex-1 px-1 py-1 sm:px-3 lg:px-4">
        <div class="sticky top-0 z-30 mb-2 rounded-3xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur lg:hidden">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[11px] uppercase tracking-[0.15em] text-slate-400">{{ localizedNavLabel(currentNavItem?.label || 'Inventory') }}</p>
              <p class="text-base font-semibold text-slate-900">{{ authStore.user?.role }} {{ localeStore.t('common.workspace').toLowerCase() }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                @click="localeStore.toggleLocale()"
              >
                {{ localeStore.locale === 'en' ? localeStore.t('layout.switchToChinese') : localeStore.t('layout.switchToEnglish') }}
              </button>
              <button
                class="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                @click="logout"
              >
                {{ localeStore.t('common.logout') }}
              </button>
              <button
                v-if="navMode === 'sidebar'"
                class="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                @click="mobileMenuOpen = true"
              >
                <span class="flex items-center gap-2">
                  <AppIcon name="menu" class="h-4 w-4" />
                  <span class="hidden sm:inline">{{ localeStore.t('common.menu') }}</span>
                </span>
              </button>
            </div>
          </div>
          <div v-if="navMode === 'navbar'" class="mt-3 space-y-2">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="group in navGroups"
                :key="`mobile-nav-group-${group.label}`"
                class="rounded-full border px-3 py-1.5 text-xs font-semibold"
                :class="
                  openMobileNavGroup === group.label
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                "
                @click="toggleMobileNavGroup(group.label)"
              >
                {{ localizedGroupLabel(group.label) }}
              </button>
            </div>
            <div v-if="openMobileNavGroup" class="flex flex-wrap gap-2">
              <button
                v-for="item in navGroups.find((g) => g.label === openMobileNavGroup)?.items || []"
                :key="`mobile-subnav-${item.routeName}`"
                class="rounded-full border px-3 py-1.5 text-xs font-semibold"
                :class="
                  activeRouteName === item.routeName
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-700'
                "
                @click="selectNav(item.routeName)"
              >
                {{ localizedNavLabel(item.label) }}
              </button>
            </div>
          </div>
        </div>

        <div class="sticky top-0 z-[80] mb-3 hidden rounded-3xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur lg:block">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                <button
                  v-if="canGoBack"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-[11px] font-semibold tracking-[0.2em] text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  @click="goBack"
                >
                  <AppIcon name="chevronLeft" class="h-3.5 w-3.5" />
                  <span>{{ localeStore.t('common.back') }}</span>
                </button>
                <span v-for="item in breadcrumbs" :key="item.key" class="flex items-center gap-2">
                  <button
                    v-if="item.routeName"
                    type="button"
                    class="text-slate-400 transition hover:text-slate-900"
                    @click="selectNav(item.routeName)"
                  >
                    {{ item.label }}
                  </button>
                  <span v-else>{{ item.label }}</span>
                  <span v-if="item.key !== 'current'" class="text-slate-300">/</span>
                </span>
              </div>
              <div class="mt-3 flex items-center gap-3">
                <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <AppIcon :name="currentNavItem?.icon || 'guide'" class="h-5 w-5" />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-lg font-semibold text-slate-900">{{ localizedNavLabel(currentNavItem?.label || 'Dashboard') }}</p>
                    <HelpHint :text="guideTooltip" @click="startOnboarding" />
                    <button
                      type="button"
                      class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      @click="startOnboarding"
                    >
                      {{ localeStore.t('common.quickGuide') }}
                    </button>
                  </div>
                  <p class="text-sm text-slate-500">{{ localizedGroupLabel(currentNavItem?.group || 'Inventory workspace') }}</p>
                </div>
              </div>
              <nav v-if="navMode === 'navbar'" class="mt-4 space-y-2">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="group in navGroups"
                    :key="`topnav-group-${group.label}`"
                    class="rounded-full border px-4 py-2 text-sm font-semibold transition"
                    :class="
                      openNavGroup === group.label
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    "
                    @click="toggleNavGroup(group.label)"
                  >
                    {{ localizedGroupLabel(group.label) }}
                  </button>
                </div>
                <div v-if="openNavGroup" class="rounded-2xl border border-slate-200 bg-white p-2">
                  <button
                    v-for="item in navGroups.find((g) => g.label === openNavGroup)?.items || []"
                    :key="`topnav-${item.routeName}`"
                    class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition"
                    :class="
                      activeRouteName === item.routeName
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    "
                    @click="selectNav(item.routeName)"
                  >
                    <span>{{ localizedNavLabel(item.label) }}</span>
                    <span class="text-xs text-slate-400">{{ localizedGroupLabel(item.group) }}</span>
                  </button>
                </div>
              </nav>
            </div>
            <div class="space-y-2 text-right">
              <div class="rounded-2xl bg-slate-50 px-4 py-3">
                <p class="text-xs uppercase tracking-[0.25em] text-slate-400">{{ authStore.user?.role }}</p>
                <p class="mt-1 text-sm font-medium text-slate-900">{{ authStore.user?.full_name || authStore.user?.fullName }}</p>
              </div>
              <div class="flex flex-col gap-2">
                <div class="grid grid-cols-3 gap-2">
                  <div ref="notificationsRef" class="relative">
                    <button
                      type="button"
                      class="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                      @click="toggleNotifications"
                    >
                      <AppIcon name="bell" class="h-4 w-4" />
                      <span class="hidden sm:inline">{{ localeStore.t('common.alerts') }}</span>
                    </button>
                    <span
                      v-if="notificationsStore.unreadCount > 0"
                      class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                    >
                      {{ notificationsStore.unreadCount > 99 ? '99+' : notificationsStore.unreadCount }}
                    </span>

                    <div
                      v-if="notificationsOpen"
                      class="absolute right-0 top-11 z-[90] w-80 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl"
                    >
                      <div class="flex items-center justify-between gap-3 px-2">
                        <p class="text-sm font-semibold text-slate-900">{{ localeStore.t('common.notifications') }}</p>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                            :disabled="notificationsStore.loading"
                            @click="refreshNotifications"
                          >
                            {{ notificationsStore.loading ? localeStore.t('common.loading') : localeStore.t('common.refresh') }}
                          </button>
                          <button
                            type="button"
                            class="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                            @click="openNotificationsCenter"
                          >
                            {{ localeStore.t('common.view') }}
                          </button>
                        </div>
                      </div>

                      <div class="mt-3 space-y-2">
                        <button
                          v-for="item in notificationsStore.items.slice(0, 5)"
                          :key="item.id"
                          type="button"
                          class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50"
                          @click="markNotificationRead(item.id)"
                        >
                          <p class="text-sm font-semibold text-slate-900">{{ item.title }}</p>
                          <p class="mt-1 line-clamp-2 text-xs text-slate-500">{{ item.message }}</p>
                        </button>
                        <p v-if="notificationsStore.items.length === 0" class="px-2 text-sm text-slate-500">
                          {{ localeStore.t('layout.noUnreadNotifications') }}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                    @click="router.push({ name: 'settings' })"
                  >
                    {{ localeStore.t('common.settings') }}
                  </button>
                  <button
                    class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                    @click="localeStore.toggleLocale()"
                  >
                    {{ localeStore.locale === 'en' ? '中文' : 'EN' }}
                  </button>
                </div>
                <button
                  class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                  @click="logout"
                >
                  {{ localeStore.t('common.logout') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-[28px] bg-white p-4 shadow-sm sm:p-5 lg:p-6">
          <div v-if="navMode === 'navbar' && hasPageSidebar" class="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div class="min-w-0">
              <details class="mb-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:hidden">
                <summary class="cursor-pointer list-none text-sm font-semibold text-slate-900">
                  {{ localeStore.locale === 'en' ? 'Tools' : '工具' }}
                </summary>
                <div class="mt-4">
                  <slot name="sidebar" />
                </div>
              </details>
              <slot />
            </div>
            <aside class="hidden lg:block">
              <div class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <slot name="sidebar" />
              </div>
            </aside>
          </div>
          <template v-else>
            <slot />
          </template>
        </div>
      </main>
    </div>
  </div>

  <OnboardingTour
    :open="onboardingOpen"
    :title="localizedNavLabel(currentNavItem?.label || 'Dashboard')"
    :steps="onboardingSteps"
    @complete="handleOnboardingComplete"
  />
</template>
