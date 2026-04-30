<template>
  <div class="relative">
    <div class="relative">
      <input
        v-model="keyword"
        type="text"
        :placeholder="placeholder"
        class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        @focus="open = true"
        @input="onInput"
        @keydown.down.prevent="moveCursor(1)"
        @keydown.up.prevent="moveCursor(-1)"
        @keydown.enter.prevent="selectHighlighted"
      />
      <button
        v-if="selectedLabel"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
        @click="clear"
      >
        ×
      </button>
    </div>

    <div
      v-if="open"
      class="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg"
      @mousedown.prevent
    >
      <div v-if="loading" class="px-3 py-2 text-sm text-slate-500">Searching...</div>
      <template v-else>
        <div v-if="options.length === 0" class="px-3 py-2 text-sm text-slate-500">No products found.</div>
        <div
          v-for="(opt, idx) in options"
          :key="opt.id"
          :class="[
            'cursor-pointer px-3 py-2 text-sm',
            idx === cursorIdx ? 'bg-indigo-50' : 'hover:bg-slate-50',
          ]"
          @click="pick(opt)"
        >
          <div class="font-medium text-slate-800">{{ opt.product_code || opt.sku }} · {{ opt.name }}</div>
          <div class="text-xs text-slate-500">SKU: {{ opt.sku }}</div>
        </div>
      </template>
      <div class="border-t border-slate-200 bg-slate-50 px-3 py-2">
        <button
          type="button"
          class="w-full rounded bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          @click="showQuickCreate = true"
        >
          + Add new product
        </button>
      </div>
    </div>

    <QuickCreateProductModal
      v-if="showQuickCreate"
      @close="showQuickCreate = false"
      @created="onQuickCreated"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import api from '../services/api'
import QuickCreateProductModal from './QuickCreateProductModal.vue'

const props = defineProps({
  modelValue: { type: [Number, String, null], default: null },
  initialLabel: { type: String, default: '' },
  placeholder: { type: String, default: 'Search product by code or name...' },
})
const emit = defineEmits(['update:modelValue', 'select'])

const keyword = ref(props.initialLabel || '')
const options = ref([])
const open = ref(false)
const loading = ref(false)
const cursorIdx = ref(-1)
const selectedLabel = ref(props.initialLabel || '')
const showQuickCreate = ref(false)

let debounceTimer = null

async function fetchList(term) {
  loading.value = true
  try {
    const { data } = await api.get('/products', {
      params: { search: term || '', page: 1, pageSize: 20, status: 'active' },
    })
    options.value = data.items || []
  } catch (error) {
    options.value = []
  } finally {
    loading.value = false
  }
}

function onInput() {
  open.value = true
  cursorIdx.value = -1
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchList(keyword.value), 250)
}

function moveCursor(delta) {
  if (!open.value) open.value = true
  const next = cursorIdx.value + delta
  if (next < 0) cursorIdx.value = options.value.length - 1
  else if (next >= options.value.length) cursorIdx.value = 0
  else cursorIdx.value = next
}

function selectHighlighted() {
  if (cursorIdx.value >= 0 && options.value[cursorIdx.value]) {
    pick(options.value[cursorIdx.value])
  }
}

function pick(opt) {
  emit('update:modelValue', opt.id)
  emit('select', opt)
  selectedLabel.value = `${opt.product_code || opt.sku} · ${opt.name}`
  keyword.value = selectedLabel.value
  open.value = false
}

function clear() {
  emit('update:modelValue', null)
  emit('select', null)
  selectedLabel.value = ''
  keyword.value = ''
}

function onQuickCreated(product) {
  showQuickCreate.value = false
  options.value = [product, ...options.value]
  pick(product)
}

function handleClickOutside(event) {
  const el = event.target
  if (el && el.closest && el.closest('.supplier-doc-product-selector')) return
  // fallback: close after slight delay to allow mousedown on option to fire first
  open.value = false
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))

watch(
  () => props.modelValue,
  (val) => {
    if (val === null || val === undefined || val === '') {
      selectedLabel.value = ''
      keyword.value = ''
    }
  },
)
</script>
