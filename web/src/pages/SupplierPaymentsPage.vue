<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'
import PaymentScheduleFormModal from '../components/PaymentScheduleFormModal.vue'
import PaymentScheduleBatchModal from '../components/PaymentScheduleBatchModal.vue'
import AddPaymentModal from '../components/AddPaymentModal.vue'

const route = useRoute()
const router = useRouter()
const localeStore = useLocaleStore()

// ============== Shared ==============
const activeTab = ref('paid') // 'paid' | 'schedules'
const errorMessage = ref('')

// ============== Tab 1: Paid Records ==============
const loading = ref(false)
const suppliers = ref([])
const selectedYear = ref(new Date().getFullYear())
const months = ref([])
const showForm = ref(false)
const formLoading = ref(false)
const formError = ref('')

const form = ref({
  supplierId: '',
  periodMonth: new Date().getMonth() + 1,
  periodYear: new Date().getFullYear(),
  paidDate: '',
  amount: '',
  notes: '',
})

const MONTH_NAMES_EN = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_NAMES_CN = [
  '', '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

function monthLabel(month) {
  return localeStore.locale === 'en' ? MONTH_NAMES_EN[month] : MONTH_NAMES_CN[month]
}

const yearOptions = computed(() => {
  const current = new Date().getFullYear()
  const options = []
  for (let y = current + 1; y >= current - 5; y--) {
    options.push(y)
  }
  return options
})

const supplierList = computed(() =>
  suppliers.value.map((s) => ({
    id: s.supplier_id,
    name: s.supplier_name + (s.supplier_branch ? ` (${s.supplier_branch})` : ''),
    payments: s.payments || [],
  })),
)

// Map for schedule modals: { id, name, company_name }
const supplierOptions = computed(() =>
  suppliers.value.map((s) => ({
    id: s.supplier_id,
    name: s.supplier_name,
    company_name: s.supplier_branch || '',
  })),
)

function isMonthPaid(supplierPayments, month) {
  return supplierPayments.some((p) => p.period_month === month)
}

function getPaymentRecord(supplierPayments, month) {
  return supplierPayments.find((p) => p.period_month === month)
}

async function loadSummary() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get('/supplier-payments/summary', {
      params: { year: selectedYear.value },
    })
    suppliers.value = data.suppliers
    months.value = data.months
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load payment records.', '加载还账记录失败。')
  } finally {
    loading.value = false
  }
}

function openAddForm(supplierId, month) {
  form.value = {
    supplierId: String(supplierId),
    periodMonth: month,
    periodYear: selectedYear.value,
    paidDate: new Date().toISOString().slice(0, 10),
    amount: '',
    notes: '',
  }
  formError.value = ''
  showForm.value = true
}

function openEmptyForm() {
  form.value = {
    supplierId: route.query.supplierId ? String(route.query.supplierId) : '',
    periodMonth: new Date().getMonth() + 1,
    periodYear: selectedYear.value,
    paidDate: new Date().toISOString().slice(0, 10),
    amount: '',
    notes: '',
  }
  formError.value = ''
  showForm.value = true
}

async function submitPayment() {
  formError.value = ''
  formLoading.value = true
  try {
    await api.post('/supplier-payments', {
      supplierId: Number(form.value.supplierId),
      periodMonth: Number(form.value.periodMonth),
      periodYear: Number(form.value.periodYear),
      paidDate: form.value.paidDate || null,
      amount: form.value.amount ? Number(form.value.amount) : null,
      notes: form.value.notes || null,
    })
    showForm.value = false
    await loadSummary()
  } catch (error) {
    formError.value = error.response?.data?.message || tr('Failed to save payment record.', '保存还账记录失败。')
  } finally {
    formLoading.value = false
  }
}

async function deletePayment(id) {
  try {
    await api.delete(`/supplier-payments/${id}`)
    await loadSummary()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to delete payment record.', '删除还账记录失败。')
  }
}

function back() {
  router.push({ name: 'suppliers' })
}

function goToSupplier(supplierId) {
  router.push({ name: 'supplier-detail', params: { id: String(supplierId) } })
}

// ============== Tab 2: Payment Schedules ==============
const schedulesLoading = ref(false)
const schedules = ref([])
const schedulesTotal = ref(0)
const schedulesPage = ref(1)
const schedulesPageSize = ref(50)
const upcomingCount = ref(0)
const overdueCount = ref(0)
const filterSupplier = ref('')
const filterStatus = ref('')
const filterYear = ref(new Date().getFullYear())

const showScheduleForm = ref(false)
const editingScheduleId = ref(null)
const editingScheduleData = ref(null)
const showBatchModal = ref(false)
const showAddPaymentModal = ref(false)
const addingPaymentSchedule = ref(null)

async function loadSchedules() {
  schedulesLoading.value = true
  errorMessage.value = ''
  try {
    const params = { page: schedulesPage.value, pageSize: schedulesPageSize.value, year: filterYear.value }
    if (filterSupplier.value) params.supplierId = filterSupplier.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await api.get('/supplier-payment-schedules', { params })
    schedules.value = data.items || []
    schedulesTotal.value = data.total || 0
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load payment schedules.', '加载还款计划失败。')
  } finally {
    schedulesLoading.value = false
  }
}

async function loadAlertCounts() {
  try {
    const [u, o] = await Promise.all([
      api.get('/supplier-payment-schedules/upcoming', { params: { days: 7 } }),
      api.get('/supplier-payment-schedules/overdue'),
    ])
    upcomingCount.value = (u.data.items || []).length
    overdueCount.value = (o.data.items || []).length
  } catch (_) {
    // silent
  }
}

function openNewSchedule() {
  editingScheduleId.value = null
  editingScheduleData.value = null
  showScheduleForm.value = true
}

function openEditSchedule(row) {
  editingScheduleId.value = row.id
  editingScheduleData.value = { ...row }
  showScheduleForm.value = true
}

function openBatch() {
  showBatchModal.value = true
}

function openAddPayment(row) {
  addingPaymentSchedule.value = { ...row, period_label: `${monthLabel(row.period_month)} ${row.period_year}` }
  showAddPaymentModal.value = true
}

async function markPaid(row) {
  if (!confirm(tr('Mark this schedule as fully paid?', '确认将该还款计划标记为已付清？'))) return
  try {
    await api.post(`/supplier-payment-schedules/${row.id}/mark-paid`)
    await Promise.all([loadSchedules(), loadAlertCounts()])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to mark as paid.', '标记失败。')
  }
}

async function deleteSchedule(row) {
  if (!confirm(tr('Delete this schedule?', '确认删除该还款计划？'))) return
  try {
    await api.delete(`/supplier-payment-schedules/${row.id}`)
    await Promise.all([loadSchedules(), loadAlertCounts()])
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to delete.', '删除失败。')
  }
}

async function onScheduleSaved() {
  showScheduleForm.value = false
  await Promise.all([loadSchedules(), loadAlertCounts(), loadSummary()])
}

async function onBatchSaved() {
  await Promise.all([loadSchedules(), loadAlertCounts()])
}

async function onPaymentAdded() {
  showAddPaymentModal.value = false
  addingPaymentSchedule.value = null
  await Promise.all([loadSchedules(), loadAlertCounts(), loadSummary()])
}

function statusBadgeClass(status) {
  switch (status) {
    case 'PAID': return 'bg-emerald-100 text-emerald-700'
    case 'PARTIAL': return 'bg-amber-100 text-amber-700'
    case 'OVERDUE': return 'bg-rose-100 text-rose-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

function statusLabel(status) {
  const map = {
    PENDING: tr('Pending', '待付'),
    PARTIAL: tr('Partial', '部分付'),
    PAID: tr('Paid', '已付清'),
    OVERDUE: tr('Overdue', '已逾期'),
  }
  return map[status] || status
}

function formatAmount(v) {
  return Number(v || 0).toFixed(2)
}

function formatDate(d) {
  return String(d || '').slice(0, 10)
}

async function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'schedules') {
    await Promise.all([loadSchedules(), loadAlertCounts()])
  }
}

onMounted(async () => {
  if (route.query.supplierId) {
    form.value.supplierId = String(route.query.supplierId)
    filterSupplier.value = String(route.query.supplierId)
  }
  await loadSummary()
  if (route.query.tab === 'schedules') {
    await switchTab('schedules')
  }
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Master Data</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Supplier payment records', '供应商还账记录') }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ tr('Track monthly payments to each supplier and schedule upcoming repayments.', '记录每月还账情况并管理未来的分期还款计划。') }}</p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" @click="back">
            {{ tr('Back to suppliers', '返回供应商列表') }}
          </button>
          <button
            v-if="activeTab === 'paid'"
            class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            @click="openEmptyForm"
          >
            {{ tr('Add record', '新增记录') }}
          </button>
          <template v-else>
            <button class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" @click="openBatch">
              {{ tr('Generate Year', '批量生成') }}
            </button>
            <button class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" @click="openNewSchedule">
              + {{ tr('New Schedule', '新建还款计划') }}
            </button>
          </template>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <!-- Tabs -->
      <div class="mt-6 flex gap-2 border-b border-slate-200">
        <button
          class="px-4 py-2 text-sm font-semibold"
          :class="activeTab === 'paid' ? 'border-b-2 border-brand-500 text-brand-600' : 'text-slate-500 hover:text-slate-700'"
          @click="switchTab('paid')"
        >
          {{ tr('Paid Records', '还账记录') }}
        </button>
        <button
          class="px-4 py-2 text-sm font-semibold"
          :class="activeTab === 'schedules' ? 'border-b-2 border-brand-500 text-brand-600' : 'text-slate-500 hover:text-slate-700'"
          @click="switchTab('schedules')"
        >
          {{ tr('Payment Schedules', '还款计划') }}
          <span v-if="overdueCount > 0" class="ml-1 inline-flex items-center rounded-full bg-rose-100 px-2 text-xs font-semibold text-rose-700">{{ overdueCount }}</span>
        </button>
      </div>

      <!-- ========== TAB 1: Paid Records ========== -->
      <div v-if="activeTab === 'paid'">
        <!-- Year selector -->
        <div class="mt-6 flex items-center gap-3">
          <label class="text-sm font-semibold text-slate-700">{{ tr('Year', '年份') }}:</label>
          <select
            v-model="selectedYear"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500"
            @change="loadSummary"
          >
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <!-- Add / Edit Form Modal (inline) -->
        <div v-if="showForm" class="mt-4 rounded-3xl border border-brand-200 bg-brand-50 p-5">
          <h3 class="text-lg font-semibold text-slate-900">{{ tr('Record payment', '记录还账') }}</h3>
          <p v-if="formError" class="mt-2 text-sm text-rose-600">{{ formError }}</p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-600">{{ tr('Supplier', '供应商') }}</label>
              <select v-model="form.supplierId" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-500">
                <option value="" disabled>{{ tr('Select supplier', '选择供应商') }}</option>
                <option v-for="s in supplierList" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-600">{{ tr('Month', '月份') }}</label>
              <select v-model="form.periodMonth" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-500">
                <option v-for="m in 12" :key="m" :value="m">{{ monthLabel(m) }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-600">{{ tr('Paid date', '还款日期') }}</label>
              <input v-model="form.paidDate" type="date" class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-600">{{ tr('Amount', '金额') }}</label>
              <input v-model="form.amount" type="number" step="0.01" min="0" placeholder="0.00" class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500" />
            </div>
            <div class="sm:col-span-2">
              <label class="mb-1 block text-xs font-semibold text-slate-600">{{ tr('Notes', '备注') }}</label>
              <input v-model="form.notes" type="text" :placeholder="tr('Optional notes', '可选备注')" class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500" />
            </div>
          </div>
          <div class="mt-4 flex gap-3">
            <button class="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white" :disabled="formLoading || !form.supplierId" @click="submitPayment">
              {{ formLoading ? tr('Saving...', '保存中...') : tr('Save', '保存') }}
            </button>
            <button class="rounded-2xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700" @click="showForm = false">
              {{ tr('Cancel', '取消') }}
            </button>
          </div>
        </div>

        <!-- Payment Matrix Table -->
        <div v-if="loading" class="mt-6 rounded-3xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
          {{ tr('Loading...', '加载中...') }}
        </div>

        <div v-else class="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="sticky left-0 z-10 bg-slate-50 px-4 py-4">{{ tr('Supplier', '供应商') }}</th>
                  <th v-for="m in 12" :key="m" class="min-w-[60px] px-2 py-4 text-center">{{ monthLabel(m) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in supplierList" :key="s.id" class="border-t border-slate-100">
                  <td class="sticky left-0 z-10 bg-white px-4 py-3">
                    <button class="font-semibold text-brand-600 hover:underline" @click="goToSupplier(s.id)">
                      {{ s.name }}
                    </button>
                  </td>
                  <td v-for="m in 12" :key="m" class="px-1 py-3 text-center">
                    <template v-if="isMonthPaid(s.payments, m)">
                      <button
                        class="inline-flex items-center justify-center rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                        :title="tr('Click to delete', '点击删除')"
                        @click="deletePayment(getPaymentRecord(s.payments, m).id)"
                      >
                        ✓
                      </button>
                    </template>
                    <template v-else>
                      <button
                        class="inline-flex items-center justify-center rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-400 hover:border-brand-400 hover:text-brand-500"
                        :title="tr('Mark as paid', '标记为已还')"
                        @click="openAddForm(s.id, m)"
                      >
                        +
                      </button>
                    </template>
                  </td>
                </tr>
                <tr v-if="supplierList.length === 0">
                  <td :colspan="13" class="px-4 py-6 text-center text-sm text-slate-500">
                    {{ tr('No active suppliers found.', '暂无启用中的供应商。') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ========== TAB 2: Payment Schedules ========== -->
      <div v-else-if="activeTab === 'schedules'">
        <!-- Alert Cards -->
        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <div class="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-wider text-amber-700">{{ tr('Upcoming (7 days)', '即将到期（7天内）') }}</p>
            <p class="mt-1 text-2xl font-bold text-amber-800">{{ upcomingCount }}</p>
          </div>
          <div class="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-wider text-rose-700">{{ tr('Overdue', '已逾期') }}</p>
            <p class="mt-1 text-2xl font-bold text-rose-800">{{ overdueCount }}</p>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-600">{{ tr('Supplier', '供应商') }}</label>
            <select v-model="filterSupplier" class="mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm" @change="loadSchedules">
              <option value="">{{ tr('All', '全部') }}</option>
              <option v-for="s in supplierList" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600">{{ tr('Status', '状态') }}</label>
            <select v-model="filterStatus" class="mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm" @change="loadSchedules">
              <option value="">{{ tr('All', '全部') }}</option>
              <option value="PENDING">{{ tr('Pending', '待付') }}</option>
              <option value="PARTIAL">{{ tr('Partial', '部分付') }}</option>
              <option value="PAID">{{ tr('Paid', '已付清') }}</option>
              <option value="OVERDUE">{{ tr('Overdue', '已逾期') }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600">{{ tr('Year', '年份') }}</label>
            <select v-model="filterYear" class="mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm" @change="loadSchedules">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
        </div>

        <!-- Schedules Table -->
        <div v-if="schedulesLoading" class="mt-6 rounded-3xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
          {{ tr('Loading...', '加载中...') }}
        </div>
        <div v-else class="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-3">{{ tr('Supplier', '供应商') }}</th>
                  <th class="px-3 py-3">{{ tr('Period', '账期') }}</th>
                  <th class="px-3 py-3">{{ tr('Due Date', '到期日') }}</th>
                  <th class="px-3 py-3 text-right">{{ tr('Amount Due', '应付') }}</th>
                  <th class="px-3 py-3 text-right">{{ tr('Paid', '已付') }}</th>
                  <th class="px-3 py-3 text-right">{{ tr('Remaining', '剩余') }}</th>
                  <th class="px-3 py-3">{{ tr('Status', '状态') }}</th>
                  <th class="px-3 py-3">{{ tr('Remind', '提醒') }}</th>
                  <th class="px-3 py-3 text-right">{{ tr('Actions', '操作') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in schedules" :key="row.id" class="border-t border-slate-100 hover:bg-slate-50">
                  <td class="px-4 py-3 font-medium text-slate-800">
                    {{ row.supplier_name }}<span v-if="row.supplier_branch" class="ml-1 text-xs text-slate-400">({{ row.supplier_branch }})</span>
                  </td>
                  <td class="px-3 py-3 text-slate-600">{{ monthLabel(row.period_month) }} {{ row.period_year }}</td>
                  <td class="px-3 py-3 text-slate-600">{{ formatDate(row.due_date) }}</td>
                  <td class="px-3 py-3 text-right text-slate-800">{{ formatAmount(row.amount_due) }}</td>
                  <td class="px-3 py-3 text-right text-slate-800">{{ formatAmount(row.amount_paid) }}</td>
                  <td class="px-3 py-3 text-right text-slate-800">{{ formatAmount(Number(row.amount_due) - Number(row.amount_paid)) }}</td>
                  <td class="px-3 py-3">
                    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" :class="statusBadgeClass(row.status)">
                      {{ statusLabel(row.status) }}
                    </span>
                  </td>
                  <td class="px-3 py-3 text-xs text-slate-500">{{ tr(`${row.remind_days_before}d before`, `提前${row.remind_days_before}天`) }}</td>
                  <td class="px-3 py-3 text-right">
                    <div class="flex flex-wrap justify-end gap-1">
                      <button
                        v-if="row.status !== 'PAID'"
                        class="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        @click="openAddPayment(row)"
                      >
                        {{ tr('Add Payment', '登记付款') }}
                      </button>
                      <button
                        v-if="row.status !== 'PAID'"
                        class="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        @click="markPaid(row)"
                      >
                        {{ tr('Mark Paid', '标记已付') }}
                      </button>
                      <button class="rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" @click="openEditSchedule(row)">
                        {{ tr('Edit', '编辑') }}
                      </button>
                      <button class="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100" @click="deleteSchedule(row)">
                        {{ tr('Delete', '删除') }}
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="schedules.length === 0">
                  <td :colspan="9" class="px-4 py-6 text-center text-sm text-slate-500">
                    {{ tr('No payment schedules found.', '暂无还款计划。') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- Schedule Form Modal -->
    <PaymentScheduleFormModal
      v-if="showScheduleForm"
      :id="editingScheduleId"
      :suppliers="supplierOptions"
      :initial-data="editingScheduleData"
      :defaults="{ period_year: filterYear }"
      @close="showScheduleForm = false"
      @saved="onScheduleSaved"
    />

    <!-- Batch Generate Modal -->
    <PaymentScheduleBatchModal
      v-if="showBatchModal"
      :suppliers="supplierOptions"
      @close="showBatchModal = false"
      @saved="onBatchSaved"
    />

    <!-- Add Payment Modal -->
    <AddPaymentModal
      v-if="showAddPaymentModal && addingPaymentSchedule"
      :schedule="addingPaymentSchedule"
      @close="showAddPaymentModal = false"
      @saved="onPaymentAdded"
    />
  </AppLayout>
</template>
