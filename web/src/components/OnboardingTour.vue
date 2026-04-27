<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { useLocaleStore } from '../stores/locale'

const localeStore = useLocaleStore()

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  steps: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['complete'])

const index = ref(0)

const currentStep = computed(() => props.steps[index.value] || {})
const total = computed(() => props.steps.length || 0)
const atFirst = computed(() => index.value <= 0)
const atLast = computed(() => total.value > 0 && index.value >= total.value - 1)

function close(markDone = true) {
  emit('complete', { done: Boolean(markDone) })
}

function next() {
  if (atLast.value) {
    close(true)
    return
  }
  index.value += 1
}

function prev() {
  index.value = Math.max(0, index.value - 1)
}

watch(
  () => props.open,
  (value) => {
    if (value) {
      index.value = 0
    }
  },
)
</script>

<template>
  <div v-if="props.open" class="fixed inset-0 z-[200]">
    <div class="absolute inset-0 bg-slate-950/40" @click="close(true)" />
    <div class="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
      <div class="rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              {{ localeStore.t('common.quickGuide') }}
              <span v-if="total > 0" class="ml-2 normal-case tracking-normal">
                {{ index + 1 }}/{{ total }}
              </span>
            </p>
            <h3 class="mt-2 text-xl font-semibold text-slate-900">{{ props.title }}</h3>
          </div>
          <button type="button" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" @click="close(true)">
            <AppIcon name="x" class="h-4 w-4" />
          </button>
        </div>

        <div class="mt-4 rounded-3xl bg-slate-50 p-4">
          <p class="text-sm font-semibold text-slate-900">{{ currentStep.title || props.title }}</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ currentStep.text || '' }}</p>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            :disabled="atFirst"
            @click="prev"
          >
            {{ localeStore.locale === 'en' ? localeStore.t('common.back') : '上一步' }}
          </button>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              @click="close(true)"
            >
              {{ localeStore.t('common.skip') }}
            </button>
            <button
              type="button"
              class="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              @click="next"
            >
              {{ atLast ? localeStore.t('common.done') : localeStore.t('common.next') }}
            </button>
          </div>
        </div>
      </div>
      <p class="mt-3 text-center text-xs text-slate-400">
        {{ localeStore.t('onboarding.tip') }}
      </p>
    </div>
  </div>
</template>
