<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Suppliers</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">Supplier Documents</h2>
          <p class="mt-2 text-sm text-slate-500">
            Record delivery orders, invoices, and returns / claim / repair documents issued by suppliers.
          </p>
        </div>
      </div>

      <div class="mt-6 flex gap-1 border-b border-slate-200">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="-mb-px px-4 py-2 text-sm font-medium"
          :class="activeTab === tab.key
            ? 'border-b-2 border-indigo-600 text-indigo-700'
            : 'text-slate-500 hover:text-slate-700'"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="searchInput"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
            @keyup.enter="applySearch"
          />
          <select
            v-model.number="yearFilter"
            class="rounded border border-slate-300 px-3 py-2 text-sm"
            @change="loadList(1)"
          >
            <option :value="0">All years</option>
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
          <select
            v-model.number="monthFilter"
            class="rounded border border-slate-300 px-3 py-2 text-sm"
            @change="loadList(1)"
          >
            <option :value="0">All months</option>
            <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
          </select>
          <select
            v-if="activeTab === 'returns'"
            v-model="docTypeFilter"
            class="rounded border border-slate-300 px-3 py-2 text-sm"
            @change="loadList(1)"
          >
            <option value="">All types</option>
            <option value="RETURN">Return</option>
            <option value="CLAIM">Claim</option>
            <option value="REPAIR">Repair</option>
          </select>
          <button type="button" class="rounded border border-slate-300 px-3 py-2 text-sm" @click="applySearch">
            Search
          </button>
          <button
            v-if="searchInput || yearFilter || monthFilter || docTypeFilter"
            type="button"
            class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
            @click="resetFilters"
          >
            Reset
          </button>
        </div>
        <button
          type="button"
          class="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          @click="openCreate"
        >
          + New {{ currentTabLabelSingular }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ errorMessage }}
      </p>

      <div class="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div v-if="loading" class="px-5 py-6 text-sm text-slate-500">Loading...</div>

        <!-- Delivery Orders table -->
        <div v-else-if="activeTab === 'do'" class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th class="px-4 py-3">DO No</th>
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Supplier</th>
                <th class="px-4 py-3 text-right">Items</th>
                <th class="px-4 py-3 text-right">Attachments</th>
                <th class="px-4 py-3">Created</th>
                <th class="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in items" :key="row.id" class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-900">{{ row.do_no }}</td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(row.do_date) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.supplier_company_name || row.supplier_name || '—' }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.item_count || 0 }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.attachment_count || 0 }}</td>
                <td class="px-4 py-3 text-slate-500">{{ formatDateTime(row.created_at) }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button class="text-xs text-indigo-600 hover:underline" @click="openEdit(row.id)">Edit</button>
                    <button class="text-xs text-red-600 hover:underline" @click="removeRow(row.id)">Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="7" class="px-4 py-8 text-center text-sm text-slate-400">No delivery orders yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Invoices table -->
        <div v-else-if="activeTab === 'invoice'" class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th class="px-4 py-3">Invoice No</th>
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Supplier</th>
                <th class="px-4 py-3">Ref DO</th>
                <th class="px-4 py-3 text-right">Total Qty</th>
                <th class="px-4 py-3 text-right">Total Amount</th>
                <th class="px-4 py-3 text-right">Att.</th>
                <th class="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in items" :key="row.id" class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-900">{{ row.invoice_no }}</td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(row.invoice_date) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.supplier_company_name || row.supplier_name || '—' }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.do_no || '—' }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ formatNumber(row.total_quantity) }}</td>
                <td class="px-4 py-3 text-right font-medium text-slate-900">{{ formatMoney(row.total_amount) }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.attachment_count || 0 }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button class="text-xs text-indigo-600 hover:underline" @click="openEdit(row.id)">Edit</button>
                    <button class="text-xs text-red-600 hover:underline" @click="removeRow(row.id)">Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="8" class="px-4 py-8 text-center text-sm text-slate-400">No invoices yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Returns table -->
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th class="px-4 py-3">Document No</th>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3">Date</th>
                <th class="px-4 py-3">Supplier</th>
                <th class="px-4 py-3 text-right">Items</th>
                <th class="px-4 py-3 text-right">Att.</th>
                <th class="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in items" :key="row.id" class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-900">{{ row.document_no }}</td>
                <td class="px-4 py-3">
                  <span class="rounded px-2 py-0.5 text-xs font-semibold" :class="docTypeClass(row.doc_type)">
                    {{ row.doc_type }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(row.document_date) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.supplier_company_name || row.supplier_name || '—' }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.item_count || 0 }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.attachment_count || 0 }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button class="text-xs text-indigo-600 hover:underline" @click="openEdit(row.id)">Edit</button>
                    <button class="text-xs text-red-600 hover:underline" @click="removeRow(row.id)">Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="7" class="px-4 py-8 text-center text-sm text-slate-400">No documents yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <PaginationBar :pagination="pagination" @change="loadList" />
      </div>
    </section>

    <DeliveryOrderFormModal
      v-if="modal === 'do'"
      :id="editingId"
      :suppliers="suppliers"
      @close="closeModal"
      @saved="onSaved"
    />
    <SupplierInvoiceFormModal
      v-if="modal === 'invoice'"
      :id="editingId"
      :suppliers="suppliers"
      @close="closeModal"
      @saved="onSaved"
    />
    <SupplierReturnFormModal
      v-if="modal === 'returns'"
      :id="editingId"
      :suppliers="suppliers"
      @close="closeModal"
      @saved="onSaved"
    />
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import DeliveryOrderFormModal from '../components/DeliveryOrderFormModal.vue'
import SupplierInvoiceFormModal from '../components/SupplierInvoiceFormModal.vue'
import SupplierReturnFormModal from '../components/SupplierReturnFormModal.vue'
import api from '../services/api'
import { useToastStore } from '../stores/toast'

const toastStore = useToastStore()

const tabs = [
  { key: 'do', label: 'Delivery Orders', singular: 'Delivery Order', resource: '/delivery-orders' },
  { key: 'invoice', label: 'Invoices', singular: 'Invoice', resource: '/supplier-invoices' },
  { key: 'returns', label: 'Returns / Claim / Repair', singular: 'Return / Claim / Repair', resource: '/supplier-returns' },
]

const activeTab = ref('do')
const searchInput = ref('')
const search = ref('')
const docTypeFilter = ref('')
const yearFilter = ref(0)
const monthFilter = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const items = ref([])
const pagination = ref({ total: 0, page: 1, pageSize: 15, totalPages: 1 })
const suppliers = ref([])
const modal = ref(null) // 'po' | 'invoice' | 'returns' | null
const editingId = ref(null)

const currentTab = computed(() => tabs.find((t) => t.key === activeTab.value))
const currentTabLabelSingular = computed(() => currentTab.value?.singular || '')
const searchPlaceholder = computed(() => {
  if (activeTab.value === 'do') return 'Search DO no or supplier'
  if (activeTab.value === 'invoice') return 'Search invoice no or supplier'
  return 'Search document no or supplier'
})

const yearOptions = computed(() => {
  const current = new Date().getFullYear()
  const arr = []
  for (let y = current + 1; y >= current - 5; y--) arr.push(y)
  return arr
})

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
function monthName(m) {
  return MONTH_NAMES[m] || m
}

function formatDate(v) {
  if (!v) return '—'
  return String(v).slice(0, 10)
}
function formatDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}
function formatNumber(v) {
  const n = Number(v || 0)
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 })
}
function formatMoney(v) {
  const n = Number(v || 0)
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function docTypeClass(t) {
  if (t === 'RETURN') return 'bg-amber-100 text-amber-800'
  if (t === 'CLAIM') return 'bg-rose-100 text-rose-800'
  if (t === 'REPAIR') return 'bg-sky-100 text-sky-800'
  return 'bg-slate-100 text-slate-700'
}

function switchTab(key) {
  if (activeTab.value === key) return
  activeTab.value = key
  searchInput.value = ''
  search.value = ''
  docTypeFilter.value = ''
  yearFilter.value = 0
  monthFilter.value = 0
  pagination.value.page = 1
  loadList(1)
}

function applySearch() {
  search.value = searchInput.value.trim()
  loadList(1)
}

function resetFilters() {
  searchInput.value = ''
  search.value = ''
  yearFilter.value = 0
  monthFilter.value = 0
  docTypeFilter.value = ''
  loadList(1)
}

async function loadSuppliers() {
  try {
    const { data } = await api.get('/suppliers', { params: { pageSize: 500 } })
    const list = data?.items || data?.suppliers || (Array.isArray(data) ? data : [])
    suppliers.value = list.map((s) => ({
      id: s.id,
      name: s.name || s.company_name,
      company_name: s.company_name || s.name,
    }))
  } catch (error) {
    suppliers.value = []
  }
}

async function loadList(page = 1) {
  loading.value = true
  errorMessage.value = ''
  pagination.value.page = page
  try {
    const params = { page, pageSize: pagination.value.pageSize }
    if (search.value) params.search = search.value
    if (yearFilter.value) params.year = yearFilter.value
    if (monthFilter.value) params.month = monthFilter.value
    if (activeTab.value === 'returns' && docTypeFilter.value) params.docType = docTypeFilter.value
    const { data } = await api.get(currentTab.value.resource, { params })
    items.value = data?.items || []
    pagination.value = data?.pagination || { ...pagination.value, total: items.value.length, totalPages: 1 }
  } catch (error) {
    items.value = []
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to load.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  modal.value = activeTab.value
}
function openEdit(id) {
  editingId.value = id
  modal.value = activeTab.value
}
function closeModal() {
  modal.value = null
  editingId.value = null
}
function onSaved() {
  closeModal()
  toastStore.pushToast({ tone: 'success', message: 'Saved.' })
  loadList(pagination.value.page)
}

async function removeRow(id) {
  if (!window.confirm('Delete this document? This cannot be undone.')) return
  try {
    await api.delete(`${currentTab.value.resource}/${id}`)
    toastStore.pushToast({ tone: 'success', message: 'Deleted.' })
    loadList(pagination.value.page)
  } catch (error) {
    toastStore.pushToast({ tone: 'error', message: error.response?.data?.message || 'Failed to delete.' })
  }
}

onMounted(async () => {
  await loadSuppliers()
  await loadList(1)
})
</script>
