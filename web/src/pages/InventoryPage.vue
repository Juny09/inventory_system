<script setup>
import { onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const inventory = ref([])
const products = ref([])
const warehouses = ref([])
const categories = ref([])
const transactions = ref([])
const errorMessage = ref('')
const loading = ref(false)
const inventorySearch = ref('')
const transactionSearch = ref('')
const inventoryFilters = reactive({
  categoryId: '',
  warehouseId: '',
  lowStockOnly: false,
})
const transactionFilters = reactive({
  movementType: 'all',
})
const inventoryPagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})
const transactionPagination = ref({
  total: 0,
  page: 1,
  pageSize: 6,
  totalPages: 1,
})

const stockInForm = reactive({
  productId: '',
  warehouseId: '',
  quantity: 1,
  referenceNo: '',
  notes: '',
})

const stockOutForm = reactive({
  productId: '',
  warehouseId: '',
  quantity: 1,
  referenceNo: '',
  notes: '',
})

const transferForm = reactive({
  productId: '',
  sourceWarehouseId: '',
  destinationWarehouseId: '',
  quantity: 1,
  referenceNo: '',
  notes: '',
})

const allocationForm = reactive({
  productId: '',
  warehouseId: '',
  quantity: 1,
  mode: 'reserve',
  referenceNo: '',
  notes: '',
})

async function loadSelectors() {
  const [productResponse, warehouseResponse, categoryResponse] = await Promise.all([
    api.get('/products', {
      params: {
        all: true,
        status: 'active',
      },
    }),
    api.get('/warehouses', {
      params: {
        all: true,
        activeOnly: true,
      },
    }),
    api.get('/categories', {
      params: {
        all: true,
      },
    }),
  ])

  products.value = productResponse.data.items
  warehouses.value = warehouseResponse.data.items
  categories.value = categoryResponse.data.items
}

async function loadInventoryPage(
  inventoryPage = inventoryPagination.value.page,
  movementPage = transactionPagination.value.page,
) {
  loading.value = true

  try {
    const [inventoryResponse, transactionResponse] = await Promise.all([
      api.get('/inventory', {
        params: {
          search: inventorySearch.value,
          categoryId: inventoryFilters.categoryId || undefined,
          warehouseId: inventoryFilters.warehouseId || undefined,
          lowStockOnly: inventoryFilters.lowStockOnly || undefined,
          page: inventoryPage,
          pageSize: inventoryPagination.value.pageSize,
        },
      }),
      api.get('/inventory/transactions', {
        params: {
          search: transactionSearch.value,
          movementType: transactionFilters.movementType,
          page: movementPage,
          pageSize: transactionPagination.value.pageSize,
        },
      }),
    ])

    inventory.value = inventoryResponse.data.items
    inventoryPagination.value = inventoryResponse.data.pagination
    transactions.value = transactionResponse.data.items
    transactionPagination.value = transactionResponse.data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load inventory.'
  } finally {
    loading.value = false
  }
}

function resetForms() {
  Object.assign(stockInForm, {
    productId: '',
    warehouseId: '',
    quantity: 1,
    referenceNo: '',
    notes: '',
  })
  Object.assign(stockOutForm, {
    productId: '',
    warehouseId: '',
    quantity: 1,
    referenceNo: '',
    notes: '',
  })
  Object.assign(transferForm, {
    productId: '',
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    quantity: 1,
    referenceNo: '',
    notes: '',
  })
  Object.assign(allocationForm, {
    productId: '',
    warehouseId: '',
    quantity: 1,
    mode: 'reserve',
    referenceNo: '',
    notes: '',
  })
}

async function submitMovement(endpoint, payload) {
  try {
    await api.post(endpoint, payload)
    resetForms()
    await loadInventoryPage(1, 1)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to create stock movement.'
  }
}

function handleInventorySearch() {
  loadInventoryPage(1, transactionPagination.value.page)
}

function handleTransactionSearch() {
  loadInventoryPage(inventoryPagination.value.page, 1)
}

function resetInventoryFilters() {
  Object.assign(inventoryFilters, {
    categoryId: '',
    warehouseId: '',
    lowStockOnly: false,
  })
  inventorySearch.value = ''
  loadInventoryPage(1, transactionPagination.value.page)
}

function resetTransactionFilters() {
  Object.assign(transactionFilters, {
    movementType: 'all',
  })
  transactionSearch.value = ''
  loadInventoryPage(inventoryPagination.value.page, 1)
}

onMounted(async () => {
  if (!authStore.user) {
    await authStore.fetchMe()
  }

  await loadSelectors()
  await loadInventoryPage()
})
</script>

<template>
  <AppLayout>
    <section>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Operations</p>
      <h2 class="mt-2 text-3xl font-semibold text-slate-900">Inventory tracking</h2>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 grid gap-6 2xl:grid-cols-3">
        <form
          class="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          @submit.prevent="submitMovement('/inventory/stock-in', stockInForm)"
        >
          <h3 class="text-xl font-semibold text-slate-900">Stock in</h3>
          <div class="mt-5 space-y-3">
            <select
              v-model="stockInForm.productId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Select product</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }} · {{ product.sku }}
              </option>
            </select>
            <select
              v-model="stockInForm.warehouseId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Select warehouse</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
            <input
              v-model="stockInForm.quantity"
              type="number"
              min="1"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              placeholder="Quantity"
            />
            <input
              v-model="stockInForm.referenceNo"
              type="text"
              placeholder="Reference no"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <textarea
              v-model="stockInForm.notes"
              rows="3"
              placeholder="Notes"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <button class="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
              Confirm stock in
            </button>
          </div>
        </form>

        <form
          class="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          @submit.prevent="submitMovement('/inventory/stock-out', stockOutForm)"
        >
          <h3 class="text-xl font-semibold text-slate-900">Stock out</h3>
          <div class="mt-5 space-y-3">
            <select
              v-model="stockOutForm.productId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Select product</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }} · {{ product.sku }}
              </option>
            </select>
            <select
              v-model="stockOutForm.warehouseId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Select warehouse</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
            <input
              v-model="stockOutForm.quantity"
              type="number"
              min="1"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              placeholder="Quantity"
            />
            <input
              v-model="stockOutForm.referenceNo"
              type="text"
              placeholder="Reference no"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <textarea
              v-model="stockOutForm.notes"
              rows="3"
              placeholder="Notes"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <button class="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white">
              Confirm stock out
            </button>
          </div>
        </form>

        <form
          v-if="authStore.user?.role === 'ADMIN' || authStore.user?.role === 'MANAGER'"
          class="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          @submit.prevent="submitMovement('/inventory/transfer', transferForm)"
        >
          <h3 class="text-xl font-semibold text-slate-900">Stock transfer</h3>
          <div class="mt-5 space-y-3">
            <select
              v-model="transferForm.productId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Select product</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }} · {{ product.sku }}
              </option>
            </select>
            <select
              v-model="transferForm.sourceWarehouseId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Source warehouse</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
            <select
              v-model="transferForm.destinationWarehouseId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Destination warehouse</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
            <input
              v-model="transferForm.quantity"
              type="number"
              min="1"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              placeholder="Quantity"
            />
            <input
              v-model="transferForm.referenceNo"
              type="text"
              placeholder="Reference no"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <textarea
              v-model="transferForm.notes"
              rows="3"
              placeholder="Notes"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <button class="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white">
              Confirm transfer
            </button>
          </div>
        </form>

        <form
          class="rounded-3xl border border-slate-200 bg-slate-50 p-5"
          @submit.prevent="submitMovement('/inventory/allocate', allocationForm)"
        >
          <h3 class="text-xl font-semibold text-slate-900">Order allocation</h3>
          <div class="mt-5 space-y-3">
            <select
              v-model="allocationForm.productId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Select product</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }} · {{ product.sku }}
              </option>
            </select>
            <select
              v-model="allocationForm.warehouseId"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="">Select warehouse</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
            <select
              v-model="allocationForm.mode"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            >
              <option value="reserve">Reserve</option>
              <option value="release">Release</option>
            </select>
            <input
              v-model="allocationForm.quantity"
              type="number"
              min="1"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              placeholder="Quantity"
            />
            <input
              v-model="allocationForm.referenceNo"
              type="text"
              placeholder="Reference no"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <textarea
              v-model="allocationForm.notes"
              rows="3"
              placeholder="Notes"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <button class="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white">
              Confirm allocation
            </button>
          </div>
        </form>
      </div>

      <div class="mt-8 grid gap-6 2xl:grid-cols-[1.25fr_1fr]">
        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 class="text-xl font-semibold text-slate-900">Inventory by warehouse</h3>
              <p class="mt-1 text-sm text-slate-500">支持分类、仓库和低库存组合筛选。</p>
            </div>
            <input
              v-model="inventorySearch"
              type="text"
              placeholder="搜索库存"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500 md:w-64"
              @input="handleInventorySearch"
            />
          </div>
          <div class="grid gap-3 border-b border-slate-200 px-5 py-4 md:grid-cols-4">
            <select
              v-model="inventoryFilters.categoryId"
              class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              @change="handleInventorySearch"
            >
              <option value="">全部分类</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
            <select
              v-model="inventoryFilters.warehouseId"
              class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              @change="handleInventorySearch"
            >
              <option value="">全部仓库</option>
              <option v-for="warehouse in warehouses" :key="warehouse.id" :value="warehouse.id">
                {{ warehouse.name }}
              </option>
            </select>
            <label class="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
              <input v-model="inventoryFilters.lowStockOnly" type="checkbox" class="size-4 rounded border-slate-300" @change="handleInventorySearch" />
              仅看低库存
            </label>
            <button
              type="button"
              class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              @click="resetInventoryFilters"
            >
              重置库存筛选
            </button>
          </div>
          <div v-if="loading" class="px-5 py-4 text-sm text-slate-500">加载中...</div>
          <div class="grid gap-3 p-4 md:hidden">
            <article
              v-for="item in inventory"
              :key="item.id"
              class="rounded-3xl border border-slate-200 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ item.sku }} · {{ item.category_name || 'No category' }}</p>
                </div>
                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  :class="
                    Number(item.warehouse_available_quantity) <= Number(item.reorder_level)
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  "
                >
                  {{ item.warehouse_available_quantity }} {{ item.unit }}
                </span>
              </div>
              <p class="mt-3 text-sm text-slate-500">Warehouse: {{ item.warehouse_name }}</p>
              <p class="mt-1 text-sm text-slate-500">On hand: {{ item.on_hand_quantity }}</p>
              <p class="mt-1 text-sm text-slate-500">Allocated: {{ item.order_allocated_quantity }}</p>
              <p class="mt-1 text-sm text-slate-500">Reorder: {{ item.reorder_level }}</p>
            </article>
          </div>
          <div class="hidden overflow-x-auto md:block">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-4">Product</th>
                  <th class="px-4 py-4">Warehouse</th>
                  <th class="px-4 py-4">On Hand</th>
                  <th class="px-4 py-4">Allocated</th>
                  <th class="px-4 py-4">Available</th>
                  <th class="px-4 py-4">Reorder</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in inventory" :key="item.id" class="border-t border-slate-100">
                  <td class="px-4 py-4">
                    <p class="font-medium text-slate-900">{{ item.product_name }}</p>
                    <p class="text-xs text-slate-500">{{ item.sku }} · {{ item.category_name || 'No category' }}</p>
                  </td>
                  <td class="px-4 py-4">{{ item.warehouse_name }}</td>
                  <td class="px-4 py-4">
                    <span
                      class="rounded-full px-3 py-1 text-xs font-semibold"
                      :class="
                        Number(item.warehouse_available_quantity) <= Number(item.reorder_level)
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      "
                    >
                      {{ item.on_hand_quantity }} {{ item.unit }}
                    </span>
                  </td>
                  <td class="px-4 py-4">{{ item.order_allocated_quantity }}</td>
                  <td class="px-4 py-4">{{ item.warehouse_available_quantity }}</td>
                  <td class="px-4 py-4">{{ item.reorder_level }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar :pagination="inventoryPagination" @change="(page) => loadInventoryPage(page, transactionPagination.page)" />
        </div>

        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div class="border-b border-slate-200 px-5 py-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-xl font-semibold text-slate-900">Recent transactions</h3>
                <p class="mt-1 text-sm text-slate-500">支持搜索单号、商品和操作类型。</p>
              </div>
              <input
                v-model="transactionSearch"
                type="text"
                placeholder="搜索流水"
                class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500 md:w-56"
                @input="handleTransactionSearch"
              />
            </div>
          </div>
          <div class="flex flex-wrap gap-3 border-b border-slate-200 px-5 py-4">
            <select
              v-model="transactionFilters.movementType"
              class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
              @change="handleTransactionSearch"
            >
              <option value="all">全部类型</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="TRANSFER">TRANSFER</option>
            </select>
            <button
              type="button"
              class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              @click="resetTransactionFilters"
            >
              重置流水筛选
            </button>
          </div>
          <div class="space-y-3 p-5">
            <div
              v-for="transaction in transactions"
              :key="transaction.id"
              class="rounded-2xl border border-slate-200 p-4"
            >
              <div class="flex items-center justify-between gap-4">
                <p class="font-medium text-slate-900">{{ transaction.movement_type }}</p>
                <span class="text-xs text-slate-500">{{ new Date(transaction.created_at).toLocaleString() }}</span>
              </div>
              <p class="mt-2 text-sm text-slate-700">{{ transaction.product_name }} · {{ transaction.sku }}</p>
              <p class="mt-1 text-sm text-slate-500">
                Qty {{ transaction.quantity }} · Ref {{ transaction.reference_no || 'N/A' }}
              </p>
              <p class="mt-1 text-xs text-slate-400">
                {{ transaction.source_warehouse_name || 'Supplier' }}
                →
                {{ transaction.destination_warehouse_name || 'Customer' }}
              </p>
            </div>
          </div>
          <PaginationBar :pagination="transactionPagination" @change="(page) => loadInventoryPage(inventoryPagination.page, page)" />
        </div>
      </div>
    </section>
  </AppLayout>
</template>
