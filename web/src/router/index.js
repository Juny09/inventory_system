import { createRouter, createWebHistory } from 'vue-router'

const DashboardPage = () => import('../pages/DashboardPage.vue')
const LoginPage = () => import('../pages/LoginPage.vue')
const CategoriesPage = () => import('../pages/CategoriesPage.vue')
const WarehousesPage = () => import('../pages/WarehousesPage.vue')
const ProductsPage = () => import('../pages/ProductsPage.vue')
const ProductFormPage = () => import('../pages/ProductFormPage.vue')
const ProductDetailPage = () => import('../pages/ProductDetailPage.vue')
const SuppliersPage = () => import('../pages/SuppliersPage.vue')
const SupplierFormPage = () => import('../pages/SupplierFormPage.vue')
const SupplierDetailPage = () => import('../pages/SupplierDetailPage.vue')
const SettingsPage = () => import('../pages/SettingsPage.vue')
const InventoryPage = () => import('../pages/InventoryPage.vue')
const ReportsPage = () => import('../pages/ReportsPage.vue')
const AlertsPage = () => import('../pages/AlertsPage.vue')
const StockCountsPage = () => import('../pages/StockCountsPage.vue')
const AuditLogsPage = () => import('../pages/AuditLogsPage.vue')
const AccessGuidePage = () => import('../pages/AccessGuidePage.vue')
const TutorialCenterPage = () => import('../pages/TutorialCenterPage.vue')
const TodoPage = () => import('../pages/TodoPage.vue')
const MarketplaceCenterPage = () => import('../pages/MarketplaceCenterPage.vue')
const MarketplaceOAuthCallbackPage = () => import('../pages/MarketplaceOAuthCallbackPage.vue')
const OrdersPage = () => import('../pages/OrdersPage.vue')
const OrderDetailPage = () => import('../pages/OrderDetailPage.vue')
const BankStatementsPage = () => import('../pages/BankStatementsPage.vue')

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
    path: '/products/form',
    name: 'product-form',
    component: ProductFormPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'], navKey: 'products' },
  },
  {
    path: '/products/:id',
    name: 'product-detail',
    component: ProductDetailPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'], navKey: 'products' },
  },
  {
    path: '/suppliers',
    name: 'suppliers',
    component: SuppliersPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'] },
  },
  {
    path: '/suppliers/form',
    name: 'supplier-form',
    component: SupplierFormPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'], navKey: 'suppliers' },
  },
  {
    path: '/suppliers/:id',
    name: 'supplier-detail',
    component: SupplierDetailPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'], navKey: 'suppliers' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  },
  {
    path: '/inventory',
    name: 'inventory',
    component: InventoryPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/orders',
    name: 'orders',
    component: OrdersPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  },
  {
    path: '/orders/:id',
    name: 'order-detail',
    component: OrderDetailPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER', 'STAFF'], navKey: 'orders' },
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
  {
    path: '/tutorial-center',
    name: 'tutorial-center',
    component: TutorialCenterPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/todos',
    name: 'todos',
    component: TodoPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/bank-statements',
    name: 'bank-statements',
    component: BankStatementsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/marketplace-center',
    name: 'marketplace-center',
    component: MarketplaceCenterPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'] },
  },
  {
    path: '/marketplace/oauth/callback/:channel',
    name: 'marketplace-oauth-callback',
    component: MarketplaceOAuthCallbackPage,
    meta: { requiresAuth: true, roles: ['ADMIN', 'MANAGER'] },
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
