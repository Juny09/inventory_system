<script setup>
defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], required: true },
  hint: { type: String, default: '' },
})
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{{ title }}</p>
    <p class="mt-2 text-3xl font-semibold text-slate-900">{{ value }}</p>
    <p v-if="hint" class="mt-2 text-sm text-slate-500">{{ hint }}</p>
  </div>
</template>
