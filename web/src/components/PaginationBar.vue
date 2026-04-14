<script setup>
import { useLocaleStore } from '../stores/locale'

const props = defineProps({
  pagination: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['change'])
const localeStore = useLocaleStore()

function goToPage(page) {
  if (page < 1 || page > props.pagination.totalPages || page === props.pagination.page) {
    return
  }

  emit('change', page)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-500">
    <p>
      {{
        localeStore.locale === 'en'
          ? `Total ${pagination.total}, page ${pagination.page} / ${pagination.totalPages || 1}`
          : `共 ${pagination.total} 条，当前第 ${pagination.page} / ${pagination.totalPages || 1} 页`
      }}
    </p>

    <div class="flex items-center gap-2">
      <button
        class="rounded-xl border border-slate-300 px-3 py-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="pagination.page <= 1"
        @click="goToPage(pagination.page - 1)"
      >
        {{ localeStore.locale === 'en' ? 'Previous' : '上一页' }}
      </button>
      <button
        class="rounded-xl border border-slate-300 px-3 py-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="pagination.page >= pagination.totalPages"
        @click="goToPage(pagination.page + 1)"
      >
        {{ localeStore.locale === 'en' ? 'Next' : '下一页' }}
      </button>
    </div>
  </div>
</template>
