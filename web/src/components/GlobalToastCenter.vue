<script setup>
import { useToastStore } from '../stores/toast'

const toastStore = useToastStore()
</script>

<template>
  <div class="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-3">
    <div
      v-for="toast in toastStore.items"
      :key="toast.id"
      class="pointer-events-auto rounded-3xl border px-4 py-4 shadow-xl backdrop-blur"
      :class="
        toast.tone === 'success'
          ? 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
          : toast.tone === 'error'
            ? 'border-rose-200 bg-rose-50/95 text-rose-700'
            : 'border-slate-200 bg-white/95 text-slate-700'
      "
    >
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm font-medium">{{ toast.message }}</p>
        <button type="button" class="text-xs font-semibold" @click="toastStore.removeToast(toast.id)">
          关闭
        </button>
      </div>
      <div v-if="toast.actionLabel" class="mt-3">
        <button
          type="button"
          class="rounded-2xl border border-current px-4 py-2 text-xs font-semibold"
          @click="toastStore.triggerAction(toast.id)"
        >
          {{ toast.actionLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
