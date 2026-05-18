<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-2" @click.self="$emit('close')">
    <div class="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <div class="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 class="text-lg font-semibold text-slate-800">
          {{ tr('Add Payment', '登记付款') }}
        </h3>
        <button class="text-slate-400 hover:text-slate-600" @click="$emit('close')">×</button>
      </div>
      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
          <div class="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div><span class="font-semibold">{{ tr('Supplier', '供应商') }}:</span> {{ schedule.supplier_name }}{{ schedule.supplier_branch ? ` (${schedule.supplier_branch})` : '' }}</div>
            <div><span class="font-semibold">{{ tr('Period', '账期') }}:</span> {{ schedule.period_label }}</div>
            <div><span class="font-semibold">{{ tr('Due Date', '到期日') }}:</span> {{ schedule.due_date ? new Date(schedule.due_date).toLocaleDateString('en-CA') : '' }}</div>
            <div><span class="font-semibold">{{ tr('Amount Due', '应付') }}:</span> {{ Number(schedule.amount_due).toFixed(2) }}</div>
            <div><span class="font-semibold">{{ tr('Paid', '已付') }}:</span> {{ Number(schedule.amount_paid).toFixed(2) }}</div>
            <div><span class="font-semibold">{{ tr('Remaining', '剩余') }}:</span> {{ remaining.toFixed(2) }}</div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">{{ tr('Payment Amount', '付款金额') }} <span class="text-red-500">*</span></label>
            <input v-model.number="form.amount" required type="number" step="0.01" min="0.01" :max="remaining" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">{{ tr('Paid Date', '付款日期') }}</label>
            <input v-model="form.paid_date" type="date" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
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
import { computed, reactive, ref } from 'vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const props = defineProps({
  schedule: { type: Object, required: true },
})
const emit = defineEmits(['close', 'saved'])

const localeStore = useLocaleStore()
const tr = (en, cn) => (localeStore.locale === 'en' ? en : cn)

const remaining = computed(() => Number(props.schedule.amount_due) - Number(props.schedule.amount_paid))

const form = reactive({
  amount: remaining.value,
  paid_date: new Date().toLocaleDateString('en-CA'),
})
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  submitting.value = true
  errorMessage.value = ''
  try {
    await api.post(`/supplier-payment-schedules/${props.schedule.id}/add-payment`, {
      amount: Number(form.amount),
      paidDate: form.paid_date || null,
    })
    emit('saved')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to add payment.'
  } finally {
    submitting.value = false
  }
}
</script>
