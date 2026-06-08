<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-2" @click.self="$emit('close')">
    <div class="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <div class="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 class="text-lg font-semibold text-slate-800">
          {{ form.id ? `Delivery Order #${form.do_no}` : 'New Delivery Order' }}
        </h3>
        <button class="text-slate-400 hover:text-slate-600" @click="$emit('close')">×</button>
      </div>

      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
        <div v-if="props.initialData?.imported_from_scan" class="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          已从文档自动带入资料，请检查内容后再保存。
          <span v-if="props.initialData?.source_file_name" class="ml-1 font-medium">{{ props.initialData.source_file_name }}</span>
        </div>
        <div v-if="activeTimelineTrace" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-amber-700">追查模式</p>
              <p class="mt-1 font-semibold">当前正在追查 {{ activeTimelineTrace.itemLabel }}</p>
              <p class="mt-1 text-xs text-amber-800">
                {{ activeTimelineTrace.documentLabel }}
                <span v-if="activeTimelineTrace.userLabel" class="ml-1">· {{ activeTimelineTrace.userLabel }}</span>
                <span v-if="activeTimelineTrace.timeLabel" class="ml-1">· {{ activeTimelineTrace.timeLabel }}</span>
              </p>
            </div>
            <button
              type="button"
              class="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              @click="clearActiveTraceMode"
            >
              退出追查模式
            </button>
          </div>
          <div v-if="traceComparison" class="mt-3 rounded-lg border border-amber-200 bg-white/80 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs font-semibold text-amber-900">历史对比面板</p>
              <div class="flex flex-wrap gap-2 text-[11px]">
                <span class="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                  历史 OCR {{ traceComparison.historicalConfidence }}
                </span>
                <span class="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                  当前 OCR {{ traceComparison.currentConfidence }}
                </span>
                <span
                  class="rounded-full px-2 py-0.5 font-semibold"
                  :class="traceComparison.changedCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'"
                >
                  {{ traceComparison.changedCount > 0 ? `${traceComparison.changedCount} 项已变更` : '与历史一致' }}
                </span>
              </div>
            </div>
            <div class="mt-3 grid gap-2 md:grid-cols-2">
              <button
                v-for="field in traceComparison.fields"
                :key="field.key"
                type="button"
                class="rounded border px-3 py-2 text-left"
                :class="field.changed ? 'border-rose-200 bg-rose-50 hover:bg-rose-100' : 'border-emerald-200 bg-emerald-50/70'"
                :disabled="!field.changed"
                @click="handleTraceFieldClick(field)"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-slate-800">{{ field.label }}</p>
                  <span
                    class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    :class="field.changed ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'"
                  >
                    {{ field.changed ? '已变更，可点击定位' : '一致' }}
                  </span>
                </div>
                <div class="mt-2 space-y-1 text-xs">
                  <p class="text-slate-500">历史确认值</p>
                  <p class="font-medium text-slate-900">{{ field.historicalDisplay }}</p>
                  <p class="pt-1 text-slate-500">当前单据值</p>
                  <p class="font-medium" :class="field.changed ? 'text-rose-700' : 'text-emerald-700'">{{ field.currentDisplay }}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
        <div v-if="lowConfidenceItems.length > 0" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p class="font-semibold">发现 {{ lowConfidenceItems.length }} 条低置信度 Item，保存前必须先完成人工确认。</p>
          <p class="mt-1 text-xs text-rose-700">当前还有 {{ pendingLowConfidenceItems.length }} 条未确认，未确认时系统会禁止保存。</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="item in lowConfidenceItems"
              :key="`low-risk-${item.index}`"
              type="button"
              class="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              @click="jumpToLowConfidenceItem(item.index)"
            >
              Item {{ item.index + 1 }} · {{ item.ocr_confidence_label || '低' }} · {{ item.manual_confirmation_done ? '已确认' : '待确认' }}
            </button>
            <button
              v-if="pendingLowConfidenceItems.length > 0"
              type="button"
              class="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              @click="confirmAllLowConfidenceItems"
            >
              全部确认低置信度 Item
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label class="block text-xs font-medium text-slate-600">Supplier Company <span class="text-red-500">*</span></label>
            <SupplierSearchSelect
              v-model="form.supplier_id"
              :options="suppliers"
              placeholder="-- Select --"
              search-placeholder="Search supplier..."
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">Date <span class="text-red-500">*</span></label>
            <input v-model="form.do_date" required type="date" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">DO No <span class="text-red-500">*</span></label>
            <input v-model="form.do_no" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">Warehouse <span class="text-red-500">*</span></label>
            <select v-model="form.warehouse_id" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="">-- Select --</option>
              <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
            <p class="mt-1 text-[11px] text-slate-400">Items will be stocked into this warehouse.</p>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600">Notes</label>
          <textarea v-model="form.notes" rows="2" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"></textarea>
        </div>

        <div v-if="ocrConfirmationTimeline.length > 0" class="rounded-lg border border-indigo-100 bg-indigo-50/70 px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-indigo-500">OCR Confirmation Timeline</p>
              <h4 class="mt-1 text-sm font-semibold text-indigo-900">这张 DO 的人工确认历史</h4>
              <p class="mt-1 text-xs text-indigo-700">可直接查看谁确认了哪些低置信度 Item，以及确认时间。</p>
            </div>
            <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
              {{ ocrConfirmationTimeline.length }} 条记录
            </span>
          </div>
          <div class="mt-3 space-y-3">
            <div
              v-for="entry in ocrConfirmationTimeline"
              :key="entry.audit_id"
              class="rounded-lg border border-white bg-white p-3 shadow-sm"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-slate-900">{{ entry.document_no ? `DO #${entry.document_no}` : 'Delivery Order' }}</p>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ entry.user_email || entry.confirmed_by?.email || 'System' }}
                    <span v-if="entry.user_role" class="ml-1">· {{ entry.user_role }}</span>
                    <span class="ml-1">· {{ formatAuditTimelineTime(entry.created_at) }}</span>
                  </p>
                  <p v-if="entry.description" class="mt-2 text-xs text-slate-600">{{ entry.description }}</p>
                </div>
                <span class="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                  {{ entry.confirmation_count || entry.items?.length || 0 }} 条确认
                </span>
              </div>
              <div class="mt-3 space-y-2">
                <button
                  v-for="item in entry.items || []"
                  :key="`${entry.audit_id}-${item.itemIndex}-${item.sortOrder}`"
                  type="button"
                  class="w-full rounded border px-3 py-2 text-left transition"
                  :class="isActiveTimelineTrace(entry, item)
                    ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                    : 'border-slate-200 bg-slate-50 hover:border-amber-300 hover:bg-amber-50'"
                  @click="handleTimelineItemClick(entry, item)"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-xs font-semibold text-slate-900">{{ item.itemLabel || `Item ${Number(item.itemIndex) + 1}` }}</span>
                      <span v-if="item.itemCode" class="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">{{ item.itemCode }}</span>
                      <span
                        class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        :class="confidenceBadgeClass(item.ocrConfidenceLevel)"
                      >
                        {{ formatAuditConfidence(item.ocrConfidenceLevel, item.ocrConfidencePercent) }}
                      </span>
                    </div>
                    <span class="text-[11px] text-slate-500">{{ formatAuditTimelineTime(item.manualConfirmedAt) }}</span>
                  </div>
                  <p class="mt-2 text-xs text-slate-600">{{ item.description || '无描述' }}</p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span class="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">Qty {{ Number(item.quantity) || 0 }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-semibold text-slate-700">Items</h4>
            <button type="button" class="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-800" @click="addRow">+ Add row</button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full border border-slate-200 text-sm">
              <thead class="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th class="px-2 py-2 text-left">Product</th>
                  <th class="px-2 py-2 text-left">Item Code</th>
                  <th class="px-2 py-2 text-left">Description</th>
                  <th class="px-2 py-2 text-left">Serial No</th>
                  <th class="px-2 py-2 text-left">Qty</th>
                  <th class="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in form.items"
                  :key="idx"
                  :ref="(el) => setItemRowRef(el, idx)"
                  :class="[
                    'border-t border-slate-200 align-top transition-colors',
                    activeScanItemIndex === idx
                      ? 'bg-amber-50 ring-2 ring-inset ring-amber-300'
                      : isLowConfidenceRow(row)
                        ? 'bg-rose-50'
                        : '',
                  ]"
                  @click="handleItemRowClick(idx)"
                >
                  <td class="w-64 px-2 py-2">
                    <ProductSelector
                      :model-value="row.product_id"
                      :initial-label="row.product_label"
                      @update:model-value="(v) => (row.product_id = v)"
                      @select="(p) => onProductSelect(row, p)"
                    />
                  </td>
                  <td class="px-2 py-2">
                    <input
                      v-model="row.item_code"
                      data-trace-field="item_code"
                      :class="getTraceFieldInputClass(idx, 'item_code', 'w-full rounded border border-slate-300 px-2 py-1 text-sm')"
                    />
                  </td>
                  <td class="px-2 py-2">
                    <input
                      v-model="row.description"
                      data-trace-field="description"
                      :class="getTraceFieldInputClass(idx, 'description', 'w-full rounded border border-slate-300 px-2 py-1 text-sm')"
                    />
                    <div v-if="row.ocr_confidence_label" class="mt-1">
                      <span
                        class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        :class="confidenceBadgeClass(row.ocr_confidence_level)"
                      >
                        OCR {{ row.ocr_confidence_label }}
                      </span>
                      <button
                        v-if="requiresManualConfirmation(row)"
                        type="button"
                        class="ml-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        :class="row.manual_confirmation_done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100'"
                        @click.stop="toggleManualConfirmation(row)"
                      >
                        {{ row.manual_confirmation_done ? '已人工确认' : '点击确认无误' }}
                      </button>
                      <span v-if="row.manual_confirmation_done && row.manual_confirmation_confirmed_at" class="ml-2 text-[11px] text-emerald-700">
                        {{ formatConfirmationTime(row.manual_confirmation_confirmed_at) }}
                      </span>
                    </div>
                  </td>
                  <td class="px-2 py-2"><input v-model="row.serial_no" class="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                  <td class="w-24 px-2 py-2">
                    <input
                      v-model.number="row.quantity"
                      data-trace-field="quantity"
                      type="number"
                      step="0.001"
                      :class="getTraceFieldInputClass(idx, 'quantity', 'w-full rounded border border-slate-300 px-2 py-1 text-sm')"
                    />
                  </td>
                  <td class="px-2 py-2 text-right">
                    <button type="button" class="text-red-500 hover:text-red-700" @click="form.items.splice(idx, 1)">×</button>
                  </td>
                </tr>
                <tr v-if="form.items.length === 0">
                  <td colspan="6" class="px-2 py-4 text-center text-sm text-slate-400">No items. Click "Add row" to start.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <AttachmentSection
          ref="attachmentRef"
          :parent-id="form.id"
          resource="delivery-orders"
          :attachments="attachments"
          @refresh="loadAttachments"
        />
        </div>

        <div class="flex flex-shrink-0 flex-col gap-2 border-t border-slate-200 px-5 py-3">
          <p v-if="errorMessage" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm" @click="$emit('close')">Cancel</button>
            <button type="submit" :disabled="submitting || pendingLowConfidenceItems.length > 0" class="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {{ submitting ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch, onMounted, nextTick } from 'vue'
import api from '../services/api'
import ProductSelector from './ProductSelector.vue'
import AttachmentSection from './AttachmentSection.vue'
import SupplierSearchSelect from './SupplierSearchSelect.vue'

const props = defineProps({
  id: { type: [Number, String, null], default: null },
  suppliers: { type: Array, default: () => [] },
  initialData: { type: Object, default: null },
  scanFocusKey: { type: String, default: 'all' },
  scanFocusRequestId: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'saved', 'scan-item-selected', 'scan-trace-cleared'])

const form = reactive({
  id: null,
  supplier_id: '',
  do_no: '',
  do_date: new Date().toLocaleDateString('en-CA'),
  notes: '',
  warehouse_id: '',
  items: [],
})
const warehouses = ref([])
const attachments = ref([])
const attachmentRef = ref(null)
const submitting = ref(false)
const errorMessage = ref('')
const importedSourceFile = ref(null)
const ocrReviewContext = ref(null)
const itemRowRefs = ref([])
const activeScanItemIndex = ref(null)
const ocrConfirmationTimeline = ref([])
const activeTimelineTrace = ref(null)
const flashFieldTarget = ref(null)

async function loadWarehouses() {
  try {
    const { data } = await api.get('/warehouses')
    warehouses.value = Array.isArray(data) ? data : data.items || []
  } catch {
    warehouses.value = []
  }
}

function blankRow() {
  return {
    product_id: null,
    product_label: '',
    item_code: '',
    description: '',
    serial_no: '',
    quantity: 1,
    ocr_confidence_percent: 0,
    ocr_confidence_level: '',
    ocr_confidence_label: '',
    manual_confirmation_required: false,
    manual_confirmation_done: true,
    manual_confirmation_confirmed_at: '',
  }
}

function confidenceBadgeClass(level) {
  if (level === 'high') return 'bg-emerald-100 text-emerald-800'
  if (level === 'medium') return 'bg-amber-100 text-amber-800'
  return 'bg-rose-100 text-rose-800'
}

function isLowConfidenceRow(row) {
  return row?.ocr_confidence_level === 'low'
}

function requiresManualConfirmation(row) {
  return Boolean(row?.manual_confirmation_required)
}

function formatConfirmationTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `确认时间 ${date.toLocaleString('zh-CN', { hour12: false })}`
}

function formatAuditTimelineTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

function formatAuditConfidence(level, percent) {
  const prefix = level === 'high' ? '高' : level === 'medium' ? '中' : '低'
  return `${prefix} ${Number(percent) || 0}%`
}

function setItemRowRef(element, index) {
  if (!element) return
  itemRowRefs.value[index] = element
}

function getScanItemIndexFromKey(key) {
  const matched = String(key || '').match(/^item-(\d+)$/)
  return matched ? Number(matched[1]) : null
}

function normalizeOcrReviewContext(input, fallbackType = 'delivery_order') {
  if (!input || typeof input !== 'object') return null

  const items = Array.isArray(input.items)
    ? input.items.map((item) => ({
        product_id: item?.product_id || null,
        product_label: item?.product_label || '',
        item_code: item?.item_code || '',
        description: item?.description || '',
        serial_no: item?.serial_no || '',
        quantity: Number(item?.quantity) || 0,
        unit_price: Number(item?.unit_price) || 0,
        discount: Number(item?.discount) || 0,
        extracted_amount: Number(item?.extracted_amount) || 0,
        ocr_confidence_percent: Number(item?.ocr_confidence_percent) || 0,
        ocr_confidence_level: item?.ocr_confidence_level || '',
        ocr_confidence_label: item?.ocr_confidence_label || '',
      }))
    : []

  const normalized = {
    imported_from_scan: true,
    source_file_name: input?.source_file_name || '',
    supplier_id: input?.supplier_id ? String(input.supplier_id) : '',
    supplier_name: input?.supplier_name || '',
    warehouse_id: input?.warehouse_id ? String(input.warehouse_id) : '',
    document_no: input?.document_no || '',
    document_date: input?.document_date || '',
    notes: input?.notes || '',
    items,
    type: input?.type === 'invoice' ? 'invoice' : fallbackType,
    detected_type: input?.detected_type || fallbackType,
    raw_text: input?.raw_text || '',
    file_url: input?.file_url || '',
    file_mime_type: input?.file_mime_type || '',
    ocr_words: Array.isArray(input?.ocr_words) ? input.ocr_words : [],
    ocr_preview_url: input?.ocr_preview_url || '',
    ocr_preview_width: Number(input?.ocr_preview_width) || 0,
    ocr_preview_height: Number(input?.ocr_preview_height) || 0,
  }

  if (!normalized.file_url && !normalized.ocr_preview_url && !normalized.raw_text && normalized.ocr_words.length === 0) {
    return null
  }

  return normalized
}

function buildOcrReviewContextPayload() {
  return normalizeOcrReviewContext(ocrReviewContext.value, 'delivery_order')
}

function buildTimelineTraceKey(entry, item) {
  return `${entry?.audit_id || 'audit'}-${Number(item?.itemIndex) || 0}-${Number(item?.sortOrder) || 0}`
}

function buildTimelineTraceContext(entry, item) {
  return {
    key: buildTimelineTraceKey(entry, item),
    auditId: entry?.audit_id || null,
    itemIndex: Number(item?.itemIndex) || 0,
    itemLabel: item?.itemLabel || `Item ${Number(item?.itemIndex) + 1}`,
    documentLabel: entry?.document_no ? `DO #${entry.document_no}` : 'DO 确认记录',
    userLabel: entry?.user_email || entry?.confirmed_by?.email || 'System',
    timeLabel: formatAuditTimelineTime(item?.manualConfirmedAt || entry?.created_at),
    historicalItem: {
      item_code: item?.itemCode || '',
      description: item?.description || '',
      quantity: Number(item?.quantity) || 0,
      ocr_confidence_level: item?.ocrConfidenceLevel || '',
      ocr_confidence_percent: Number(item?.ocrConfidencePercent) || 0,
    },
  }
}

function isActiveTimelineTrace(entry, item) {
  if (!activeTimelineTrace.value?.key) return false
  return activeTimelineTrace.value.key === buildTimelineTraceKey(entry, item)
}

function clearActiveTraceMode() {
  activeTimelineTrace.value = null
  emit('scan-trace-cleared')
}

function buildFlashFieldKey(index, fieldKey) {
  return `${index}-${fieldKey}`
}

function isTraceFieldFlashing(index, fieldKey) {
  return flashFieldTarget.value?.key === buildFlashFieldKey(index, fieldKey)
}

function getTraceFieldInputClass(index, fieldKey, baseClass) {
  return [
    baseClass,
    isTraceFieldFlashing(index, fieldKey)
      ? 'border-amber-400 bg-amber-100 ring-2 ring-amber-300 animate-pulse'
      : '',
  ]
}

function triggerTraceFieldFlash(index, fieldKey) {
  flashFieldTarget.value = {
    key: buildFlashFieldKey(index, fieldKey),
  }
  window.clearTimeout(triggerTraceFieldFlash._timer)
  triggerTraceFieldFlash._timer = window.setTimeout(() => {
    if (flashFieldTarget.value?.key === buildFlashFieldKey(index, fieldKey)) {
      flashFieldTarget.value = null
    }
  }, 1800)
}

function normalizeCompareText(value) {
  return String(value ?? '').trim()
}

function normalizeCompareNumber(value, decimals = 3) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  return Number(numberValue.toFixed(decimals))
}

function formatCompareValue(value, type = 'text') {
  if (type === 'qty') {
    const normalized = normalizeCompareNumber(value, 3)
    return normalized === null ? '—' : normalized.toLocaleString('en-US', { maximumFractionDigits: 3 })
  }
  const normalized = normalizeCompareText(value)
  return normalized || '—'
}

function isSameCompareValue(left, right, type = 'text') {
  if (type === 'qty') {
    return normalizeCompareNumber(left, 3) === normalizeCompareNumber(right, 3)
  }
  return normalizeCompareText(left) === normalizeCompareText(right)
}

function buildTraceField(key, label, historicalValue, currentValue, type = 'text') {
  return {
    key,
    label,
    historicalDisplay: formatCompareValue(historicalValue, type),
    currentDisplay: formatCompareValue(currentValue, type),
    changed: !isSameCompareValue(historicalValue, currentValue, type),
  }
}

// 中文注释：点击历史对比里的“已变更”字段时，直接滚动到对应 item 行并聚焦那一个输入框。
async function focusTraceField(index, fieldKey) {
  if (!Number.isInteger(index) || index < 0 || !fieldKey) return
  await focusScanItemRow(index)
  await nextTick()
  const rowElement = itemRowRefs.value[index]
  const target = rowElement?.querySelector(`[data-trace-field="${fieldKey}"]`)
  if (!target || typeof target.focus !== 'function') return
  triggerTraceFieldFlash(index, fieldKey)
  target.focus({ preventScroll: true })
  if (typeof target.select === 'function') {
    target.select()
  }
}

async function handleTraceFieldClick(field) {
  if (!field?.changed || !activeTimelineTrace.value) return
  await focusTraceField(Number(activeTimelineTrace.value.itemIndex), field.key)
}

const traceComparison = computed(() => {
  if (!activeTimelineTrace.value) return null

  const itemIndex = Number(activeTimelineTrace.value.itemIndex)
  const currentRow = Number.isInteger(itemIndex) && itemIndex >= 0 ? form.items[itemIndex] || {} : {}
  const currentOcrRow = Number.isInteger(itemIndex) && itemIndex >= 0 ? ocrReviewContext.value?.items?.[itemIndex] || {} : {}
  const historicalItem = activeTimelineTrace.value.historicalItem || {}
  const fields = [
    buildTraceField('item_code', 'Item Code', historicalItem.item_code, currentRow.item_code),
    buildTraceField('description', 'Description', historicalItem.description, currentRow.description),
    buildTraceField('quantity', 'Qty', historicalItem.quantity, currentRow.quantity, 'qty'),
  ]

  return {
    historicalConfidence: formatAuditConfidence(historicalItem.ocr_confidence_level, historicalItem.ocr_confidence_percent),
    currentConfidence: formatAuditConfidence(currentOcrRow.ocr_confidence_level, currentOcrRow.ocr_confidence_percent),
    fields,
    changedCount: fields.filter((field) => field.changed).length,
  }
})

// 中文注释：用户直接点击表单某一行时，把选中的 item 序号回传给右侧 OCR 面板做反向高亮。
function handleItemRowClick(index) {
  if (!Number.isInteger(index) || index < 0) return
  activeTimelineTrace.value = null
  emit('scan-trace-cleared')
  activeScanItemIndex.value = index
  emit('scan-item-selected', { itemIndex: index })
}

const lowConfidenceItems = computed(() => {
  return form.items
    .map((item, index) => ({ ...item, index }))
    .filter((item) => isLowConfidenceRow(item))
    .sort((a, b) => Number(a.ocr_confidence_percent || 0) - Number(b.ocr_confidence_percent || 0))
})

const pendingLowConfidenceItems = computed(() => {
  return lowConfidenceItems.value.filter((item) => requiresManualConfirmation(item) && !item.manual_confirmation_done)
})

// 中文注释：低置信度 item 需要用户手动点一次确认，才能允许最终保存。
function toggleManualConfirmation(row) {
  if (!requiresManualConfirmation(row)) return
  row.manual_confirmation_done = !row.manual_confirmation_done
  row.manual_confirmation_confirmed_at = row.manual_confirmation_done ? new Date().toISOString() : ''
}

function confirmAllLowConfidenceItems() {
  form.items.forEach((row) => {
    if (requiresManualConfirmation(row)) {
      row.manual_confirmation_done = true
      row.manual_confirmation_confirmed_at = row.manual_confirmation_confirmed_at || new Date().toISOString()
    }
  })
}

function buildOcrConfirmationAuditPayload() {
  return form.items
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => requiresManualConfirmation(row) && row.manual_confirmation_done)
    .map(({ row, index }) => ({
      item_index: index,
      item_label: `Item ${index + 1}`,
      item_code: row.item_code || '',
      description: row.description || '',
      quantity: Number(row.quantity) || 0,
      ocr_confidence_level: row.ocr_confidence_level || 'low',
      ocr_confidence_percent: Number(row.ocr_confidence_percent) || 0,
      manual_confirmed_at: row.manual_confirmation_confirmed_at || new Date().toISOString(),
    }))
}

// 中文注释：当用户从 OCR 高亮框点进来时，自动把对应的 item 行滚动到视口并加亮一下。
async function focusScanItemRow(index) {
  if (!Number.isInteger(index) || index < 0) return
  await nextTick()
  const rowElement = itemRowRefs.value[index]
  if (!rowElement) return

  activeScanItemIndex.value = index
  rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const firstInput = rowElement.querySelector('input, button, textarea, select')
  if (firstInput && typeof firstInput.focus === 'function') {
    firstInput.focus({ preventScroll: true })
  }

  window.clearTimeout(focusScanItemRow._timer)
  focusScanItemRow._timer = window.setTimeout(() => {
    if (activeScanItemIndex.value === index) {
      activeScanItemIndex.value = null
    }
  }, 2200)
}

// 中文注释：顶部风险提示点击后，直接滚动并同步右侧 OCR 面板到对应的低置信度 item。
async function jumpToLowConfidenceItem(index) {
  handleItemRowClick(index)
  await focusScanItemRow(index)
}

// 中文注释：点击时间线里的某条确认记录时，同时聚焦表单行，并把当时保存下来的 OCR 上下文交给父页面恢复右侧核对面板。
async function handleTimelineItemClick(entry, item) {
  const itemIndex = Number(item?.itemIndex)
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return
  const context = normalizeOcrReviewContext(entry?.ocr_review_context || ocrReviewContext.value, 'delivery_order')
  const traceContext = buildTimelineTraceContext(entry, item)
  activeTimelineTrace.value = traceContext
  emit('scan-item-selected', { itemIndex, ocrReviewContext: context, traceContext })
  await focusScanItemRow(itemIndex)
}

// 中文注释：把识别结果预填到 DO 表单，用户打开弹窗后只需要检查再保存。
function applyInitialData(initialData) {
  form.id = null
  form.supplier_id = initialData?.supplier_id || ''
  form.do_no = initialData?.document_no || ''
  form.do_date = initialData?.document_date || new Date().toLocaleDateString('en-CA')
  form.notes = initialData?.notes || ''
  form.warehouse_id = initialData?.warehouse_id || ''
  form.items = Array.isArray(initialData?.items) && initialData.items.length > 0
    ? initialData.items.map((item) => ({
        product_id: item.product_id || null,
        product_label: item.product_label || '',
        item_code: item.item_code || '',
        description: item.description || '',
        serial_no: item.serial_no || '',
        quantity: Number(item.quantity) || 1,
        ocr_confidence_percent: Number(item.ocr_confidence_percent) || 0,
        ocr_confidence_level: item.ocr_confidence_level || '',
        ocr_confidence_label: item.ocr_confidence_label || '',
        manual_confirmation_required: item.ocr_confidence_level === 'low',
        manual_confirmation_done: item.ocr_confidence_level !== 'low',
        manual_confirmation_confirmed_at: item.ocr_confidence_level === 'low' ? '' : new Date().toISOString(),
      }))
    : [blankRow()]
  attachments.value = []
  importedSourceFile.value = initialData?.source_file || null
  ocrReviewContext.value = normalizeOcrReviewContext(initialData, 'delivery_order')
  ocrConfirmationTimeline.value = []
  activeTimelineTrace.value = null
}

function addRow() {
  form.items.push(blankRow())
}

function onProductSelect(row, product) {
  if (!product) {
    row.product_id = null
    row.product_label = ''
    return
  }
  row.product_id = product.id
  row.product_label = `${product.product_code || product.sku} · ${product.name}`
  row.item_code = product.product_code || product.sku || row.item_code
  row.description = product.name || row.description
}

async function loadAttachments() {
  if (!form.id) return
  try {
    const { data } = await api.get(`/delivery-orders/${form.id}`)
    attachments.value = data.attachments || []
  } catch (error) {
    // ignore
  }
}

async function loadExisting(id) {
  const { data } = await api.get(`/delivery-orders/${id}`)
  form.id = data.id
  form.supplier_id = data.supplier_id
  form.do_no = data.do_no
  form.do_date = data.do_date ? new Date(data.do_date).toLocaleDateString('en-CA') : ''
  form.notes = data.notes || ''
  form.warehouse_id = data.warehouse_id ? String(data.warehouse_id) : ''
  form.items = (data.items || []).map((it) => ({
    product_id: it.product_id,
    product_label: it.product_id ? `${it.product_product_code || ''} · ${it.product_name || ''}` : '',
    item_code: it.item_code || '',
    description: it.description || '',
    serial_no: it.serial_no || '',
    quantity: Number(it.quantity) || 0,
    manual_confirmation_required: false,
    manual_confirmation_done: true,
    manual_confirmation_confirmed_at: '',
  }))
  attachments.value = data.attachments || []
  importedSourceFile.value = null
  ocrReviewContext.value = normalizeOcrReviewContext(data.ocr_review_context, 'delivery_order')
  ocrConfirmationTimeline.value = Array.isArray(data.ocr_confirmation_timeline) ? data.ocr_confirmation_timeline : []
  activeTimelineTrace.value = null
}

// 中文注释：扫描创建成功后，把原始图片/PDF 自动补传到当前 DO 附件区，方便以后回查。
async function uploadImportedSourceFile(parentId) {
  if (!parentId || !importedSourceFile.value) return ''
  try {
    const formData = new FormData()
    formData.append('file', importedSourceFile.value)
    await api.post(`/delivery-orders/${parentId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    importedSourceFile.value = null
    return ''
  } catch (error) {
    return error.response?.data?.message || error.message || 'DO saved, but source attachment upload failed.'
  }
}

async function submit() {
  submitting.value = true
  errorMessage.value = ''
  try {
    if (pendingLowConfidenceItems.value.length > 0) {
      errorMessage.value = '还有低置信度 Item 未人工确认，请先检查并确认后再保存。'
      submitting.value = false
      return
    }
    const payload = {
      supplier_id: Number(form.supplier_id),
      do_no: form.do_no.trim(),
      do_date: form.do_date,
      warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
      notes: form.notes || null,
      ocr_confirmation_audit: buildOcrConfirmationAuditPayload(),
      ocr_review_context: buildOcrReviewContextPayload(),
      items: form.items.map((it) => ({
        product_id: it.product_id || null,
        item_code: it.item_code || null,
        description: it.description || null,
        serial_no: it.serial_no || null,
        quantity: Number(it.quantity) || 0,
      })),
    }
    if (form.id) {
      await api.put(`/delivery-orders/${form.id}`, payload)
    } else {
      const { data } = await api.post('/delivery-orders', payload)
      form.id = data.id
    }
    if (attachmentRef.value && typeof attachmentRef.value.flush === 'function') {
      await attachmentRef.value.flush(form.id)
    }
    const attachmentWarning = await uploadImportedSourceFile(form.id)
    emit('saved', { id: form.id, attachmentWarning })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to save.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadWarehouses()
  if (props.id) {
    loadExisting(props.id)
  } else if (props.initialData) {
    applyInitialData(props.initialData)
  } else {
    form.items = [blankRow()]
  }
})

watch(
  () => [props.scanFocusKey, props.scanFocusRequestId],
  async ([focusKey]) => {
    const itemIndex = getScanItemIndexFromKey(focusKey)
    if (itemIndex === null) {
      activeScanItemIndex.value = null
      return
    }
    await focusScanItemRow(itemIndex)
  },
)
</script>
