<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  class: {
    type: String,
    default: '',
  },
})

const icons = {
  dashboard: ['M3 13h8V3H3zm10 18h8V21h-8zM3 31h8V17H3zm10-10h8V3h-8z'],
  alerts: ['M16 4a8 8 0 0 0-8 8v4.2L5.7 21a1 1 0 0 0 .8 1.6h19a1 1 0 0 0 .8-1.6L24 16.2V12a8 8 0 0 0-8-8zm0 28a4 4 0 0 0 4-4h-8a4 4 0 0 0 4 4z'],
  inventory: ['M6 8 16 3l10 5v16l-10 5L6 24zm10-2.8L9 8.6 16 12l7-3.4zM8 10.2v12.6l7 3.5V13.7zm16 0-7 3.5v12.6l7-3.5z'],
  counts: ['M8 6h16a2 2 0 0 1 2 2v20l-6-4-6 4-6-4-6 4V8a2 2 0 0 1 2-2h4zm2 6h10v2H10zm0 5h10v2H10z'],
  categories: ['M5 8a3 3 0 0 1 3-3h6l3 3h7a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z'],
  warehouses: ['M5 29h22v-2H5zm2-4h4V12H7zm7 0h4V8h-4zm7 0h4V15h-4zM4 29V11l12-6 12 6v18'],
  products: ['M8 9h16l3 6-11 14L5 15zm4 0 4 6 4-6'],
  reports: ['M7 28V8h18v20M11 23h2m4 0h6M11 18h12M11 13h12'],
  audit: ['M16 4 5 8v8c0 6.6 4.7 12.8 11 14 6.3-1.2 11-7.4 11-14V8zm0 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 13c-2.5 0-4.7-1-6.4-2.7.1-4.2 8.6-6.5 12.8-3.4 1.4 1 2.1 2.1 2.1 3.4A9 9 0 0 1 16 25z'],
  guide: ['M7 6h18a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm4 4h10m-10 5h10m-10 5h6'],
  chevronLeft: ['m20 8-8 8 8 8'],
  menu: ['M6 9h20M6 16h20M6 23h20'],
  question: ['M16 24v-2m0-4c2.2 0 4-1.5 4-3.5S18.9 11 16 11c-2.3 0-3.7 1.2-4.3 2.7M16 30C8.3 30 2 23.7 2 16S8.3 2 16 2s14 6.3 14 14-6.3 14-14 14z'],
  bell: ['M16 30a3 3 0 0 0 3-3h-6a3 3 0 0 0 3 3zM26 24H6l2-2v-7a8 8 0 0 1 16 0v7z'],
  x: ['M8 8l16 16M24 8 8 24'],
}

const paths = computed(() => icons[props.name] || icons.guide)
</script>

<template>
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="props.class"
  >
    <path v-for="path in paths" :key="path" :d="path" />
  </svg>
</template>
