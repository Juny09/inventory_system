<template>
  <div ref="rootRef" class="relative w-full">
    <button
      type="button"
      class="flex w-full items-center justify-between rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100"
      :disabled="disabled"
      @click="toggleOpen"
    >
      <span :class="selectedLabel ? 'text-slate-900' : 'text-slate-400'">{{ selectedLabel || placeholder }}</span>
      <svg class="h-4 w-4 flex-shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        data-supplier-dropdown
        class="fixed z-[100] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        :style="dropdownStyle"
      >
        <div class="border-b border-slate-100 p-2">
          <input
            ref="searchInputRef"
            v-model="keyword"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            @keydown.esc.prevent="close"
            @keydown.down.prevent="moveHighlight(1)"
            @keydown.up.prevent="moveHighlight(-1)"
            @keydown.enter.prevent="selectHighlighted"
          />
        </div>
        <div class="max-h-64 overflow-y-auto py-1">
          <button
            v-if="allowClear && modelValue"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-50"
            @click="select(null)"
          >
            <span class="italic">— {{ clearLabel }} —</span>
          </button>
          <button
            v-for="(item, index) in filtered"
            :key="item.id"
            type="button"
            class="flex w-full flex-col px-3 py-1.5 text-left text-sm"
            :class="[
              highlightIndex === index ? 'bg-indigo-50' : 'hover:bg-slate-50',
              String(modelValue) === String(item.id) ? 'font-semibold text-indigo-700' : 'text-slate-700',
            ]"
            @mouseenter="highlightIndex = index"
            @click="select(item.id)"
          >
            <span>{{ labelOf(item) }}</span>
            <span v-if="subLabelOf(item)" class="text-xs text-slate-400">{{ subLabelOf(item) }}</span>
          </button>
          <div v-if="filtered.length === 0" class="px-3 py-3 text-center text-xs text-slate-400">
            {{ emptyLabel }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [Number, String, null], default: null },
  options: { type: Array, default: () => [] }, // [{ id, name, company_name }]
  placeholder: { type: String, default: '-- Select --' },
  searchPlaceholder: { type: String, default: 'Type to search...' },
  emptyLabel: { type: String, default: 'No match' },
  clearLabel: { type: String, default: 'Clear' },
  allowClear: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const searchInputRef = ref(null)
const open = ref(false)
const keyword = ref('')
const highlightIndex = ref(-1)
const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' })

function labelOf(item) {
  return item?.company_name || item?.name || `#${item?.id}`
}
function subLabelOf(item) {
  if (!item) return ''
  if (item.company_name && item.name && item.company_name !== item.name) return item.name
  return ''
}

const selectedLabel = computed(() => {
  const found = props.options.find((o) => String(o.id) === String(props.modelValue))
  return found ? labelOf(found) : ''
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.options
  return props.options.filter((o) => {
    const hay = `${o.name || ''} ${o.company_name || ''}`.toLowerCase()
    return hay.includes(kw)
  })
})

function updateDropdownPos() {
  if (!rootRef.value) return
  const rect = rootRef.value.getBoundingClientRect()
  const maxH = 320
  const spaceBelow = window.innerHeight - rect.bottom
  const placeAbove = spaceBelow < maxH && rect.top > spaceBelow
  const top = placeAbove ? Math.max(8, rect.top - maxH - 4) : rect.bottom + 4
  dropdownStyle.value = {
    top: `${top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}

function toggleOpen() {
  if (props.disabled) return
  open.value ? close() : openDropdown()
}

async function openDropdown() {
  updateDropdownPos()
  open.value = true
  keyword.value = ''
  highlightIndex.value = -1
  await nextTick()
  searchInputRef.value?.focus()
}

function close() {
  open.value = false
}

function select(id) {
  emit('update:modelValue', id)
  emit('change', id)
  close()
}

function moveHighlight(delta) {
  const total = filtered.value.length
  if (!total) return
  let next = highlightIndex.value + delta
  if (next < 0) next = total - 1
  if (next >= total) next = 0
  highlightIndex.value = next
}

function selectHighlighted() {
  if (highlightIndex.value >= 0 && filtered.value[highlightIndex.value]) {
    select(filtered.value[highlightIndex.value].id)
  }
}

function onDocClick(e) {
  if (!open.value) return
  if (rootRef.value?.contains(e.target)) return
  // Clicks inside teleported dropdown should not close
  const dropdowns = document.querySelectorAll('[data-supplier-dropdown]')
  for (const d of dropdowns) {
    if (d.contains(e.target)) return
  }
  close()
}

function onScrollOrResize() {
  if (open.value) updateDropdownPos()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick, true)
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick, true)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})

watch(() => props.options, () => {
  highlightIndex.value = -1
})
</script>
