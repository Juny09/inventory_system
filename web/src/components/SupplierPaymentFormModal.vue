<script setup>
import { ref, computed, watch } from 'vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const localeStore = useLocaleStore()

const props = defineProps({
  show: { type: Boolean, default: false },
  mode: { type: String, default: 'add' }, // add, edit, view
  id: { type: Number, default: null },
  suppliers: { type: Array, default: () => [] },
  initialData: { type: Object, default: null },
  defaultYear: { type: Number, default: new Date().getFullYear() },
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const submitting = ref(false)
const formError = ref('')

const MONTH_NAMES_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_NAMES_CN = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const form = ref({
  supplierId: '',
  periodMonth: new Date().getMonth() + 1,
  periodYear: props.defaultYear,
  paidDate: '',
  amount: '',
  chequeNumber: '',
  paymentSlipNumber: '',
  notes: '',
})

const isViewMode = computed(() => props.mode === 'view')
const isReadOnly = computed(() => props.mode === 'view')
const modalTitle = computed(() => {
  if (props.mode === 'add') return localeStore.locale === 'en' ? 'Add Payment Record' : '添加还账记录'
  if (props.mode === 'edit') return localeStore.locale === 'en' ? 'Edit Payment Record' : '编辑还账记录'
  return localeStore.locale === 'en' ? 'View Payment Record' : '查看还账记录'
})

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

function monthLabel(month) {
  return localeStore.locale === 'en' ? MONTH_NAMES_EN[month] : MONTH_NAMES_CN[month]
}

function formatAmount(v) {
  if (!v && v !== 0) return ''
  return Number(v).toFixed(2)
}

function formatDateForInput(d) {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

function resetForm() {
  form.value = {
    supplierId: '',
    periodMonth: new Date().getMonth() + 1,
    periodYear: props.defaultYear,
    paidDate: '',
    amount: '',
    chequeNumber: '',
    paymentSlipNumber: '',
    notes: '',
  }
  formError.value = ''
}

async function loadPayment() {
  if (!props.id || props.mode !== 'edit') return
  loading.value = true
  formError.value = ''
  try {
    const { data } = await api.get(`/supplier-payments/${props.id}`)
    form.value = {
      supplierId: String(data.supplier_id),
      periodMonth: data.period_month,
      periodYear: data.period_year,
      paidDate: formatDateForInput(data.paid_date),
      amount: formatAmount(data.amount),
      chequeNumber: data.cheque_number || '',
      paymentSlipNumber: data.payment_slip_number || '',
      notes: data.notes || '',
    }
  } catch (error) {
    formError.value = error.response?.data?.message || tr('Failed to load payment.', '加载失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (isViewMode.value) return
  if (!form.value.supplierId) {
    formError.value = tr('Supplier is required.', '请选择供应商')
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    if (props.mode === 'add' || !props.id) {
      await api.post('/supplier-payments', {
        supplierId: Number(form.value.supplierId),
        periodMonth: Number(form.value.periodMonth),
        periodYear: Number(form.value.periodYear),
        paidDate: form.value.paidDate || null,
        amount: form.value.amount ? Number(form.value.amount) : null,
        chequeNumber: form.value.chequeNumber || null,
        paymentSlipNumber: form.value.paymentSlipNumber || null,
        notes: form.value.notes || null,
      })
    } else {
      await api.put(`/supplier-payments/${props.id}`, {
        supplierId: Number(form.value.supplierId),
        periodMonth: Number(form.value.periodMonth),
        periodYear: Number(form.value.periodYear),
        paidDate: form.value.paidDate || null,
        amount: form.value.amount ? Number(form.value.amount) : null,
        chequeNumber: form.value.chequeNumber || null,
        paymentSlipNumber: form.value.paymentSlipNumber || null,
        notes: form.value.notes || null,
      })
    }
    emit('saved')
    emit('close')
  } catch (error) {
    formError.value = error.response?.data?.message || tr('Failed to save payment.', '保存失败')
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  resetForm()
  emit('close')
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    resetForm()
    if (props.initialData) {
      form.value = {
        supplierId: String(props.initialData.supplier_id || props.initialData.supplierId || ''),
        periodMonth: props.initialData.period_month || props.initialData.periodMonth || new Date().getMonth() + 1,
        periodYear: props.initialData.period_year || props.initialData.periodYear || props.defaultYear,
        paidDate: formatDateForInput(props.initialData.paid_date || props.initialData.paidDate || ''),
        amount: formatAmount(props.initialData.amount),
        chequeNumber: props.initialData.cheque_number || props.initialData.chequeNumber || '',
        paymentSlipNumber: props.initialData.payment_slip_number || props.initialData.paymentSlipNumber || '',
        notes: props.initialData.notes || '',
      }
    } else if (props.id && props.mode === 'edit') {
      loadPayment()
    }
  }
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[100] overflow-y-auto">
    <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 transition-opacity bg-slate-500/75" @click="handleClose"></div>

      <span class="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>

      <div class="inline-block w-full max-w-md transform overflow-hidden rounded-3xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle">
        <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 sm:mx-0 sm:h-10 sm:w-10">
              <svg v-if="mode === 'view'" class="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" />
              </svg>
              <svg v-else class="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0Zm-3.75 1.5h7.5" />
              </svg>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 class="text-lg font-semibold leading-6 text-slate-900">{{ modalTitle }}</h3>
              <div class="mt-2">
                <p v-if="formError" class="text-sm text-rose-600 mb-4">{{ formError }}</p>
                <p v-if="loading" class="text-sm text-slate-500 mb-4">{{ tr('Loading...', '加载中...') }}</p>

                <div v-if="!loading" class="space-y-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1">{{ tr('Supplier', '供应商') }}</label>
                    <select
                      v-model="form.supplierId"
                      :disabled="isReadOnly"
                      class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>{{ tr('Select supplier', '选择供应商') }}</option>
                      <option v-for="s in suppliers" :key="s.id" :value="String(s.id)">
                        {{ s.name }}{{ s.company_name ? ` (${s.company_name})` : '' }}
                      </option>
                    </select>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 mb-1">{{ tr('Month', '月份') }}</label>
                      <select
                        v-model="form.periodMonth"
                        :disabled="isReadOnly"
                        class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                      >
                        <option v-for="m in 12" :key="m" :value="m">{{ monthLabel(m) }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 mb-1">{{ tr('Year', '年份') }}</label>
                      <input
                        v-model.number="form.periodYear"
                        type="number"
                        :disabled="isReadOnly"
                        class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 mb-1">{{ tr('Paid Date', '还款日期') }}</label>
                      <input
                        v-model="form.paidDate"
                        type="date"
                        :disabled="isReadOnly"
                        class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 mb-1">{{ tr('Amount', '金额') }}</label>
                      <input
                        v-model="form.amount"
                        type="number"
                        step="0.01"
                        min="0"
                        :disabled="isReadOnly"
                        :placeholder="tr('0.00', '0.00')"
                        class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 mb-1">{{ tr('Cheque Number', '支票号') }}</label>
                      <input
                        v-model="form.chequeNumber"
                        type="text"
                        :disabled="isReadOnly"
                        :placeholder="tr('Optional', '可选')"
                        class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-slate-600 mb-1">{{ tr('Payment Slip Number', '付款单号') }}</label>
                      <input
                        v-model="form.paymentSlipNumber"
                        type="text"
                        :disabled="isReadOnly"
                        :placeholder="tr('Optional', '可选')"
                        class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1">{{ tr('Notes', '备注') }}</label>
                    <textarea
                      v-model="form.notes"
                      rows="3"
                      :disabled="isReadOnly"
                      :placeholder="tr('Optional notes', '可选备注')"
                      class="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
          <button
            v-if="!isViewMode"
            type="button"
            @click="handleSave"
            :disabled="submitting"
            class="inline-flex w-full justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ submitting ? tr('Saving...', '保存中...') : tr('Save', '保存') }}
          </button>
          <button
            type="button"
            @click="handleClose"
            class="mt-3 inline-flex w-full justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto"
          >
            {{ tr('Close', '关闭') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
