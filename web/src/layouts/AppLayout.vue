<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const mobileMenuOpen = ref(false)
const sidebarCollapsed = ref(localStorage.getItem('inventory_sidebar_collapsed') === 'true')
const canGoBack = ref(false)
const navGroupState = ref({})
const navGroupStorageKey = computed(() => `inventory_sidebar_groups_${authStore.user?.role || 'STAFF'}`)

const navItems = [
  { label: 'Dashboard', routeName: 'dashboard', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'DB', icon: 'dashboard', group: 'Overview' },
  { label: 'Alerts', routeName: 'alerts', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'AL', icon: 'alerts', group: 'Operations' },
  { label: 'Inventory', routeName: 'inventory', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'IV', icon: 'inventory', group: 'Operations' },
  { label: 'Stock Counts', routeName: 'stock-counts', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'SC', icon: 'counts', group: 'Operations' },
  { label: 'Categories', routeName: 'categories', roles: ['ADMIN', 'MANAGER'], shortLabel: 'CT', icon: 'categories', group: 'Master Data' },
  { label: 'Warehouses', routeName: 'warehouses', roles: ['ADMIN', 'MANAGER'], shortLabel: 'WH', icon: 'warehouses', group: 'Master Data' },
  { label: 'Products', routeName: 'products', roles: ['ADMIN', 'MANAGER'], shortLabel: 'PD', icon: 'products', group: 'Master Data' },
  { label: 'Reports', routeName: 'reports', roles: ['ADMIN', 'MANAGER'], shortLabel: 'RP', icon: 'reports', group: 'Analytics' },
  { label: 'Audit Logs', routeName: 'audit-logs', roles: ['ADMIN', 'MANAGER'], shortLabel: 'AU', icon: 'audit', group: 'Governance' },
  { label: 'Access Guide', routeName: 'access-guide', roles: ['ADMIN', 'MANAGER', 'STAFF'], shortLabel: 'RG', icon: 'guide', group: 'Support' },
]

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

const breadcrumbs = computed(() => [
  { label: 'Workspace', key: 'workspace' },
  { label: currentNavItem.value?.group || 'Inventory', key: 'group' },
  { label: currentNavItem.value?.label || 'Dashboard', key: 'current' },
])

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
  router.push({ name: routeName })
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('inventory_sidebar_collapsed', String(sidebarCollapsed.value))
}

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
  if (window.innerWidth >= 1280) {
    mobileMenuOpen.value = false
  }
}

function logout() {
  authStore.clearAuth()
  router.push({ name: 'login' })
}

onMounted(() => {
  canGoBack.value = window.history.length > 1
  navGroupState.value = JSON.parse(localStorage.getItem(navGroupStorageKey.value) || '{}')
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

watch(
  () => route.fullPath,
  () => {
    canGoBack.value = window.history.length > 1
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
      v-if="mobileMenuOpen"
      class="fixed inset-0 z-40 bg-slate-950/40 xl:hidden"
      @click="mobileMenuOpen = false"
    />

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-80 flex-col bg-slate-950 px-4 py-5 text-white shadow-2xl transition-transform duration-200 xl:hidden"
      :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <p class="text-xs uppercase tracking-[0.35em] text-slate-500">Inventory</p>
          <h1 class="mt-2 text-xl font-semibold">Control Center</h1>
        </div>
        <button class="rounded-xl border border-slate-700 p-2 text-sm" @click="mobileMenuOpen = false">
          <AppIcon name="chevronLeft" class="h-4 w-4" />
        </button>
      </div>

      <nav class="mt-5 space-y-4 overflow-y-auto">
        <section v-for="group in navGroups" :key="group.label" class="space-y-2">
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 transition hover:bg-slate-900"
            @click="toggleGroup(group.label)"
          >
            <span>{{ group.label }}</span>
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
                <span class="block truncate text-sm font-medium">{{ item.label }}</span>
                <span class="block truncate text-[11px] text-slate-400">{{ item.group }}</span>
              </span>
            </button>
          </div>
        </section>
      </nav>

      <div class="mt-5 rounded-3xl bg-slate-900 p-4">
        <p class="text-xs uppercase tracking-[0.25em] text-slate-500">Current User</p>
        <p class="mt-3 font-medium">{{ authStore.user?.full_name || authStore.user?.fullName }}</p>
        <p class="text-sm text-slate-400">{{ authStore.user?.role }}</p>
        <button
          class="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          @click="logout"
        >
          Logout
        </button>
      </div>
    </aside>

    <div class="flex min-h-screen w-full">
      <aside
        class="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5 text-white xl:flex"
        :class="sidebarCollapsed ? 'w-24' : 'w-64'"
      >
        <div class="flex items-start justify-between gap-3">
          <div v-if="!sidebarCollapsed">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-500">Inventory</p>
            <h1 class="mt-2 text-2xl font-semibold">Control Center</h1>
            <p class="mt-2 text-sm text-slate-400">Responsive workspace for daily stock operations.</p>
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
              <span>{{ group.label }}</span>
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
                  <span class="block truncate text-sm font-medium">{{ item.label }}</span>
                  <span class="block truncate text-[11px] text-slate-400">{{ item.group }}</span>
                </span>
                <span
                  v-if="sidebarCollapsed"
                  class="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100"
                >
                  {{ item.label }}
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
            class="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            @click="logout"
          >
            {{ sidebarCollapsed ? 'Out' : 'Logout' }}
          </button>
        </div>
      </aside>

      <main class="min-w-0 flex-1 px-2 py-2 sm:px-3 lg:px-4">
        <div class="sticky top-0 z-30 mb-3 rounded-3xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur xl:hidden">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-[0.3em] text-slate-400">{{ currentNavItem?.label || 'Inventory' }}</p>
              <p class="truncate text-lg font-semibold text-slate-900">{{ authStore.user?.role }} workspace</p>
            </div>
            <button
              class="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              @click="mobileMenuOpen = true"
            >
              <span class="flex items-center gap-2">
                <AppIcon name="menu" class="h-4 w-4" />
                <span>Menu</span>
              </span>
            </button>
          </div>
        </div>

        <div class="mb-3 hidden rounded-3xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur xl:block">
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
                  <span>Back</span>
                </button>
                <span
                  v-for="item in breadcrumbs"
                  :key="item.key"
                  class="flex items-center gap-2"
                >
                  <span>{{ item.label }}</span>
                  <span v-if="item.key !== 'current'" class="text-slate-300">/</span>
                </span>
              </div>
              <div class="mt-3 flex items-center gap-3">
                <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <AppIcon :name="currentNavItem?.icon || 'guide'" class="h-5 w-5" />
                </div>
                <div class="min-w-0">
                  <p class="text-lg font-semibold text-slate-900">{{ currentNavItem?.label || 'Dashboard' }}</p>
                  <p class="text-sm text-slate-500">{{ currentNavItem?.group || 'Inventory workspace' }}</p>
                </div>
              </div>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p class="text-xs uppercase tracking-[0.25em] text-slate-400">{{ authStore.user?.role }}</p>
              <p class="mt-1 text-sm font-medium text-slate-900">{{ authStore.user?.full_name || authStore.user?.fullName }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-[28px] bg-white p-4 shadow-sm sm:p-5 lg:p-6">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
