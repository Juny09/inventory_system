import { createRouter, createWebHistory } from 'vue-router'

const DashboardPage = () => import('../pages/DashboardPage.vue')
const LoginPage = () => import('../pages/LoginPage.vue')
const CategoriesPage = () => import('../pages/CategoriesPage.vue')
const WarehousesPage = () => import('../pages/WarehousesPage.vue')
const ProductsPage = () => import('../pages/ProductsPage.vue')
const ProductDetailPage = () => import('../pages/ProductDetailPage.vue')
const InventoryPage = () => import('../pages/InventoryPage.vue')
const ReportsPage = () => import('../pages/ReportsPage.vue')
const AlertsPage = () => import('../pages/AlertsPage.vue')
const StockCountsPage = () => import('../pages/StockCountsPage.vue')
const AuditLogsPage = () => import('../pages/AuditLogsPage.vue')
const AccessGuidePage = () => import('../pages/AccessGuidePage.vue')

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { guestOnly: true },
  },
  {
    path: '/',
    name: 'dashboard',
    component: DashboardPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/categories',
    name: 'categories',
    component: CategoriesPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'] },
  },
  {
    path: '/warehouses',
    name: 'warehouses',
    component: WarehousesPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'] },
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: AlertsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/products',
    name: 'products',
    component: ProductsPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'] },
  },
  {
    path: '/products/:id',
    name: 'product-detail',
    component: ProductDetailPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'], navKey: 'products' },
  },
  {
    path: '/inventory',
    name: 'inventory',
    component: InventoryPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/stock-counts',
    name: 'stock-counts',
    component: StockCountsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/reports',
    name: 'reports',
    component: ReportsPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'] },
  },
  {
    path: '/audit-logs',
    name: 'audit-logs',
    component: AuditLogsPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'] },
  },
  {
    path: '/access-guide',
    name: 'access-guide',
    component: AccessGuidePage,
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 简单前置守卫：先检查登录，再检查角色
router.beforeEach((to) => {
  const rawUser = localStorage.getItem('inventory_user')
  const token = localStorage.getItem('inventory_token')
  const user = rawUser ? JSON.parse(rawUser) : null

  if (to.meta.requiresAuth && !token) {
    return { name: 'login' }
  }

  if (to.meta.guestOnly && token) {
    return { name: 'dashboard' }
  }

  if (to.meta.roles?.length && !to.meta.roles.includes(user?.role)) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
