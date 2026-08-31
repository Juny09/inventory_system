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
const topNavRef = ref(null)
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

// 新手引导完成回调：参数 _payload 预留，后续如需回传步骤信息可直接启用
function handleOnboardingComplete(_payload) {
  onboardingOpen.value = false
}

const navItems = [
  { label: 'Dashboard', routeName: 'dashboard', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'DB', icon: 'dashboard', group: 'Overview' },
  { label: 'Alerts', routeName: 'alerts', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'AL', icon: 'alerts', group: 'Operations' },
  { label: 'Inventory', routeName: 'inventory', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'IV', icon: 'inventory', group: 'Operations' },
  { label: 'Mobile Scanner', routeName: 'mobile-scanner', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'MS', icon: 'inventory', group: 'Operations' },
  { label: 'Orders', routeName: 'orders', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'OR', icon: 'reports', group: 'Operations' },
  { label: 'Stock Counts', routeName: 'stock-counts', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'SC', icon: 'counts', group: 'Operations' },
  { label: 'Marketplace', routeName: 'marketplace-center', roles: ['ADMIN', 'MANAGER'], shortLabel: 'MP', icon: 'alerts', group: 'Operations' },
  { label: 'Categories', routeName: 'categories', roles: ['ADMIN', 'MANAGER'], shortLabel: 'CT', icon: 'categories', group: 'Master Data' },
  { label: 'Brands', routeName: 'brands', roles: ['ADMIN', 'MANAGER'], shortLabel: 'BR', icon: 'categories', group: 'Master Data' },
  { label: 'Warehouses', routeName: 'warehouses', roles: ['ADMIN', 'MANAGER'], shortLabel: 'WH', icon: 'warehouses', group: 'Master Data' },
  { label: 'Products', routeName: 'products', roles: ['ADMIN', 'MANAGER'], shortLabel: 'PD', icon: 'products', group: 'Master Data' },
  { label: 'Suppliers', routeName: 'suppliers', roles: ['ADMIN', 'MANAGER'], shortLabel: 'SP', icon: 'guide', group: 'Master Data' },
  { label: 'Supplier Payments', routeName: 'supplier-payments', roles: ['ADMIN', 'MANAGER'], shortLabel: 'SP', icon: 'guide', group: 'Master Data' },
  { label: 'Supplier Documents', routeName: 'supplier-documents', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'SD', icon: 'guide', group: 'Master Data' },
  { label: 'Doc Upload', routeName: 'document-upload', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'DU', icon: 'guide', group: 'Master Data' },
  { label: 'Reports', routeName: 'reports', roles: ['ADMIN', 'MANAGER'], shortLabel: 'RP', icon: 'reports', group: 'Analytics' },
  { label: 'Supplier Stats', routeName: 'supplier-stats', roles: ['ADMIN', 'MANAGER'], shortLabel: 'SS', icon: 'reports', group: 'Analytics' },
  { label: 'Company Costs', routeName: 'company-costs', roles: ['ADMIN', 'MANAGER'], shortLabel: 'CC', icon: 'reports', group: 'Analytics' },
  { label: 'Customer Billing', routeName: 'customer-billing', roles: ['ADMIN', 'MANAGER'], shortLabel: 'CB', icon: 'reports', group: 'Analytics' },
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
  'Mobile Scanner': { en: 'Mobile Scanner', cn: '手机扫码' },
  Orders: { en: 'Orders', cn: '订单' },
  'Stock Counts': { en: 'Stock Counts', cn: '盘点单' },
  Marketplace: { en: 'Marketplace', cn: '电商连接' },
  Categories: { en: 'Categories', cn: '分类' },
  Brands: { en: 'Brands', cn: '品牌' },
  Warehouses: { en: 'Warehouses', cn: '仓库' },
  Products: { en: 'Products', cn: '商品' },
  Suppliers: { en: 'Suppliers', cn: '供应商' },
  'Supplier Payments': { en: 'Supplier Payments', cn: '供应商还账' },
  'Supplier Documents': { en: 'Supplier Documents', cn: '供应商单据' },
  'Doc Upload': { en: 'Doc Upload', cn: '文档上传' },
  Reports: { en: 'Reports', cn: '报表' },
  'Supplier Stats': { en: 'Supplier Stats', cn: '供应商统计' },
  'Company Costs': { en: 'Company Costs', cn: '公司成本' },
  'Customer Billing': { en: 'Customer Billing', cn: '客户账单' },
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
const pageSidebarOpen = ref(false)

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

function notificationBadge(type) {
  switch (type) {
    case 'PAYMENT_DUE':
      return { label: localeStore.locale === 'en' ? 'Due' : '到期', cls: 'bg-amber-100 text-amber-700' }
    case 'PAYMENT_OVERDUE':
      return { label: localeStore.locale === 'en' ? 'Overdue' : '逾期', cls: 'bg-rose-100 text-rose-700' }
    case 'COST_CHANGE':
      return { label: localeStore.locale === 'en' ? 'Cost' : '成本', cls: 'bg-indigo-100 text-indigo-700' }
    default:
      return null
  }
}

async function handleNotificationClick(item) {
  const type = item.notification_type || item.type
  await markNotificationRead(item.id)
  notificationsOpen.value = false
  if (type === 'PAYMENT_DUE' || type === 'PAYMENT_OVERDUE') {
    router.push({ name: 'supplier-payments', query: { tab: 'schedules' } })
  }
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
  const target = event.target

  if (notificationsOpen.value) {
    if (notificationsRef.value && target instanceof Node && !notificationsRef.value.contains(target)) {
      notificationsOpen.value = false
    }
  }

  if (openNavGroup.value) {
    if (topNavRef.value && target instanceof Node && !topNavRef.value.contains(target)) {
      openNavGroup.value = ''
    }
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
    pageSidebarOpen.value = false
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
  <!-- ========== TraeWork 设计系统应用框架：最外层用 bg-base-default（纯白） ========== -->
  <div class="min-h-screen bg-tw-bg-base-default text-tw-text-default">
    <!-- ========== 移动端侧边栏遮罩（TraeWork 浅灰 UI，遮罩用 text-default 的 32% 透明） ========== -->
    <div
      v-if="navMode === 'sidebar' && mobileMenuOpen"
      class="fixed inset-0 z-40 bg-tw-text-default/30 lg:hidden"
      @click="mobileMenuOpen = false"
    />

    <!-- ===================== 【移动端侧边栏】：沿用桌面端 visual，用 bg-menu 而不是老的 slate-950 黑底 ===================== -->
    <aside
      v-if="navMode === 'sidebar'"
      class="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-80 flex-col bg-tw-bg-menu border-r border-tw-border-l1 px-tw-16 py-tw-20 text-tw-text-default shadow-lg transition-transform duration-200 lg:hidden"
      :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- 顶部品牌区 + 关闭按钮 -->
      <div class="flex items-start justify-between gap-tw-12 border-b border-tw-border-l1 pb-tw-16">
        <div class="min-w-0">
          <p class="tw-body-sm text-tw-text-tertiary uppercase tracking-[0.35em]">
            {{ localeStore.t('common.inventory') }}
          </p>
          <h1 class="mt-tw-8 tw-heading-md">{{ localeStore.t('layout.controlCenter') }}</h1>
          <p class="mt-tw-4 tw-body-md text-tw-text-tertiary">{{ localeStore.t('layout.mobileDesc') }}</p>
        </div>
        <!-- 关闭按钮：ghost 样式，符合 TraeWork ds-btn--ghost -->
        <button type="button" class="ds-btn ds-btn--ghost ds-btn--icon ds-btn--md" @click="mobileMenuOpen = false">
          <AppIcon name="chevronLeft" class="icon icon--16" />
        </button>
      </div>

      <!-- 导航组：和桌面端共用结构（TraeWork UI Kit dashboard 的 nav-item 风格） -->
      <nav class="mt-tw-16 space-y-tw-16 overflow-y-auto">
        <section v-for="group in navGroups" :key="group.label" class="space-y-tw-4">
          <!-- 分组标题：text-tertiary + 大写 + 字间距 -->
          <button
            type="button"
            class="flex w-full items-center justify-between px-tw-8 py-tw-6 text-left tw-body-sm uppercase tracking-[0.2em] text-tw-text-tertiary rounded-tw-8 hover:bg-tw-bg-overlay-l1 transition"
            @click="toggleGroup(group.label)"
          >
            <span>{{ localizedGroupLabel(group.label) }}</span>
            <AppIcon
              name="chevronLeft"
              class="icon icon--12 -rotate-90 transition-transform"
              :class="isGroupCollapsed(group.label) ? 'rotate-180' : 'rotate-90'"
            />
          </button>
          <div v-if="!isGroupCollapsed(group.label)" class="space-y-tw-2">
            <button
              v-for="item in group.items"
              :key="item.routeName"
              type="button"
              class="nav-item flex w-full items-center gap-tw-10 px-tw-10 py-tw-8 text-left transition"
              :class="
                activeRouteName === item.routeName
                  ? 'nav-item--active'
                  : 'nav-item--idle'
              "
              @click="selectNav(item.routeName)"
            >
              <span class="nav-item__icon">
                <AppIcon :name="item.icon" class="icon icon--16" />
              </span>
              <span class="nav-item__content">
                <span class="nav-item__label">{{ localizedNavLabel(item.label) }}</span>
                <span class="nav-item__sub">{{ localizedGroupLabel(item.group) }}</span>
              </span>
            </button>
          </div>
        </section>
      </nav>

      <!-- 用户卡片：用 ds-card 包一层 -->
      <div class="mt-tw-20 ds-card">
        <p class="tw-body-sm text-tw-text-tertiary uppercase tracking-[0.25em]">
          {{ localeStore.t('layout.currentUser') }}
        </p>
        <div class="mt-tw-12 flex items-center gap-tw-10">
          <span class="ds-avatar ds-avatar--lg">{{ userInitials }}</span>
          <div class="min-w-0">
            <p class="truncate tw-body-base text-tw-text-default">
              {{ authStore.user?.full_name || authStore.user?.fullName }}
            </p>
            <p class="truncate tw-body-sm text-tw-text-tertiary">{{ authStore.user?.role }}</p>
          </div>
        </div>
        <button
          type="button"
          class="mt-tw-16 w-full ds-btn ds-btn--secondary ds-btn--lg"
          @click="toggleUserActions"
        >
          {{ userActionsHidden ? localeStore.t('layout.showActions') : localeStore.t('layout.hideActions') }}
        </button>
        <div v-if="!userActionsHidden" class="mt-tw-12 grid grid-cols-2 gap-tw-8">
          <button
            type="button"
            class="ds-btn ds-btn--secondary ds-btn--lg"
            @click="localeStore.toggleLocale()"
          >
            {{ localeStore.locale === 'en' ? localeStore.t('layout.switchToChinese') : localeStore.t('layout.switchToEnglish') }}
          </button>
          <button
            type="button"
            class="ds-btn ds-btn--primary ds-btn--lg"
            @click="logout"
          >
            {{ localeStore.t('common.logout') }}
          </button>
        </div>
      </div>
    </aside>

    <!-- ===================== 主布局：sidebar（桌面端） + workspace ===================== -->
    <div class="flex min-h-screen w-full">
      <!-- ===================== 【桌面端侧边栏】：TraeWork 风格 bg-menu，不再是极暗 slate-950 ===================== -->
      <aside
        v-if="navMode === 'sidebar'"
        class="sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-tw-border-l1 bg-tw-bg-menu text-tw-text-default lg:flex"
        :class="sidebarCollapsed ? 'w-24' : 'w-64'"
      >
        <!-- 品牌头 + 折叠按钮 -->
        <div class="flex items-start justify-between gap-tw-12 px-tw-20 pt-tw-20">
          <div v-if="!sidebarCollapsed" class="min-w-0">
            <p class="tw-body-sm text-tw-text-tertiary uppercase tracking-[0.35em]">
              {{ localeStore.t('common.inventory') }}
            </p>
            <h1 class="mt-tw-8 tw-heading-md">{{ localeStore.t('layout.controlCenter') }}</h1>
            <p class="mt-tw-4 tw-body-md text-tw-text-tertiary">{{ localeStore.t('layout.mobileDesc') }}</p>
          </div>
          <!-- 折叠时直接显示头像占位 -->
          <span v-else class="ds-avatar ds-avatar--lg">{{ userInitials }}</span>
          <button
            type="button"
            class="ds-btn ds-btn--ghost ds-btn--icon ds-btn--md"
            title="Toggle sidebar"
            @click="toggleSidebar"
          >
            <AppIcon
              name="chevronLeft"
              class="icon icon--16 transition-transform"
              :class="sidebarCollapsed ? 'rotate-180' : ''"
            />
          </button>
        </div>

        <!-- 导航列表：与 UI Kit dashboard 保持一致 -->
        <nav class="mt-tw-20 space-y-tw-20 overflow-y-auto px-tw-12">
          <section v-for="group in navGroups" :key="group.label" class="space-y-tw-4">
            <!-- 分组标题：折叠态下不显示文字 -->
            <button
              v-if="!sidebarCollapsed"
              type="button"
              class="flex w-full items-center justify-between px-tw-8 py-tw-6 text-left tw-body-sm uppercase tracking-[0.2em] text-tw-text-tertiary rounded-tw-8 hover:bg-tw-bg-overlay-l1 transition"
              @click="toggleGroup(group.label)"
            >
              <span>{{ localizedGroupLabel(group.label) }}</span>
              <AppIcon
                name="chevronLeft"
                class="icon icon--12 -rotate-90 transition-transform"
                :class="isGroupCollapsed(group.label) ? 'rotate-180' : 'rotate-90'"
              />
            </button>

            <div
              v-if="sidebarCollapsed || !isGroupCollapsed(group.label)"
              class="space-y-tw-2"
            >
              <button
                v-for="item in group.items"
                :key="item.routeName"
                type="button"
                :title="sidebarCollapsed ? `${group.label} · ${item.label}` : undefined"
                class="nav-item group relative flex w-full items-center gap-tw-10 px-tw-10 py-tw-8 text-left transition"
                :class="
                  activeRouteName === item.routeName
                    ? 'nav-item--active'
                    : 'nav-item--idle'
                "
                @click="selectNav(item.routeName)"
              >
                <span class="nav-item__icon">
                  <AppIcon :name="item.icon" class="icon icon--16" />
                </span>
                <span v-if="!sidebarCollapsed" class="nav-item__content">
                  <span class="nav-item__label">{{ localizedNavLabel(item.label) }}</span>
                  <span class="nav-item__sub">{{ localizedGroupLabel(item.group) }}</span>
                </span>
                <!-- 折叠态：hover tooltip 用 bg-tooltip，符合 TraeWork token -->
                <span
                  v-if="sidebarCollapsed"
                  class="pointer-events-none absolute left-full top-1/2 z-20 ml-tw-12 -translate-y-1/2 rounded-tw-8 bg-tw-bg-tooltip px-tw-10 py-tw-8 tw-body-sm text-tw-text-default opacity-0 shadow-lg transition group-hover:opacity-100 whitespace-nowrap"
                >
                  {{ localizedNavLabel(item.label) }}
                </span>
              </button>
            </div>
          </section>
        </nav>

        <!-- 底部用户卡片 -->
        <div class="sidebar__footer px-tw-16 pb-tw-20">
          <div class="ds-card">
            <div class="flex items-center gap-tw-10">
              <span class="ds-avatar">{{ userInitials }}</span>
              <div v-if="!sidebarCollapsed" class="min-w-0">
                <p class="truncate tw-body-base text-tw-text-default">
                  {{ authStore.user?.full_name || authStore.user?.fullName }}
                </p>
                <p class="truncate tw-body-sm text-tw-text-tertiary">{{ authStore.user?.role }}</p>
              </div>
            </div>
            <button
              v-if="!sidebarCollapsed"
              type="button"
              class="mt-tw-16 w-full ds-btn ds-btn--secondary ds-btn--lg"
              @click="toggleUserActions"
            >
              {{ userActionsHidden ? localeStore.t('layout.showActions') : localeStore.t('layout.hideActions') }}
            </button>
            <div v-if="!userActionsHidden" class="mt-tw-12 space-y-tw-8">
              <button
                type="button"
                class="w-full ds-btn ds-btn--secondary ds-btn--lg"
                @click="localeStore.toggleLocale()"
              >
                {{ localeStore.locale === 'en' ? localeStore.t('layout.switchToChinese') : localeStore.t('layout.switchToEnglish') }}
              </button>
              <button
                type="button"
                class="w-full ds-btn ds-btn--primary ds-btn--lg"
                @click="logout"
              >
                {{ sidebarCollapsed ? 'Out' : localeStore.t('common.logout') }}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- ===================== 工作区：Topbar（TraeWork 整行吸顶） + 页面内容 ===================== -->
      <div class="workspace flex-1 min-w-0">
        <!-- ========== 移动端顶栏（lg:hidden） ========== -->
        <div class="sticky top-0 z-30 mb-tw-20 lg:hidden border-b border-tw-border-l1 bg-tw-bg-base-default">
          <div class="flex items-center justify-between gap-tw-12 px-tw-16 py-tw-12">
            <div class="min-w-0">
              <p class="tw-body-sm text-tw-text-tertiary uppercase tracking-[0.2em]">
                {{ localizedNavLabel(currentNavItem?.label || 'Inventory') }}
              </p>
              <p class="tw-heading-2xs">
                {{ authStore.user?.role }} {{ localeStore.t('common.workspace').toLowerCase() }}
              </p>
            </div>
            <div class="flex items-center gap-tw-6">
              <button
                type="button"
                class="ds-btn ds-btn--secondary ds-btn--md"
                @click="localeStore.toggleLocale()"
              >
                {{ localeStore.locale === 'en' ? '中文' : 'EN' }}
              </button>
              <button
                type="button"
                class="ds-btn ds-btn--secondary ds-btn--md"
                @click="logout"
              >
                {{ localeStore.t('common.logout') }}
              </button>
              <button
                v-if="navMode === 'sidebar'"
                type="button"
                class="ds-btn ds-btn--secondary ds-btn--icon ds-btn--md"
                @click="mobileMenuOpen = true"
              >
                <AppIcon name="menu" class="icon icon--16" />
              </button>
            </div>
          </div>
          <!-- 移动端 tab 式导航（navbar 模式） -->
          <div v-if="navMode === 'navbar'" class="flex flex-wrap gap-tw-8 px-tw-16 pb-tw-12">
            <button
              v-for="group in navGroups"
              :key="`mobile-nav-group-${group.label}`"
              type="button"
              class="ds-btn ds-btn--sm"
              :class="openMobileNavGroup === group.label ? 'ds-btn--primary' : 'ds-btn--secondary'"
              @click="toggleMobileNavGroup(group.label)"
            >
              {{ localizedGroupLabel(group.label) }}
            </button>
          </div>
          <div v-if="openMobileNavGroup" class="flex flex-wrap gap-tw-8 px-tw-16 pb-tw-16">
            <button
              v-for="item in navGroups.find((g) => g.label === openMobileNavGroup)?.items || []"
              :key="`mobile-subnav-${item.routeName}`"
              type="button"
              class="ds-btn ds-btn--sm"
              :class="activeRouteName === item.routeName ? 'ds-btn--brand' : 'ds-btn--tertiary'"
              @click="selectNav(item.routeName)"
            >
              {{ localizedNavLabel(item.label) }}
            </button>
          </div>
        </div>

        <!-- ========== 桌面端 Topbar：TraeWork 整行吸顶 + 分隔线（不再是旧的"悬浮卡片"） ========== -->
        <div class="topbar hidden lg:flex">
          <div class="flex flex-1 flex-col items-start justify-center gap-tw-8 min-w-0">
            <!-- 面包屑（TraeWork .ds-breadcrumb 官方类） -->
            <nav class="ds-breadcrumb">
              <button
                v-if="canGoBack"
                type="button"
                class="ds-btn ds-btn--ghost ds-btn--sm mr-tw-4"
                @click="goBack"
              >
                <AppIcon name="chevronLeft" class="icon icon--12" />
                <span>{{ localeStore.t('common.back') }}</span>
              </button>
              <template v-for="(item, idx) in breadcrumbs" :key="item.key">
                <a v-if="item.routeName" @click.prevent="selectNav(item.routeName)" href="#">
                  {{ item.label }}
                </a>
                <span v-else class="ds-breadcrumb__current">{{ item.label }}</span>
                <span v-if="idx !== breadcrumbs.length - 1" class="ds-breadcrumb__sep">/</span>
              </template>
            </nav>

            <!-- 页面标题区（page header） -->
            <div class="flex items-center gap-tw-12 w-full">
              <div class="flex h-tw-40 w-tw-40 items-center justify-center rounded-tw-12 bg-tw-bg-overlay-l2 text-tw-text-default">
                <AppIcon :name="currentNavItem?.icon || 'guide'" class="icon icon--20" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-tw-8 flex-wrap">
                  <h1 class="tw-heading-md m-0">
                    {{ localizedNavLabel(currentNavItem?.label || 'Dashboard') }}
                  </h1>
                  <HelpHint :text="guideTooltip" @click="startOnboarding" />
                  <button
                    type="button"
                    class="ds-btn ds-btn--secondary ds-btn--sm"
                    @click="startOnboarding"
                  >
                    <AppIcon name="guide" class="icon icon--14" />
                    {{ localeStore.t('common.quickGuide') }}
                  </button>
                </div>
                <p class="mt-tw-4 tw-body-md text-tw-text-tertiary m-0">
                  {{ localizedGroupLabel(currentNavItem?.group || 'Inventory workspace') }}
                </p>
              </div>
            </div>

            <!-- navbar 模式：顶部二级组导航 -->
            <nav v-if="navMode === 'navbar'" ref="topNavRef" class="w-full">
              <div class="flex flex-wrap gap-tw-8">
                <button
                  v-for="group in navGroups"
                  :key="`topnav-group-${group.label}`"
                  type="button"
                  class="ds-btn ds-btn--md"
                  :class="openNavGroup === group.label ? 'ds-btn--primary' : 'ds-btn--ghost'"
                  @click="toggleNavGroup(group.label)"
                >
                  {{ localizedGroupLabel(group.label) }}
                </button>
              </div>
              <div v-if="openNavGroup" class="mt-tw-8 ds-card p-tw-8">
                <button
                  v-for="item in navGroups.find((g) => g.label === openNavGroup)?.items || []"
                  :key="`topnav-${item.routeName}`"
                  type="button"
                  class="flex w-full items-center justify-between rounded-tw-8 px-tw-10 py-tw-8 tw-body-base transition"
                  :class="
                    activeRouteName === item.routeName
                      ? 'bg-tw-bg-brand-popup text-tw-text-brand'
                      : 'text-tw-text-default hover:bg-tw-bg-overlay-l1'
                  "
                  @click="selectNav(item.routeName)"
                >
                  <span>{{ localizedNavLabel(item.label) }}</span>
                  <span class="tw-body-sm text-tw-text-tertiary">{{ localizedGroupLabel(item.group) }}</span>
                </button>
              </div>
            </nav>
          </div>

          <!-- Topbar 右侧：通知/设置/语言/退出 -->
          <div class="flex items-stretch gap-tw-8">
            <div ref="notificationsRef" class="relative">
              <button
                type="button"
                class="ds-btn ds-btn--secondary ds-btn--lg"
                @click="toggleNotifications"
              >
                <AppIcon name="bell" class="icon icon--16" />
                <span class="hidden xl:inline">{{ localeStore.t('common.alerts') }}</span>
              </button>
              <!-- 未读角标：用 TraeWork .ds-tag--danger（小面积语义色） -->
              <span
                v-if="notificationsStore.unreadCount > 0"
                class="absolute -right-1 -top-1 flex h-tw-18 min-w-tw-18 items-center justify-center rounded-tw-full bg-tw-status-error px-tw-6 py-tw-2 [font-size:10px] leading-none font-semibold text-white"
              >
                {{ notificationsStore.unreadCount > 99 ? '99+' : notificationsStore.unreadCount }}
              </span>

              <!-- 通知下拉：TraeWork .ds-menu 风格 -->
              <div
                v-if="notificationsOpen"
                class="absolute right-0 top-[calc(100%+8px)] z-[90] w-[360px] ds-menu"
              >
                <div class="flex items-center justify-between gap-tw-8 px-tw-8 py-tw-4">
                  <p class="ds-card__title m-0">{{ localeStore.t('common.notifications') }}</p>
                  <div class="flex items-center gap-tw-6">
                    <button
                      type="button"
                      class="ds-btn ds-btn--tertiary ds-btn--sm"
                      :disabled="notificationsStore.loading"
                      @click="refreshNotifications"
                    >
                      {{ notificationsStore.loading ? localeStore.t('common.loading') : localeStore.t('common.refresh') }}
                    </button>
                    <button
                      type="button"
                      class="ds-btn ds-btn--primary ds-btn--sm"
                      @click="openNotificationsCenter"
                    >
                      {{ localeStore.t('common.view') }}
                    </button>
                  </div>
                </div>
                <div class="ds-menu__divider"></div>
                <div class="flex flex-col gap-tw-4 max-h-[420px] overflow-y-auto px-tw-4 pb-tw-4">
                  <button
                    v-for="item in notificationsStore.items.slice(0, 5)"
                    :key="item.id"
                    type="button"
                    class="ds-menu__item flex-col items-start gap-tw-4"
                    @click="handleNotificationClick(item)"
                  >
                    <div class="flex w-full items-start justify-between gap-tw-8">
                      <span class="tw-body-base text-tw-text-default">
                        {{ item.title }}
                      </span>
                      <span
                        v-if="notificationBadge(item.notification_type || item.type)"
                        class="ds-tag text-tw-text-secondary"
                        :class="{
                          'ds-tag--warning': (notificationBadge(item.notification_type || item.type)?.label || '').toLowerCase().includes('due') || (notificationBadge(item.notification_type || item.type)?.label || '').toLowerCase().includes('到期'),
                          'ds-tag--danger': (notificationBadge(item.notification_type || item.type)?.label || '').toLowerCase().includes('overdue') || (notificationBadge(item.notification_type || item.type)?.label || '').toLowerCase().includes('逾期'),
                          'ds-tag--brand': !( (notificationBadge(item.notification_type || item.type)?.label || '').toLowerCase().includes('due') || (notificationBadge(item.notification_type || item.type)?.label || '').toLowerCase().includes('到期') || (notificationBadge(item.notification_type || item.type)?.label || '').toLowerCase().includes('overdue') || (notificationBadge(item.notification_type || item.type)?.label || '').toLowerCase().includes('逾期') ),
                        }"
                      >
                        {{ notificationBadge(item.notification_type || item.type).label }}
                      </span>
                    </div>
                    <p class="m-0 line-clamp-2 tw-body-sm text-tw-text-tertiary w-full text-left">
                      {{ item.message }}
                    </p>
                  </button>
                  <p v-if="notificationsStore.items.length === 0" class="px-tw-8 py-tw-8 tw-body-md text-tw-text-tertiary m-0">
                    {{ localeStore.t('layout.noUnreadNotifications') }}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="ds-btn ds-btn--secondary ds-btn--icon ds-btn--lg"
              :title="localeStore.t('common.settings')"
              @click="router.push({ name: 'settings' })"
            >
              <AppIcon name="guide" class="icon icon--16" />
            </button>

            <button
              type="button"
              class="ds-btn ds-btn--secondary ds-btn--sm"
              :title="localeStore.locale === 'en' ? localeStore.t('layout.switchToChinese') : localeStore.t('layout.switchToEnglish')"
              @click="localeStore.toggleLocale()"
            >
              {{ localeStore.locale === 'en' ? '中文' : 'EN' }}
            </button>

            <div class="topbar__divider"></div>

            <!-- 用户菜单入口（TraeWork .user-menu 风格） -->
            <button type="button" class="user-menu" @click="toggleUserActions">
              <span class="ds-avatar">{{ userInitials }}</span>
              <div class="hidden xl:flex flex-col items-start leading-none gap-tw-2">
                <span class="tw-body-base text-tw-text-default leading-none">
                  {{ authStore.user?.full_name || authStore.user?.fullName }}
                </span>
                <span class="tw-body-sm text-tw-text-tertiary leading-none">
                  {{ authStore.user?.role }}
                </span>
              </div>
            </button>
            <button
              type="button"
              class="ds-btn ds-btn--primary ds-btn--lg"
              @click="logout"
            >
              {{ localeStore.t('common.logout') }}
            </button>
          </div>
        </div>

        <!-- ========== 页面内容容器：max-width 1280，居中，px 用 spacer-32 ========== -->
        <div class="main px-tw-16 pb-tw-32 sm:px-tw-24 lg:px-tw-32 lg:pt-tw-24">
          <div
            v-if="navMode === 'navbar' && hasPageSidebar"
            class="grid gap-tw-24"
            :class="pageSidebarOpen ? 'lg:grid-cols-[1fr_360px]' : 'lg:grid-cols-1'"
          >
            <div class="min-w-0">
              <div class="mb-tw-20 hidden lg:flex justify-end">
                <button
                  type="button"
                  class="ds-btn ds-btn--secondary ds-btn--lg"
                  @click="pageSidebarOpen = !pageSidebarOpen"
                >
                  {{ pageSidebarOpen ? (localeStore.locale === 'en' ? 'Hide tools' : '收起工具') : (localeStore.locale === 'en' ? 'Show tools' : '显示工具') }}
                </button>
              </div>

              <!-- 移动端 Tools 折叠：用 ds-card 包一层 -->
              <details class="mb-tw-20 ds-card lg:hidden">
                <summary class="cursor-pointer list-none tw-body-base text-tw-text-default">
                  {{ localeStore.locale === 'en' ? 'Tools' : '工具' }}
                </summary>
                <div class="mt-tw-12">
                  <slot name="sidebar" />
                </div>
              </details>
              <slot />
            </div>
            <aside v-if="pageSidebarOpen" class="hidden lg:block">
              <div class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto ds-card">
                <slot name="sidebar" />
              </div>
            </aside>
          </div>
          <template v-else>
            <slot />
          </template>
        </div>
      </div>
    </div>
  </div>

  <OnboardingTour
    :open="onboardingOpen"
    :title="localizedNavLabel(currentNavItem?.label || 'Dashboard')"
    :steps="onboardingSteps"
    @complete="handleOnboardingComplete"
  />
</template>

<!-- ========== TraeWork 局部样式：侧栏/顶栏/导航项。所有值都走设计系统 tokens ========== -->
<style scoped>
/* 侧栏：TraeWork UI Kit dashboard 的 .sidebar 结构 */
.sidebar {
  background: var(--bg-menu);
  color: var(--text-default);
}

/* 导航项：与 UI Kit 中 .nav-item 完全对齐。
   - idle：hover overlay-l1
   - active：bg-overlay-l2 + text-default（小面积强调，不直接把整行涂成紫色品牌色，符合 TraeWork "品牌色小面积用" 原则）*/
.nav-item {
  border-radius: var(--radius-8);
  min-height: 36px;
}
.nav-item--idle {
  color: var(--text-secondary);
}
.nav-item--idle:hover {
  background: var(--bg-overlay-l1);
  color: var(--text-default);
}
.nav-item--active {
  background: var(--bg-overlay-l2);
  color: var(--text-default);
  font-weight: var(--font-weight-medium);
}
.nav-item__icon {
  width: 20px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  color: inherit;
}
.nav-item__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item__label {
  font-size: var(--body-base-font-size);
  line-height: var(--body-base-line-height);
  font-weight: var(--font-weight-regular);
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-item--active .nav-item__label {
  font-weight: var(--font-weight-medium);
}
.nav-item__sub {
  font-size: var(--body-sm-font-size);
  line-height: var(--body-sm-line-height);
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 顶栏：TraeWork UI Kit 标准 .topbar —— 整行吸顶 + 底部细边，不再是旧的"悬浮 rounded-3xl 卡片"*/
.topbar {
  position: sticky;
  top: 0;
  z-index: 80;
  min-height: 64px;
  padding: var(--spacer-16) var(--spacer-32);
  background: var(--bg-base-default);
  border-bottom: 1px solid var(--border-neutral-l1);
  gap: var(--spacer-24);
  align-items: stretch;
}
.topbar__divider {
  width: 1px;
  background: var(--border-neutral-l1);
  margin: 0 var(--spacer-4);
}

/* 工作区 / 主内容区（与 UI Kit dashboard 对齐） */
.workspace {
  min-width: 0;
  background: var(--bg-base-default);
}
.main {
  max-width: 1280px;
  margin: 0 auto;
  padding-top: var(--spacer-32);
}

/* 用户菜单入口：TraeWork 官方 .user-menu */
.user-menu {
  display: inline-flex;
  align-items: center;
  gap: var(--spacer-8);
  min-height: 32px;
  padding: 0 var(--spacer-8);
  border: 0;
  border-radius: var(--radius-8);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.user-menu:hover {
  background: var(--bg-overlay-l1);
  color: var(--text-default);
}

/* AppIcon 的 icon icon--NN 尺寸统一，与 TraeWork components.css 的 ds-btn .icon--NN 一致 */
:deep(.icon) {
  display: inline-block;
  flex: 0 0 auto;
  color: currentColor;
}
:deep(.icon--12) { width: var(--icon-size-12); height: var(--icon-size-12); }
:deep(.icon--14) { width: var(--icon-size-14); height: var(--icon-size-14); }
:deep(.icon--16) { width: var(--icon-size-16); height: var(--icon-size-16); }
:deep(.icon--20) { width: var(--icon-size-20); height: var(--icon-size-20); }
:deep(.icon--24) { width: var(--icon-size-24); height: var(--icon-size-24); }

/* 让 Element Plus/Template 自带的 <summary>::marker 不显示箭头（Chrome/Safari 默认有） */
details summary::-webkit-details-marker {
  display: none;
}
</style>
