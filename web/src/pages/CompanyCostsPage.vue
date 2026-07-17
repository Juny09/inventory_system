<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'
import { exportToCsv } from '../utils/export'
import { useFormDraft } from '../composables/useFormDraft'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend)

const localeStore = useLocaleStore()
const activeTab = ref('manage')
const loading = ref(false)
const errorMessage = ref('')

const quickCategories = [
  { key: 'rental', label: 'rental' },
  { key: 'electricity', label: 'ele' },
  { key: 'water_bill', label: 'water bill' },
  { key: 'internet', label: 'internet' },
  { key: 'salary', label: 'salary' },
  { key: 'misc', label: 'misc' },
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

function ymLabel(year, month) {
  return `${year}-${pad2(month)}`
}

function resolveNowYm() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function addMonths(year, month, diff) {
  const d = new Date(Date.UTC(year, month - 1, 1))
  d.setUTCMonth(d.getUTCMonth() + diff)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

const selected = reactive({
  year: resolveNowYm().year,
  month: resolveNowYm().month,
})

const formOpen = ref(false)
const formMode = ref('create')
const editingId = ref(null)
const form = reactive({
  periodYear: selected.year,
  periodMonth: selected.month,
  categoryLabel: '',
  amount: '',
  occurredDate: '',
  notes: '',
})
const draftKey = computed(() => `company-cost-form:${formMode.value}:${editingId.value || 'new'}`)
const formDraft = useFormDraft({
  storageKey: draftKey,
  // 中文说明：公司成本弹窗先记住输入内容，重新打开还能接着改。
  buildState: () => ({ ...form }),
  applyState: (draft) => {
    if (!draft || typeof draft !== 'object') return
    Object.assign(form, draft)
  },
})

const items = ref([])

function defaultOccurredDate(year, month) {
  return `${year}-${pad2(month)}-01`
}

function openCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.periodYear = selected.year
  form.periodMonth = selected.month
  form.categoryLabel = ''
  form.amount = ''
  form.occurredDate = defaultOccurredDate(selected.year, selected.month)
  form.notes = ''
  formOpen.value = true
  formDraft.restoreDraft()
}

function openEdit(row) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.periodYear = row.period_year
  form.periodMonth = row.period_month
  form.categoryLabel = row.category_label
  form.amount = String(row.amount ?? '')
  form.occurredDate = row.occurred_date
  form.notes = row.notes || ''
  formOpen.value = true
  formDraft.restoreDraft()
}

function pickCategory(value) {
  form.categoryLabel = value
}

async function loadList() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data } = await api.get('/company-costs', {
      params: { year: selected.year, month: selected.month },
    })
    items.value = data.items || []
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load company costs.'
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  loading.value = true
  errorMessage.value = ''

  try {
    const payload = {
      periodYear: Number(form.periodYear),
      periodMonth: Number(form.periodMonth),
      categoryLabel: form.categoryLabel,
      amount: Number(form.amount),
      occurredDate: form.occurredDate,
      notes: form.notes || undefined,
    }

    if (formMode.value === 'create') {
      await api.post('/company-costs', payload)
    } else {
      await api.put(`/company-costs/${editingId.value}`, payload)
    }

    formDraft.clearDraft()
    formOpen.value = false
    await loadList()
    await loadSummary()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to save company cost.'
  } finally {
    loading.value = false
  }
}

async function removeRow(row) {
  if (!confirm(localeStore.locale === 'en' ? 'Delete this cost?' : '确认删除这条成本记录？')) return
  loading.value = true
  errorMessage.value = ''

  try {
    await api.delete(`/company-costs/${row.id}`)
    await loadList()
    await loadSummary()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to delete company cost.'
  } finally {
    loading.value = false
  }
}

function exportMonthCsv() {
  if (!items.value.length) return
  const columns = [
    { key: 'period_year', label: localeStore.locale === 'en' ? 'Year' : '年' },
    { key: 'period_month', label: localeStore.locale === 'en' ? 'Month' : '月' },
    { key: 'category_label', label: localeStore.locale === 'en' ? 'Category' : '类目' },
    { key: 'amount', label: localeStore.locale === 'en' ? 'Amount' : '金额' },
    { key: 'occurred_date', label: localeStore.locale === 'en' ? 'Date' : '发生日期' },
    { key: 'notes', label: localeStore.locale === 'en' ? 'Notes' : '备注' },
  ]
  exportToCsv(`company_costs_${ymLabel(selected.year, selected.month)}.csv`, columns, items.value)
}

const summaryRange = reactive({
  start: addMonths(selected.year, selected.month, -11),
  end: { year: selected.year, month: selected.month },
})

const summary = ref({ range: {}, monthTotals: [], breakdown: [] })
const summaryLoading = ref(false)
const summaryError = ref('')
const selectedBreakdownMonth = ref(ymLabel(selected.year, selected.month))

async function loadSummary() {
  summaryLoading.value = true
  summaryError.value = ''

  try {
    const { data } = await api.get('/company-costs/summary', {
      params: {
        startYear: summaryRange.start.year,
        startMonth: summaryRange.start.month,
        endYear: summaryRange.end.year,
        endMonth: summaryRange.end.month,
      },
    })
    summary.value = data
  } catch (error) {
    summaryError.value = error.response?.data?.message || 'Failed to load cost summary.'
  } finally {
    summaryLoading.value = false
  }
}

const monthLabels = computed(() =>
  (summary.value.monthTotals || []).map((row) => ymLabel(row.periodYear, row.periodMonth)),
)

const monthTotalsMap = computed(() => {
  const map = new Map()
  ;(summary.value.monthTotals || []).forEach((row) => {
    map.set(ymLabel(row.periodYear, row.periodMonth), Number(row.totalAmount || 0))
  })
  return map
})

const latestMonthLabel = computed(() => monthLabels.value[monthLabels.value.length - 1] || '')

const momChange = computed(() => {
  const labels = monthLabels.value
  if (labels.length < 2) return null
  const cur = monthTotalsMap.value.get(labels[labels.length - 1]) || 0
  const prev = monthTotalsMap.value.get(labels[labels.length - 2]) || 0
  if (!prev) return null
  return ((cur - prev) / prev) * 100
})

const yoyChange = computed(() => {
  const latest = latestMonthLabel.value
  if (!latest) return null
  const [y, m] = latest.split('-').map((v) => Number(v))
  const lastYearLabel = ymLabel(y - 1, m)
  const cur = monthTotalsMap.value.get(latest) || 0
  const prev = monthTotalsMap.value.get(lastYearLabel)
  if (prev === undefined || !prev) return null
  return ((cur - prev) / prev) * 100
})

function formatPct(value) {
  if (value === null || value === undefined) return localeStore.locale === 'en' ? 'N/A' : '暂无'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

const totalsChartData = computed(() => ({
  labels: monthLabels.value,
  datasets: [
    {
      label: localeStore.locale === 'en' ? 'Total cost' : '成本总额',
      data: monthLabels.value.map((label) => monthTotalsMap.value.get(label) || 0),
      borderColor: '#0f172a',
      backgroundColor: 'rgba(37, 99, 235, 0.2)',
      fill: true,
      tension: 0.35,
    },
  ],
}))

const totalsChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
}))

const breakdownRows = computed(() => {
  const target = selectedBreakdownMonth.value
  const [year, month] = target.split('-').map((v) => Number(v))
  return (summary.value.breakdown || []).filter((row) => row.periodYear === year && row.periodMonth === month)
})

const breakdownChartData = computed(() => ({
  labels: breakdownRows.value.map((r) => r.categoryLabel),
  datasets: [
    {
      label: localeStore.locale === 'en' ? 'Category breakdown' : '类目分布',
      data: breakdownRows.value.map((r) => Number(r.totalAmount || 0)),
      backgroundColor: ['#0f172a', '#2563eb', '#0891b2', '#16a34a', '#f97316', '#e11d48', '#7c3aed', '#334155'],
    },
  ],
}))

const breakdownChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
}))

function formatMoney(value) {
  return Number(value || 0).toFixed(2)
}

onMounted(async () => {
  selectedBreakdownMonth.value = ymLabel(selected.year, selected.month)
  form.occurredDate = defaultOccurredDate(selected.year, selected.month)
  await Promise.all([loadList(), loadSummary()])
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Analytics</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Company Costs' : '公司成本' }}
          </h2>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-2 text-sm"
            :class="activeTab === 'manage' ? 'bg-slate-900 text-white' : ''"
            @click="activeTab = 'manage'"
          >
            {{ localeStore.locale === 'en' ? 'Manage' : '录入/管理' }}
          </button>
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-2 text-sm"
            :class="activeTab === 'dashboard' ? 'bg-slate-900 text-white' : ''"
            @click="activeTab = 'dashboard'"
          >
            {{ localeStore.locale === 'en' ? 'Dashboard' : '仪表盘' }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="activeTab === 'manage'" class="mt-6 grid gap-6">
        <div class="rounded-3xl border border-slate-200 bg-white">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div class="flex flex-wrap items-center gap-3">
              <select v-model.number="selected.year" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm" @change="loadList">
                <option v-for="y in [selected.year - 1, selected.year, selected.year + 1]" :key="y" :value="y">{{ y }}</option>
              </select>
              <select v-model.number="selected.month" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm" @change="loadList">
                <option v-for="m in 12" :key="m" :value="m">{{ pad2(m) }}</option>
              </select>
              <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2 text-sm" @click="exportMonthCsv">
                {{ localeStore.locale === 'en' ? 'Export CSV' : '导出 CSV' }}
              </button>
            </div>

            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white" @click="openCreate">
                {{ localeStore.locale === 'en' ? 'Add cost' : '新增成本' }}
              </button>
            </div>
          </div>

          <div v-if="loading" class="px-5 py-6 text-sm text-slate-500">
            {{ localeStore.locale === 'en' ? 'Loading...' : '加载中...' }}
          </div>

          <div v-else class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Category' : '类目' }}</th>
                  <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Amount' : '金额' }}</th>
                  <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Date' : '发生日期' }}</th>
                  <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Notes' : '备注' }}</th>
                  <th class="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in items" :key="row.id" class="border-t border-slate-200">
                  <td class="px-5 py-3 font-medium text-slate-900">{{ row.category_label }}</td>
                  <td class="px-5 py-3 text-slate-700">{{ formatMoney(row.amount) }}</td>
                  <td class="px-5 py-3 text-slate-700">{{ row.occurred_date }}</td>
                  <td class="px-5 py-3 text-slate-700">{{ row.notes || '-' }}</td>
                  <td class="px-5 py-3">
                    <div class="flex justify-end gap-2">
                      <button type="button" class="rounded-xl border border-slate-300 px-3 py-1 text-xs" @click="openEdit(row)">
                        {{ localeStore.locale === 'en' ? 'Edit' : '编辑' }}
                      </button>
                      <button type="button" class="rounded-xl border border-rose-300 px-3 py-1 text-xs text-rose-600" @click="removeRow(row)">
                        {{ localeStore.locale === 'en' ? 'Delete' : '删除' }}
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!items.length">
                  <td colspan="5" class="px-5 py-6 text-center text-slate-500">
                    {{ localeStore.locale === 'en' ? 'No costs for this month.' : '这个月还没有成本记录。' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div
          v-if="formOpen"
          class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 px-4 py-8"
        >
          <div class="w-full max-w-xl rounded-3xl bg-white p-6">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-xl font-semibold text-slate-900">
                  {{ formMode === 'create' ? (localeStore.locale === 'en' ? 'Add cost' : '新增成本') : (localeStore.locale === 'en' ? 'Edit cost' : '编辑成本') }}
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  {{ localeStore.locale === 'en' ? 'Same month + same category will be blocked.' : '同月份同类目会自动防止重复录入。' }}
                </p>
              </div>
              <button type="button" class="rounded-xl border border-slate-200 px-3 py-1 text-sm" @click="formOpen = false">
                {{ localeStore.locale === 'en' ? 'Close' : '关闭' }}
              </button>
            </div>

            <form class="mt-6 grid gap-4" @submit.prevent="submitForm">
              <div class="grid gap-3 md:grid-cols-2">
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Year' : '年' }}</label>
                  <input v-model.number="form.periodYear" type="number" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                </div>
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Month' : '月' }}</label>
                  <input v-model.number="form.periodMonth" type="number" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                </div>
              </div>

              <div>
                <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Category' : '类目' }}</label>
                <div class="mt-2 flex flex-wrap gap-2">
                  <button
                    v-for="cat in quickCategories"
                    :key="cat.key"
                    type="button"
                    class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    @click="pickCategory(cat.label)"
                  >
                    {{ cat.label }}
                  </button>
                </div>
                <input
                  v-model="form.categoryLabel"
                  type="text"
                  class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  :placeholder="localeStore.locale === 'en' ? 'e.g. rental / ele / water bill ...' : '例如：rental / ele / water bill ...'"
                />
              </div>

              <div class="grid gap-3 md:grid-cols-2">
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Amount' : '金额' }}</label>
                  <input v-model="form.amount" type="number" step="0.01" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                </div>
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Occurred date' : '发生日期' }}</label>
                  <input v-model="form.occurredDate" type="date" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                </div>
              </div>

              <div>
                <label class="text-xs uppercase tracking-wide text-slate-500">{{ localeStore.locale === 'en' ? 'Notes' : '备注' }}</label>
                <textarea v-model="form.notes" rows="3" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"></textarea>
              </div>

              <div class="flex justify-end gap-2">
                <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2 text-sm" @click="formOpen = false">
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

      <div v-else class="mt-6 grid gap-6">
        <p v-if="summaryError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ summaryError }}</p>

        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-3xl border border-slate-200 bg-white px-5 py-4">
            <p class="text-sm text-slate-500">{{ localeStore.locale === 'en' ? 'Latest month' : '最新月份' }}</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ latestMonthLabel || '-' }}</p>
          </div>
          <div class="rounded-3xl border border-slate-200 bg-white px-5 py-4">
            <p class="text-sm text-slate-500">{{ localeStore.locale === 'en' ? 'MoM change' : '环比' }}</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ formatPct(momChange) }}</p>
          </div>
          <div class="rounded-3xl border border-slate-200 bg-white px-5 py-4">
            <p class="text-sm text-slate-500">{{ localeStore.locale === 'en' ? 'YoY change' : '同比' }}</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ formatPct(yoyChange) }}</p>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div class="border-b border-slate-200 px-5 py-4">
              <h3 class="text-xl font-semibold text-slate-900">
                {{ localeStore.locale === 'en' ? 'Monthly trend' : '月度趋势' }}
              </h3>
            </div>
            <div class="h-[360px] px-4 py-4">
              <Line :data="totalsChartData" :options="totalsChartOptions" />
            </div>
          </div>

          <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h3 class="text-xl font-semibold text-slate-900">
                {{ localeStore.locale === 'en' ? 'Category distribution' : '类目分布' }}
              </h3>
              <select v-model="selectedBreakdownMonth" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                <option v-for="label in monthLabels" :key="label" :value="label">{{ label }}</option>
              </select>
            </div>
            <div class="h-[360px] px-4 py-4">
              <Doughnut :data="breakdownChartData" :options="breakdownChartOptions" />
            </div>
            <div class="border-t border-slate-200 px-5 py-4 text-sm text-slate-600">
              <p v-if="!breakdownRows.length">{{ localeStore.locale === 'en' ? 'No breakdown data.' : '暂无类目分布数据。' }}</p>
              <div v-else class="grid gap-2">
                <div v-for="row in breakdownRows" :key="row.categoryKey" class="flex items-center justify-between">
                  <span>{{ row.categoryLabel }}</span>
                  <span class="font-semibold">{{ formatMoney(row.totalAmount) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="summaryLoading" class="rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
          {{ localeStore.locale === 'en' ? 'Loading summary...' : '汇总加载中...' }}
        </div>
      </div>
    </section>
  </AppLayout>
</template>
