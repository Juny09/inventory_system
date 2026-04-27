<script setup>
import AppIcon from './AppIcon.vue'

const emit = defineEmits(['click'])

const props = defineProps({
  text: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <span class="inline-flex items-center">
    <button
      type="button"
      class="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-700"
      :title="props.text"
      :aria-label="props.text"
      @click="emit('click')"
    >
      <AppIcon name="question" class="h-4 w-4" />
    </button>
  </span>
</template>
