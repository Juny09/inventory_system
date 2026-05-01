<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-2" @click.self="$emit('close')">
    <div class="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <div class="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 class="text-lg font-semibold text-slate-800">
          {{ tr('Generate Monthly Schedules', '批量生成月度还款计划') }}
        </h3>
        <button class="text-slate-400 hover:text-slate-600" @click="$emit('close')">×</button>
      </div>
      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
          <p class="text-xs text-slate-500">
            {{ tr('Quickly create one schedule for each month in the selected range.', '为所选月份区间的每个月快速生成一条还款计划。') }}
          </p>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="md:col-span-2">
              <label class="block text-xs font-medium text-slate-600">{{ tr('Supplier', '供应商') }} <span class="text-red-500">*</span></label>
              <select v-model="form.supplier_id" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">-- {{ tr('Select', '选择') }} --</option>
                <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}{{ s.company_name ? ` (${s.company_name})` : '' }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Year', '年份') }} <span class="text-red-500">*</span></label>
              <input v-model.number="form.year" required type="number" min="2000" max="2100" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Amount per Month', '每月金额') }} <span class="text-red-500">*</span></label>
              <input v-model.number="form.amount_per_month" required type="number" step="0.01" min="0" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Start Month', '起始月份') }}</label>
              <select v-model.number="form.start_month" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option v-for="m in 12" :key="m" :value="m">{{ monthLabel(m) }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('End Month', '结束月份') }}</label>
              <select v-model.number="form.end_month" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option v-for="m in 12" :key="m" :value="m">{{ monthLabel(m) }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Due Day of Month', '每月到期日') }}</label>
              <input v-model.number="form.due_day" type="number" min="1" max="31" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600">{{ tr('Remind Days Before', '提前提醒天数') }}</label>
              <input v-model.number="form.remind_days_before" type="number" min="0" max="365" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">{{ tr('Notes (applied to each)', '备注（应用到每条）') }}</label>
            <textarea v-model="form.notes" rows="2" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"></textarea>
          </div>
          <p v-if="resultMessage" class="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{{ resultMessage }}</p>
        </div>
        <div class="flex flex-shrink-0 flex-col gap-2 border-t border-slate-200 px-5 py-3">
          <p v-if="errorMessage" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm" @click="$emit('close')">{{ tr('Close', '关闭') }}</button>
            <button type="submit" :disabled="submitting" class="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {{ submitting ? tr('Generating...', '生成中...') : tr('Generate', '生成') }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

defineProps({
  suppliers: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'saved'])

const localeStore = useLocaleStore()
const tr = (en, cn) => (localeStore.locale === 'en' ? en : cn)

const MONTH_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_CN = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
function monthLabel(m) {
  return localeStore.locale === 'en' ? MONTH_EN[m] : MONTH_CN[m]
}

const form = reactive({
  supplier_id: '',
  year: new Date().getFullYear(),
  amount_per_month: 0,
  start_month: 1,
  end_month: 12,
  due_day: 15,
  remind_days_before: 3,
  notes: '',
})
const submitting = ref(false)
const errorMessage = ref('')
const resultMessage = ref('')

async function submit() {
  submitting.value = true
  errorMessage.value = ''
  resultMessage.value = ''
  try {
    const { data } = await api.post('/supplier-payment-schedules/batch', {
      supplierId: Number(form.supplier_id),
      year: Number(form.year),
      startMonth: Number(form.start_month),
      endMonth: Number(form.end_month),
      amountPerMonth: Number(form.amount_per_month) || 0,
      dueDay: Number(form.due_day) || 15,
      remindDaysBefore: Number(form.remind_days_before) || 0,
      notes: form.notes || null,
    })
    const created = data.created?.length || 0
    const skipped = data.skipped?.length || 0
    resultMessage.value = tr(
      `Created ${created} schedule(s). ${skipped} skipped (already exist).`,
      `已创建 ${created} 条计划，跳过 ${skipped} 条（已存在）。`,
    )
    emit('saved')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to generate.'
  } finally {
    submitting.value = false
  }
}
</script>
