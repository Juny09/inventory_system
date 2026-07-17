<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'
import { exportToPdf } from '../utils/export'
import { useFormDraft } from '../composables/useFormDraft'

const localeStore = useLocaleStore()
const activeTab = ref('bills')
const loading = ref(false)
const errorMessage = ref('')

function pad2(n) {
  return String(n).padStart(2, '0')
}

function resolveNowYm() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

const filters = reactive({
  year: resolveNowYm().year,
  month: resolveNowYm().month,
  status: 'all',
  customerSearch: '',
  billSearch: '',
})

const customers = ref([])
const bills = ref([])

const customerModalOpen = ref(false)
const customerMode = ref('create')
const editingCustomerId = ref(null)
const customerForm = reactive({
  name: '',
  companyName: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  isActive: true,
})

const billModalOpen = ref(false)
const billMode = ref('create')
const editingBillId = ref(null)
const billForm = reactive({
  customerId: '',
  periodYear: filters.year,
  periodMonth: filters.month,
  dueDate: '',
  status: 'PENDING',
  currency: 'MYR',
  notes: '',
  items: [],
  attachments: [],
})

const selectedBillDetail = ref(null)
const billDetailLoading = ref(false)
const exportLoading = ref(false)
const customerDraftKey = computed(() => `customer-billing-customer-form:${customerMode.value}:${editingCustomerId.value || 'new'}`)
const billDraftKey = computed(() => `customer-billing-bill-form:${billMode.value}:${editingBillId.value || 'new'}`)
const customerDraft = useFormDraft({
  storageKey: customerDraftKey,
  // 中文说明：客户弹窗关闭后，下次打开继续保留还没提交的内容。
  buildState: () => ({ ...customerForm }),
  applyState: (draft) => {
    if (!draft || typeof draft !== 'object') return
    Object.assign(customerForm, draft)
  },
})
const billDraft = useFormDraft({
  storageKey: billDraftKey,
  // 中文说明：账单表单包含多行明细，先保存在本地，避免误关后重做。
  buildState: () => ({
    ...billForm,
    items: billForm.items.map((item) => ({ ...item })),
  }),
  applyState: (draft) => {
    if (!draft || typeof draft !== 'object') return
    Object.assign(billForm, draft)
    billForm.items = Array.isArray(draft.items) && draft.items.length
      ? draft.items.map((item) => ({ description: '', quantity: 1, unitPrice: 0, ...item }))
      : [{ description: '', quantity: 1, unitPrice: 0 }]
  },
})

const visibleCustomers = computed(() => {
  const keyword = String(filters.customerSearch || '').trim().toLowerCase()
  if (!keyword) return customers.value
  return customers.value.filter((c) => {
    const hay = `${c.name || ''} ${c.company_name || ''} ${c.contact_name || ''} ${c.phone || ''} ${c.email || ''}`.toLowerCase()
    return hay.includes(keyword)
  })
})

const visibleBills = computed(() => {
  const keyword = String(filters.billSearch || '').trim().toLowerCase()
  if (!keyword) return bills.value
  return bills.value.filter((b) => String(b.customerName || '').toLowerCase().includes(keyword))
})

async function loadCustomers() {
  const { data } = await api.get('/customers', { params: { page: 1, pageSize: 200, status: 'all' } })
  customers.value = data.items || []
}

async function loadBills() {
  const { data } = await api.get('/customer-bills', {
    params: {
      year: filters.year,
      month: filters.month,
      status: filters.status,
      page: 1,
      pageSize: 200,
    },
  })
  bills.value = data.items || []
}

async function refreshAll() {
  loading.value = true
  errorMessage.value = ''
  try {
    await Promise.all([loadCustomers(), loadBills()])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load data.'
  } finally {
    loading.value = false
  }
}

function openCustomerCreate() {
  customerMode.value = 'create'
  editingCustomerId.value = null
  customerForm.name = ''
  customerForm.companyName = ''
  customerForm.contactName = ''
  customerForm.phone = ''
  customerForm.email = ''
  customerForm.address = ''
  customerForm.notes = ''
  customerForm.isActive = true
  customerModalOpen.value = true
  customerDraft.restoreDraft()
}

function openCustomerEdit(row) {
  customerMode.value = 'edit'
  editingCustomerId.value = row.id
  customerForm.name = row.name || ''
  customerForm.companyName = row.company_name || ''
  customerForm.contactName = row.contact_name || ''
  customerForm.phone = row.phone || ''
  customerForm.email = row.email || ''
  customerForm.address = row.address || ''
  customerForm.notes = row.notes || ''
  customerForm.isActive = row.is_active !== false
  customerModalOpen.value = true
  customerDraft.restoreDraft()
}

async function submitCustomer() {
  loading.value = true
  errorMessage.value = ''

  try {
    const payload = {
      name: customerForm.name,
      companyName: customerForm.companyName || undefined,
      contactName: customerForm.contactName || undefined,
      phone: customerForm.phone || undefined,
      email: customerForm.email || undefined,
      address: customerForm.address || undefined,
      notes: customerForm.notes || undefined,
      isActive: customerForm.isActive,
    }

    if (customerMode.value === 'create') {
      await api.post('/customers', payload)
    } else {
      await api.put(`/customers/${editingCustomerId.value}`, payload)
    }

    customerDraft.clearDraft()
    customerModalOpen.value = false
    await loadCustomers()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to save customer.'
  } finally {
    loading.value = false
  }
}

async function deleteCustomer(row) {
  if (!confirm(localeStore.locale === 'en' ? 'Delete this customer?' : '确认删除这个客户？')) return
  loading.value = true
  errorMessage.value = ''
  try {
    await api.delete(`/customers/${row.id}`)
    await loadCustomers()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to delete customer.'
  } finally {
    loading.value = false
  }
}

function resetBillForm() {
  billForm.customerId = ''
  billForm.periodYear = filters.year
  billForm.periodMonth = filters.month
  billForm.dueDate = ''
  billForm.status = 'PENDING'
  billForm.currency = 'MYR'
  billForm.notes = ''
  billForm.items = [{ description: '', quantity: 1, unitPrice: 0 }]
  billForm.attachments = []
}

function openBillCreate(customerId = '') {
  billMode.value = 'create'
  editingBillId.value = null
  selectedBillDetail.value = null
  resetBillForm()
  billForm.customerId = customerId ? String(customerId) : ''
  billModalOpen.value = true
  billDraft.restoreDraft()
}

async function openBillEdit(billId) {
  billMode.value = 'edit'
  editingBillId.value = billId
  selectedBillDetail.value = null
  billModalOpen.value = true
  await loadBillDetail(billId, { hydrateForm: true })
  billDraft.restoreDraft()
}

function addBillItem() {
  billForm.items.push({ description: '', quantity: 1, unitPrice: 0 })
}

function removeBillItem(index) {
  billForm.items.splice(index, 1)
  if (!billForm.items.length) addBillItem()
}

const computedTotal = computed(() =>
  (billForm.items || [])
    .map((it) => Number(it.quantity || 0) * Number(it.unitPrice || 0))
    .reduce((acc, cur) => acc + (Number.isFinite(cur) ? cur : 0), 0),
)

async function submitBill() {
  loading.value = true
  errorMessage.value = ''

  try {
    const payload = {
      customerId: Number(billForm.customerId),
      periodYear: Number(billForm.periodYear),
      periodMonth: Number(billForm.periodMonth),
      dueDate: billForm.dueDate || undefined,
      status: billForm.status,
      currency: billForm.currency,
      notes: billForm.notes || undefined,
      items: billForm.items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity ?? 1),
        unitPrice: Number(it.unitPrice ?? 0),
      })),
    }

    if (billMode.value === 'create') {
      const { data } = await api.post('/customer-bills', payload)
      billDraft.clearDraft()
      billModalOpen.value = false
      await loadBills()
      await openBillEdit(data.bill.id)
      return
    }

    await api.put(`/customer-bills/${editingBillId.value}`, payload)
    billDraft.clearDraft()
    await loadBills()
    await loadBillDetail(editingBillId.value, { hydrateForm: false })
    billModalOpen.value = false
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to save bill.'
  } finally {
    loading.value = false
  }
}

async function loadBillDetail(billId, { hydrateForm } = { hydrateForm: false }) {
  billDetailLoading.value = true
  errorMessage.value = ''

  try {
    const { data } = await api.get(`/customer-bills/${billId}`)
    selectedBillDetail.value = data.bill

    if (hydrateForm) {
      billForm.customerId = String(data.bill.customerId)
      billForm.periodYear = data.bill.periodYear
      billForm.periodMonth = data.bill.periodMonth
      billForm.dueDate = data.bill.dueDate || ''
      billForm.status = data.bill.status
      billForm.currency = data.bill.currency || 'MYR'
      billForm.notes = data.bill.notes || ''
      billForm.items = (data.bill.items || []).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }))
      if (!billForm.items.length) {
        billForm.items = [{ description: '', quantity: 1, unitPrice: 0 }]
      }
      billForm.attachments = data.bill.attachments || []
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load bill.'
  } finally {
    billDetailLoading.value = false
  }
}

async function deleteBill(row) {
  if (!confirm(localeStore.locale === 'en' ? 'Delete this bill?' : '确认删除这张账单？')) return
  loading.value = true
  errorMessage.value = ''
  try {
    await api.delete(`/customer-bills/${row.id}`)
    if (selectedBillDetail.value?.id === row.id) selectedBillDetail.value = null
    await loadBills()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to delete bill.'
  } finally {
    loading.value = false
  }
}

async function updateBillStatus(row, status) {
  loading.value = true
  errorMessage.value = ''
  try {
    await api.patch(`/customer-bills/${row.id}/status`, { status })
    await loadBills()
    if (selectedBillDetail.value?.id === row.id) {
      await loadBillDetail(row.id, { hydrateForm: false })
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to update status.'
  } finally {
    loading.value = false
  }
}

async function uploadBillAttachment(billId, file) {
  const fd = new FormData()
  fd.append('file', file)
  await api.post(`/customer-bills/${billId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  await loadBillDetail(billId, { hydrateForm: false })
  await loadBills()
}

async function deleteBillAttachment(billId, attachmentId) {
  await api.delete(`/customer-bills/${billId}/attachments/${attachmentId}`)
  await loadBillDetail(billId, { hydrateForm: false })
}

async function exportBillPdf(billId) {
  exportLoading.value = true
  errorMessage.value = ''

  try {
    const { data } = await api.get(`/customer-bills/${billId}`)
    const bill = data.bill

    const title = `${bill.customerName} - ${bill.periodYear}-${pad2(bill.periodMonth)}`
    const filename = `bill_${bill.customerName}_${bill.periodYear}-${pad2(bill.periodMonth)}.pdf`
      .replaceAll(' ', '_')
      .slice(0, 120)

    const columns = [
      { key: 'description', label: localeStore.locale === 'en' ? 'Description' : '明细' },
      { key: 'quantity', label: localeStore.locale === 'en' ? 'Qty' : '数量' },
      { key: 'unitPrice', label: localeStore.locale === 'en' ? 'Unit price' : '单价' },
      { key: 'amount', label: localeStore.locale === 'en' ? 'Amount' : '金额' },
    ]

    const rows = (bill.items || []).map((it) => ({
      description: it.description,
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0).toFixed(2),
      amount: Number(it.amount || 0).toFixed(2),
    }))

    exportToPdf(
      `${title}\nTotal: ${Number(bill.totalAmount || 0).toFixed(2)} ${bill.currency || 'MYR'}\nStatus: ${bill.status}`,
      filename,
      columns,
      rows,
    )
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to export PDF.'
  } finally {
    exportLoading.value = false
  }
}

async function batchExportMonth() {
  exportLoading.value = true
  errorMessage.value = ''

  try {
    const monthBills = bills.value.slice()
    for (let i = 0; i < monthBills.length; i += 1) {
      await exportBillPdf(monthBills[i].id)
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to batch export.'
  } finally {
    exportLoading.value = false
  }
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2)
}

onMounted(refreshAll)
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Analytics</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Customer Billing' : '月结客户账单' }}
          </h2>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-2 text-sm"
            :class="activeTab === 'bills' ? 'bg-slate-900 text-white' : ''"
            @click="activeTab = 'bills'"
          >
            {{ localeStore.locale === 'en' ? 'Bills' : '账单' }}
          </button>
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-2 text-sm"
            :class="activeTab === 'customers' ? 'bg-slate-900 text-white' : ''"
            @click="activeTab = 'customers'"
          >
            {{ localeStore.locale === 'en' ? 'Customers' : '客户' }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="loading" class="mt-6 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
        {{ localeStore.locale === 'en' ? 'Loading...' : '加载中...' }}
      </div>

      <div v-else class="mt-6">
        <div v-if="activeTab === 'bills'" class="grid gap-6">
          <div class="rounded-3xl border border-slate-200 bg-white">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div class="flex flex-wrap items-center gap-3">
                <select v-model.number="filters.year" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm" @change="loadBills">
                  <option v-for="y in [filters.year - 1, filters.year, filters.year + 1]" :key="y" :value="y">{{ y }}</option>
                </select>
                <select v-model.number="filters.month" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm" @change="loadBills">
                  <option v-for="m in 12" :key="m" :value="m">{{ pad2(m) }}</option>
                </select>
                <select v-model="filters.status" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm" @change="loadBills">
                  <option value="all">{{ localeStore.locale === 'en' ? 'All status' : '全部状态' }}</option>
                  <option value="pending">{{ localeStore.locale === 'en' ? 'Pending' : '待收款' }}</option>
                  <option value="paid">{{ localeStore.locale === 'en' ? 'Paid' : '已收款' }}</option>
                  <option value="overdue">{{ localeStore.locale === 'en' ? 'Overdue' : '已逾期' }}</option>
                </select>
                <input
                  v-model="filters.billSearch"
                  type="text"
                  class="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                  :placeholder="localeStore.locale === 'en' ? 'Search customer...' : '搜索客户...'"
                />
              </div>

              <div class="flex flex-wrap gap-2">
                <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2 text-sm" :disabled="exportLoading" @click="batchExportMonth">
                  {{ exportLoading ? (localeStore.locale === 'en' ? 'Exporting...' : '导出中...') : (localeStore.locale === 'en' ? 'Batch Export PDF' : '批量导出 PDF') }}
                </button>
                <button type="button" class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white" @click="openBillCreate()">
                  {{ localeStore.locale === 'en' ? 'Create bill' : '创建账单' }}
                </button>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Customer' : '客户' }}</th>
                    <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Total' : '总金额' }}</th>
                    <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Status' : '状态' }}</th>
                    <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Due' : '截止日期' }}</th>
                    <th class="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in visibleBills" :key="row.id" class="border-t border-slate-200">
                    <td class="px-5 py-3 font-medium text-slate-900">{{ row.customerName }}</td>
                    <td class="px-5 py-3 text-slate-700">{{ formatMoney(row.totalAmount) }} {{ row.currency }}</td>
                    <td class="px-5 py-3">
                      <select
                        :value="row.status"
                        class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                        @change="updateBillStatus(row, $event.target.value)"
                      >
                        <option value="PENDING">{{ localeStore.locale === 'en' ? 'Pending' : '待收款' }}</option>
                        <option value="PAID">{{ localeStore.locale === 'en' ? 'Paid' : '已收款' }}</option>
                        <option value="OVERDUE">{{ localeStore.locale === 'en' ? 'Overdue' : '已逾期' }}</option>
                      </select>
                    </td>
                    <td class="px-5 py-3 text-slate-700">{{ row.dueDate || '-' }}</td>
                    <td class="px-5 py-3">
                      <div class="flex justify-end gap-2">
                        <button type="button" class="rounded-xl border border-slate-300 px-3 py-1 text-xs" @click="openBillEdit(row.id)">
                          {{ localeStore.locale === 'en' ? 'View/Edit' : '查看/编辑' }}
                        </button>
                        <button type="button" class="rounded-xl border border-slate-300 px-3 py-1 text-xs" :disabled="exportLoading" @click="exportBillPdf(row.id)">
                          {{ localeStore.locale === 'en' ? 'PDF' : '导出PDF' }}
                        </button>
                        <button type="button" class="rounded-xl border border-rose-300 px-3 py-1 text-xs text-rose-600" @click="deleteBill(row)">
                          {{ localeStore.locale === 'en' ? 'Delete' : '删除' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!visibleBills.length">
                    <td colspan="5" class="px-5 py-6 text-center text-slate-500">
                      {{ localeStore.locale === 'en' ? 'No bills for this month.' : '这个月还没有账单。' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            v-if="billModalOpen"
            class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 px-4 py-8"
          >
            <div class="w-full max-w-4xl overflow-hidden rounded-3xl bg-white">
              <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 class="text-xl font-semibold text-slate-900">
                    {{ billMode === 'create' ? (localeStore.locale === 'en' ? 'Create bill' : '创建账单') : (localeStore.locale === 'en' ? 'Edit bill' : '编辑账单') }}
                  </h3>
                  <p class="mt-1 text-sm text-slate-500">
                    {{ localeStore.locale === 'en' ? 'Total is calculated from items.' : '总金额会根据明细自动计算。' }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button type="button" class="rounded-xl border border-slate-200 px-3 py-1 text-sm" @click="billModalOpen = false">
                    {{ localeStore.locale === 'en' ? 'Close' : '关闭' }}
                  </button>
                </div>
              </div>

              <div class="max-h-[75vh] overflow-y-auto px-6 py-6">
                <div v-if="billDetailLoading" class="rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
                  {{ localeStore.locale === 'en' ? 'Loading bill...' : '账单加载中...' }}
                </div>

                <form v-else class="grid gap-4" @submit.prevent="submitBill">
                  <div class="grid gap-3 lg:grid-cols-3">
                    <div class="lg:col-span-2">
                      <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Customer' : '客户' }}</label>
                      <select v-model="billForm.customerId" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" :disabled="billMode === 'edit'">
                        <option value="">{{ localeStore.locale === 'en' ? 'Select customer' : '选择客户' }}</option>
                        <option v-for="c in customers" :key="c.id" :value="String(c.id)">
                          {{ c.company_name || c.name }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Status' : '状态' }}</label>
                      <select v-model="billForm.status" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                        <option value="PENDING">{{ localeStore.locale === 'en' ? 'Pending' : '待收款' }}</option>
                        <option value="PAID">{{ localeStore.locale === 'en' ? 'Paid' : '已收款' }}</option>
                        <option value="OVERDUE">{{ localeStore.locale === 'en' ? 'Overdue' : '已逾期' }}</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid gap-3 md:grid-cols-4">
                    <div>
                      <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Year' : '年' }}</label>
                      <input v-model.number="billForm.periodYear" type="number" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" :disabled="billMode === 'edit'" />
                    </div>
                    <div>
                      <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Month' : '月' }}</label>
                      <input v-model.number="billForm.periodMonth" type="number" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" :disabled="billMode === 'edit'" />
                    </div>
                    <div>
                      <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Due date' : '截止日期' }}</label>
                      <input v-model="billForm.dueDate" type="date" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                    </div>
                    <div>
                      <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Currency' : '币种' }}</label>
                      <input v-model="billForm.currency" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                    </div>
                  </div>

                  <div class="overflow-hidden rounded-2xl border border-slate-200">
                    <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                      <p class="font-semibold text-slate-900">{{ localeStore.locale === 'en' ? 'Items' : '明细' }}</p>
                      <button type="button" class="rounded-xl border border-slate-300 px-3 py-1 text-xs" @click="addBillItem">
                        {{ localeStore.locale === 'en' ? 'Add row' : '新增一行' }}
                      </button>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="min-w-full text-sm">
                        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th class="px-4 py-2">{{ localeStore.locale === 'en' ? 'Description' : '明细' }}</th>
                            <th class="px-4 py-2">{{ localeStore.locale === 'en' ? 'Qty' : '数量' }}</th>
                            <th class="px-4 py-2">{{ localeStore.locale === 'en' ? 'Unit price' : '单价' }}</th>
                            <th class="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(row, idx) in billForm.items" :key="idx" class="border-t border-slate-200">
                            <td class="px-4 py-2">
                              <input v-model="row.description" type="text" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                            </td>
                            <td class="px-4 py-2">
                              <input v-model="row.quantity" type="number" step="0.001" class="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                            </td>
                            <td class="px-4 py-2">
                              <input v-model="row.unitPrice" type="number" step="0.01" class="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                            </td>
                            <td class="px-4 py-2 text-right">
                              <button type="button" class="rounded-xl border border-rose-300 px-3 py-1 text-xs text-rose-600" @click="removeBillItem(idx)">
                                {{ localeStore.locale === 'en' ? 'Remove' : '移除' }}
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
                      <span class="text-slate-600">{{ localeStore.locale === 'en' ? 'Total (preview)' : '总金额（预览）' }}</span>
                      <span class="font-semibold text-slate-900">{{ computedTotal.toFixed(2) }} {{ billForm.currency }}</span>
                    </div>
                  </div>

                  <div v-if="billMode === 'edit' && selectedBillDetail" class="rounded-2xl border border-slate-200">
                    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                      <p class="font-semibold text-slate-900">{{ localeStore.locale === 'en' ? 'Attachments' : '附件' }}</p>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        class="text-sm"
                        @change="(e) => uploadBillAttachment(selectedBillDetail.id, e.target.files[0])"
                      />
                    </div>
                    <div class="divide-y divide-slate-200">
                      <div v-for="att in selectedBillDetail.attachments" :key="att.id" class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <a :href="att.url" target="_blank" class="truncate text-brand-700 underline">{{ att.originalName }}</a>
                        <button
                          type="button"
                          class="rounded-xl border border-rose-300 px-3 py-1 text-xs text-rose-600"
                          @click="deleteBillAttachment(selectedBillDetail.id, att.id)"
                        >
                          {{ localeStore.locale === 'en' ? 'Delete' : '删除' }}
                        </button>
                      </div>
                      <div v-if="!selectedBillDetail.attachments?.length" class="px-4 py-4 text-sm text-slate-500">
                        {{ localeStore.locale === 'en' ? 'No attachments.' : '暂无附件。' }}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Notes' : '备注' }}</label>
                    <textarea v-model="billForm.notes" rows="3" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"></textarea>
                  </div>

                  <div class="flex justify-end gap-2">
                    <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2 text-sm" @click="billModalOpen = false">
                      {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
                    </button>
                    <button type="submit" class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
                      {{ localeStore.locale === 'en' ? 'Save' : '保存' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="grid gap-6">
          <div class="rounded-3xl border border-slate-200 bg-white">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <input
                v-model="filters.customerSearch"
                type="text"
                class="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                :placeholder="localeStore.locale === 'en' ? 'Search customer...' : '搜索客户...'"
              />
              <button type="button" class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white" @click="openCustomerCreate">
                {{ localeStore.locale === 'en' ? 'Add customer' : '新增客户' }}
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Name' : '名称' }}</th>
                    <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Contact' : '联系人' }}</th>
                    <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Phone' : '电话' }}</th>
                    <th class="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in visibleCustomers" :key="row.id" class="border-t border-slate-200">
                    <td class="px-5 py-3 font-medium text-slate-900">{{ row.company_name || row.name }}</td>
                    <td class="px-5 py-3 text-slate-700">{{ row.contact_name || '-' }}</td>
                    <td class="px-5 py-3 text-slate-700">{{ row.phone || '-' }}</td>
                    <td class="px-5 py-3">
                      <div class="flex justify-end gap-2">
                        <button type="button" class="rounded-xl border border-slate-300 px-3 py-1 text-xs" @click="openCustomerEdit(row)">
                          {{ localeStore.locale === 'en' ? 'Edit' : '编辑' }}
                        </button>
                        <button type="button" class="rounded-xl border border-slate-300 px-3 py-1 text-xs" @click="openBillCreate(row.id)">
                          {{ localeStore.locale === 'en' ? 'Create bill' : '创建账单' }}
                        </button>
                        <button type="button" class="rounded-xl border border-rose-300 px-3 py-1 text-xs text-rose-600" @click="deleteCustomer(row)">
                          {{ localeStore.locale === 'en' ? 'Delete' : '删除' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!visibleCustomers.length">
                    <td colspan="4" class="px-5 py-6 text-center text-slate-500">
                      {{ localeStore.locale === 'en' ? 'No customers.' : '暂无客户。' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            v-if="customerModalOpen"
            class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 px-4 py-8"
          >
            <div class="w-full max-w-2xl rounded-3xl bg-white p-6">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-xl font-semibold text-slate-900">
                    {{ customerMode === 'create' ? (localeStore.locale === 'en' ? 'Add customer' : '新增客户') : (localeStore.locale === 'en' ? 'Edit customer' : '编辑客户') }}
                  </h3>
                </div>
                <button type="button" class="rounded-xl border border-slate-200 px-3 py-1 text-sm" @click="customerModalOpen = false">
                  {{ localeStore.locale === 'en' ? 'Close' : '关闭' }}
                </button>
              </div>

              <form class="mt-6 grid gap-4" @submit.prevent="submitCustomer">
                <div class="grid gap-3 md:grid-cols-2">
                  <div>
                    <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Name' : '名称' }}</label>
                    <input v-model="customerForm.name" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Company' : '公司' }}</label>
                    <input v-model="customerForm.companyName" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </div>
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <div>
                    <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Contact' : '联系人' }}</label>
                    <input v-model="customerForm.contactName" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Phone' : '电话' }}</label>
                    <input v-model="customerForm.phone" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </div>
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <div>
                    <label class="text-xs uppercase tracking-wide text-slate-500">Email</label>
                    <input v-model="customerForm.email" type="email" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </div>
                  <div>
                    <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Active' : '启用' }}</label>
                    <select v-model="customerForm.isActive" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                      <option :value="true">{{ localeStore.locale === 'en' ? 'Active' : '启用' }}</option>
                      <option :value="false">{{ localeStore.locale === 'en' ? 'Inactive' : '停用' }}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Address' : '地址' }}</label>
                  <textarea v-model="customerForm.address" rows="2" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"></textarea>
                </div>
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Notes' : '备注' }}</label>
                  <textarea v-model="customerForm.notes" rows="2" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"></textarea>
                </div>

                <div class="flex justify-end gap-2">
                  <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2 text-sm" @click="customerModalOpen = false">
                    {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
                  </button>
                  <button type="submit" class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
                    {{ localeStore.locale === 'en' ? 'Save' : '保存' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
