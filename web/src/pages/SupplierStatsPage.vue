<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
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
import { downloadDataUrl } from '../utils/productHelpers'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
)

const localeStore = useLocaleStore()
const loading = ref(false)
const errorMessage = ref('')

const filters = reactive({
  startDate: '',
  endDate: '',
})

const view = ref('chart')
const chartType = ref('bar')
const datasetKey = ref('totalsBySupplier')
const metricKey = ref('totalAmount')
const chartRef = ref(null)

const stats = ref({
  period: { startDate: '', endDate: '' },
  globalInvoiceTotal: 0,
  totalsBySupplier: [],
  topSuppliersByPurchaseCount: [],
})

function utcDateToYmd(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function resolveLastMonthRange() {
  const now = new Date()
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  return { startDate: utcDateToYmd(lastMonthStart), endDate: utcDateToYmd(lastMonthEnd), endExclusive: utcDateToYmd(thisMonthStart) }
}

async function loadStats() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data } = await api.get('/supplier-stats', {
      params: {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        topN: 10,
      },
    })

    stats.value = data
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load supplier stats.'
  } finally {
    loading.value = false
  }
}

const activeRows = computed(() => {
  if (datasetKey.value === 'totalsBySupplier') return stats.value.totalsBySupplier || []
  if (datasetKey.value === 'topSuppliersByPurchaseCount') return stats.value.topSuppliersByPurchaseCount || []
  return []
})

const chartComponentMap = {
  line: Line,
  bar: Bar,
  doughnut: Doughnut,
}

const chartComponent = computed(() => chartComponentMap[chartType.value] || Bar)

const yAxisLabel = computed(() => {
  if (datasetKey.value === 'totalsBySupplier') return localeStore.locale === 'en' ? 'Invoice amount' : '发票金额'
  if (metricKey.value === 'orderCount') return localeStore.locale === 'en' ? 'Order count' : '订单量'
  return localeStore.locale === 'en' ? 'Amount' : '金额'
})

const chartData = computed(() => {
  const rows = activeRows.value
  const labels = rows.map((row) => row.supplierName)

  const dataKey = datasetKey.value === 'totalsBySupplier' ? 'totalAmount' : metricKey.value
  const values = rows.map((row) => Number(row?.[dataKey] || 0))

  const label =
    datasetKey.value === 'totalsBySupplier'
      ? localeStore.locale === 'en'
        ? 'Total by supplier'
        : '分供应商总金额'
      : metricKey.value === 'orderCount'
        ? localeStore.locale === 'en'
          ? 'Top suppliers by order count'
          : 'TOP供应商（按订单量）'
        : localeStore.locale === 'en'
          ? 'Top suppliers by amount'
          : 'TOP供应商（按金额）'

  return {
    labels,
    datasets: [
      {
        label,
        data: values,
        borderColor: '#0f172a',
        backgroundColor:
          chartType.value === 'doughnut'
            ? ['#0f172a', '#2563eb', '#0891b2', '#16a34a', '#f97316', '#e11d48', '#7c3aed', '#334155']
            : 'rgba(37, 99, 235, 0.2)',
        fill: chartType.value === 'line',
        tension: 0.35,
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: chartType.value === 'doughnut',
      position: 'bottom',
    },
    tooltip: {
      callbacks: {
        label(context) {
          const value = Number(context.raw || 0)
          if (datasetKey.value === 'topSuppliersByPurchaseCount' && metricKey.value === 'orderCount') {
            return `${context.label}: ${value}`
          }
          return `${context.label}: ${value.toFixed(2)}`
        },
      },
    },
  },
  scales:
    chartType.value === 'doughnut'
      ? {}
      : {
          y: {
            beginAtZero: true,
            title: { display: true, text: yAxisLabel.value },
          },
          x: { ticks: { autoSkip: true, maxRotation: 0 } },
        },
}))

const topSupplier = computed(() => (stats.value.topSuppliersByPurchaseCount || [])[0] || null)

function formatMoney(value) {
  return Number(value || 0).toFixed(2)
}

function exportCurrentCsv() {
  if (!activeRows.value.length) return

  const columns =
    datasetKey.value === 'totalsBySupplier'
      ? [
          { key: 'supplierName', label: localeStore.locale === 'en' ? 'Supplier' : '供应商' },
          { key: 'invoiceCount', label: localeStore.locale === 'en' ? 'Invoices' : '发票数量' },
          { key: 'totalAmount', label: localeStore.locale === 'en' ? 'Total amount' : '总金额' },
        ]
      : [
          { key: 'supplierName', label: localeStore.locale === 'en' ? 'Supplier' : '供应商' },
          { key: 'orderCount', label: localeStore.locale === 'en' ? 'Orders' : '订单量' },
          { key: 'totalAmount', label: localeStore.locale === 'en' ? 'Total amount' : '总金额' },
        ]

  const filename =
    datasetKey.value === 'totalsBySupplier'
      ? `supplier_totals_${stats.value.period?.startDate || ''}_${stats.value.period?.endDate || ''}.csv`
      : `top_suppliers_${stats.value.period?.startDate || ''}_${stats.value.period?.endDate || ''}.csv`

  exportToCsv(filename, columns, activeRows.value)
}

function resolveChartJsInstance() {
  const instance = chartRef.value
  if (!instance) return null
  if (instance.chart) return instance.chart
  if (instance.chartInstance) return instance.chartInstance
  if (instance?.$?.exposed?.chart) return instance.$.exposed.chart
  if (instance?.$?.exposed?.chartInstance) return instance.$.exposed.chartInstance
  return null
}

function exportChartPng() {
  const chart = resolveChartJsInstance()
  if (!chart?.toBase64Image) return

  const period = stats.value.period || {}
  const filename = `supplier_stats_${period.startDate || ''}_${period.endDate || ''}.png`
  const dataUrl = chart.toBase64Image('image/png', 1)
  downloadDataUrl(filename, dataUrl)
}

onMounted(() => {
  const range = resolveLastMonthRange()
  filters.startDate = range.startDate
  filters.endDate = range.endDate
  loadStats()
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Analytics</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Supplier Stats' : '供应商统计' }}
          </h2>
        </div>

        <form class="flex flex-wrap gap-3" @submit.prevent="loadStats">
          <input
            v-model="filters.startDate"
            type="date"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          />
          <input
            v-model="filters.endDate"
            type="date"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          />
          <button class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
            {{ localeStore.locale === 'en' ? 'Apply' : '应用' }}
          </button>
        </form>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="loading" class="mt-6 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
        {{ localeStore.locale === 'en' ? 'Loading supplier stats...' : '供应商统计加载中...' }}
      </div>

      <div v-else class="mt-6 grid gap-6">
        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-3xl border border-slate-200 bg-white px-5 py-4">
            <p class="text-sm text-slate-500">{{ localeStore.locale === 'en' ? 'Invoice total' : '发票总金额' }}</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ formatMoney(stats.globalInvoiceTotal) }}</p>
            <p class="mt-2 text-xs text-slate-400">
              {{ stats.period?.startDate }} → {{ stats.period?.endDate }}
            </p>
          </div>

          <div class="rounded-3xl border border-slate-200 bg-white px-5 py-4 md:col-span-2">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm text-slate-500">{{ localeStore.locale === 'en' ? 'Top supplier (last range)' : 'TOP供应商（当前范围）' }}</p>
                <p class="mt-2 text-xl font-semibold text-slate-900">
                  {{ topSupplier?.supplierName || (localeStore.locale === 'en' ? 'N/A' : '暂无') }}
                </p>
              </div>
              <div class="flex flex-wrap gap-3 text-sm text-slate-700">
                <div class="rounded-2xl bg-slate-50 px-4 py-2">
                  <p class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Orders' : '订单量' }}</p>
                  <p class="mt-1 font-semibold">{{ topSupplier?.orderCount || 0 }}</p>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-2">
                  <p class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Amount' : '金额' }}</p>
                  <p class="mt-1 font-semibold">{{ formatMoney(topSupplier?.totalAmount || 0) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-xl font-semibold text-slate-900">
                {{ localeStore.locale === 'en' ? 'Visualization' : '可视化' }}
              </h3>
              <select v-model="datasetKey" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                <option value="totalsBySupplier">{{ localeStore.locale === 'en' ? 'Totals by supplier' : '分供应商总金额' }}</option>
                <option value="topSuppliersByPurchaseCount">{{ localeStore.locale === 'en' ? 'Top suppliers (orders)' : 'TOP供应商（订单量）' }}</option>
              </select>
              <select
                v-if="datasetKey === 'topSuppliersByPurchaseCount'"
                v-model="metricKey"
                class="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="orderCount">{{ localeStore.locale === 'en' ? 'Order count' : '订单量' }}</option>
                <option value="totalAmount">{{ localeStore.locale === 'en' ? 'Amount' : '金额' }}</option>
              </select>
            </div>

            <div class="flex flex-wrap gap-2">
              <select v-model="view" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                <option value="chart">{{ localeStore.locale === 'en' ? 'Chart' : '图表' }}</option>
                <option value="table">{{ localeStore.locale === 'en' ? 'Table' : '表格' }}</option>
              </select>
              <select v-if="view === 'chart'" v-model="chartType" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                <option value="bar">{{ localeStore.locale === 'en' ? 'Bar' : '柱状图' }}</option>
                <option value="line">{{ localeStore.locale === 'en' ? 'Line' : '折线图' }}</option>
                <option value="doughnut">{{ localeStore.locale === 'en' ? 'Pie' : '饼图' }}</option>
              </select>
              <button type="button" class="rounded-2xl border border-slate-300 px-4 py-2 text-sm" @click="exportCurrentCsv">
                {{ localeStore.locale === 'en' ? 'Export CSV' : '导出 CSV' }}
              </button>
              <button
                type="button"
                class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="view !== 'chart'"
                @click="exportChartPng"
              >
                {{ localeStore.locale === 'en' ? 'Export PNG' : '导出 PNG' }}
              </button>
            </div>
          </div>

          <div v-if="view === 'chart'" class="h-[420px] px-4 py-4">
            <component
              :is="chartComponent"
              ref="chartRef"
              :data="chartData"
              :options="chartOptions"
            />
          </div>

          <div v-else class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Supplier' : '供应商' }}</th>
                  <th v-if="datasetKey === 'totalsBySupplier'" class="px-5 py-3">
                    {{ localeStore.locale === 'en' ? 'Invoices' : '发票数量' }}
                  </th>
                  <th v-else class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Orders' : '订单量' }}</th>
                  <th class="px-5 py-3">{{ localeStore.locale === 'en' ? 'Total amount' : '总金额' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in activeRows" :key="row.supplierId" class="border-t border-slate-200">
                  <td class="px-5 py-3 font-medium text-slate-900">{{ row.supplierName }}</td>
                  <td class="px-5 py-3 text-slate-700">
                    {{ datasetKey === 'totalsBySupplier' ? row.invoiceCount : row.orderCount }}
                  </td>
                  <td class="px-5 py-3 text-slate-700">{{ formatMoney(row.totalAmount) }}</td>
                </tr>
                <tr v-if="!activeRows.length">
                  <td colspan="3" class="px-5 py-6 text-center text-slate-500">
                    {{ localeStore.locale === 'en' ? 'No data.' : '暂无数据。' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </AppLayout>
</template>

