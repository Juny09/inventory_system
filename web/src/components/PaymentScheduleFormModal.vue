<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-2" @click.self="$emit('close')">
    <div class="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <div class="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 class="text-lg font-semibold text-slate-800">
          {{ form.id ? tr('Edit Payment Schedule', '编辑还款计划') : tr('New Payment Schedule', '新建还款计划') }}
        </h3>
        <button class="text-slate-400 hover:text-slate-600" @click="$emit('close')">×</button>
      </div>
      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Supplier', '供应商') }} <span class="text-red-500">*</span></label>
              <select v-model="form.supplier_id" required :disabled="!!form.id" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">-- {{ tr('Select', '选择') }} --</option>
                <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}{{ s.company_name ? ` (${s.company_name})` : '' }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Due Date', '到期日') }} <span class="text-red-500">*</span></label>
              <input v-model="form.due_date" required type="date" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Period Month', '月份') }} <span class="text-red-500">*</span></label>
              <select v-model.number="form.period_month" required :disabled="!!form.id" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option v-for="m in 12" :key="m" :value="m">{{ monthLabel(m) }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Period Year', '年份') }} <span class="text-red-500">*</span></label>
              <input v-model.number="form.period_year" required type="number" min="2000" max="2100" :disabled="!!form.id" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Amount Due', '应付金额') }} <span class="text-red-500">*</span></label>
              <input v-model.number="form.amount_due" required type="number" step="0.01" min="0" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Remind Days Before', '提前提醒天数') }}</label>
              <input v-model.number="form.remind_days_before" type="number" min="0" max="365" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">{{ tr('Notes', '备注') }}</label>
            <textarea v-model="form.notes" rows="2" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"></textarea>
          </div>
        </div>
        <div class="flex flex-shrink-0 flex-col gap-2 border-t border-slate-200 px-5 py-3">
          <p v-if="errorMessage" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm" @click="$emit('close')">{{ tr('Cancel', '取消') }}</button>
            <button type="submit" :disabled="submitting" class="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {{ submitting ? tr('Saving...', '保存中...') : tr('Save', '保存') }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const props = defineProps({
  id: { type: [Number, String, null], default: null },
  suppliers: { type: Array, default: () => [] },
  defaults: { type: Object, default: () => ({}) },
  initialData: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const localeStore = useLocaleStore()
const tr = (en, cn) => (localeStore.locale === 'en' ? en : cn)

const MONTH_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_CN = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
function monthLabel(m) {
  return localeStore.locale === 'en' ? MONTH_EN[m] : MONTH_CN[m]
}

const today = new Date().toLocaleDateString('en-CA')
const form = reactive({
  id: null,
  supplier_id: props.defaults.supplier_id || '',
  period_month: props.defaults.period_month || new Date().getMonth() + 1,
  period_year: props.defaults.period_year || new Date().getFullYear(),
  due_date: props.defaults.due_date || today,
  amount_due: props.defaults.amount_due || 0,
  remind_days_before: 3,
  notes: '',
})
const submitting = ref(false)
const errorMessage = ref('')

async function loadExisting(id) {
  // If parent already supplied the row data, use it directly
  if (props.initialData) {
    Object.assign(form, props.initialData, { id: props.initialData.id })
    form.due_date = props.initialData.due_date ? new Date(props.initialData.due_date).toLocaleDateString('en-CA') : ''
    return
  }
  // Fallback: find within list
  try {
    const { data } = await api.get('/supplier-payment-schedules')
    const found = (data.items || []).find((x) => x.id === Number(id))
    if (found) {
      Object.assign(form, found, { id: found.id })
      form.due_date = found.due_date ? new Date(found.due_date).toLocaleDateString('en-CA') : ''
    }
  } catch (_) {
    // ignore
  }
}

async function submit() {
  submitting.value = true
  errorMessage.value = ''
  try {
    const payload = {
      supplierId: Number(form.supplier_id),
      periodMonth: Number(form.period_month),
      periodYear: Number(form.period_year),
      dueDate: form.due_date,
      amountDue: Number(form.amount_due) || 0,
      remindDaysBefore: Number(form.remind_days_before) || 0,
      notes: form.notes || null,
    }
    if (form.id) {
      await api.put(`/supplier-payment-schedules/${form.id}`, payload)
    } else {
      await api.post('/supplier-payment-schedules', payload)
    }
    emit('saved')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to save.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (props.id) {
    form.id = props.id
    loadExisting(props.id)
  }
})
</script>
