<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const route = useRoute()
const router = useRouter()
const localeStore = useLocaleStore()
const loading = ref(false)
const errorMessage = ref('')
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

onMounted(() => {
  if (route.query.supplierId) {
    form.value.supplierId = String(route.query.supplierId)
  }
  loadSummary()
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Master Data</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Supplier payment records', '供应商还账记录') }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ tr('Track which monthly bills have been paid to each supplier.', '记录每个供应商各月份的账单是否已还。') }}</p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" @click="back">
            {{ tr('Back to suppliers', '返回供应商列表') }}
          </button>
          <button class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" @click="openEmptyForm">
            {{ tr('Add record', '新增记录') }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

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

      <!-- Add / Edit Form Modal -->
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
    </section>
  </AppLayout>
</template>
