<template>
  <div v-if="show" class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
    <div class="min-w-0 flex-1">
      {{ tr(messageEn, messageCn) }}
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <button
        type="button"
        class="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        @click="$emit('discard')"
      >
        {{ tr(discardEn, discardCn) }}
      </button>
      <button
        v-if="showClear"
        type="button"
        class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        @click="$emit('clear')"
      >
        {{ tr(clearEn, clearCn) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { useLocaleStore } from '../stores/locale'

defineProps({
  show: { type: Boolean, default: false },
  showClear: { type: Boolean, default: true },
  messageEn: { type: String, default: 'Recovered unsaved draft.' },
  messageCn: { type: String, default: '已恢复上次未提交内容。' },
  discardEn: { type: String, default: 'Discard draft' },
  discardCn: { type: String, default: '放弃草稿' },
  clearEn: { type: String, default: 'Clear form' },
  clearCn: { type: String, default: '清空表单' },
})

defineEmits(['discard', 'clear'])

const localeStore = useLocaleStore()
const tr = (en, cn) => (localeStore.locale === 'en' ? en : cn)
</script>

