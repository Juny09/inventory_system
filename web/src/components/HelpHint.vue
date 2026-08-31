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
  <!-- TraeWork 风格帮助按钮：圆形 ghost（透明底）+ icon--14（紧凑 14px），颜色跟随父级 currentColor -->
  <span class="inline-flex items-center">
    <button
      type="button"
      class="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm text-tw-text-tertiary hover:!text-tw-text-default"
      :title="props.text"
      :aria-label="props.text"
      @click="emit('click')"
    >
      <AppIcon name="question" class="icon icon--14" />
    </button>
  </span>
</template>
