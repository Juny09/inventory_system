<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-2" @click.self="$emit('close')">
    <div class="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <div class="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 class="text-lg font-semibold text-slate-800">
          {{ form.id ? `Invoice #${form.invoice_no}` : 'New Supplier Invoice' }}
        </h3>
        <button class="text-slate-400 hover:text-slate-600" @click="$emit('close')">×</button>
      </div>

      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
        <div v-if="props.initialData?.imported_from_scan" class="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          已从文档自动带入资料，请检查数量、单价和供应商后再保存。
          <span v-if="props.initialData?.source_file_name" class="ml-1 font-medium">{{ props.initialData.source_file_name }}</span>
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
              @change="onSupplierChange"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">Date <span class="text-red-500">*</span></label>
            <input v-model="form.invoice_date" required type="date" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">Invoice No <span class="text-red-500">*</span></label>
            <input v-model="form.invoice_no" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">Refer to DO <span class="text-slate-400">(optional)</span></label>
            <select v-model="form.do_id" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" @change="onDoChange">
              <option value="">-- No DO (Cash / Direct Invoice) --</option>
              <option v-for="d in doOptions" :key="d.id" :value="d.id">{{ d.do_no }} ({{ formatDate(d.do_date) }})</option>
            </select>
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
              <h4 class="mt-1 text-sm font-semibold text-indigo-900">这张 Invoice 的人工确认历史</h4>
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
                  <p class="text-sm font-semibold text-slate-900">{{ entry.document_no ? `Invoice #${entry.document_no}` : 'Supplier Invoice' }}</p>
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
                  class="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-amber-300 hover:bg-amber-50"
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
                    <span v-if="Number(item.unitPrice) > 0" class="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">Unit Price {{ Number(item.unitPrice).toFixed(2) }}</span>
                    <span v-if="Number(item.amount) > 0" class="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">Amount {{ Number(item.amount).toFixed(2) }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Post to inventory (only when no DO) -->
        <div v-if="!form.do_id" class="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 space-y-2">
          <label class="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input v-model="form.post_to_inventory" type="checkbox" class="size-4 rounded border-slate-300" />
            Post to inventory
          </label>
          <p class="text-[11px] text-slate-500">No DO linked — enable this to auto stock-in items when saving.</p>
          <div v-if="form.post_to_inventory">
            <label class="block text-xs font-medium text-slate-600">Warehouse <span class="text-red-500">*</span></label>
            <select v-model="form.warehouse_id" :required="form.post_to_inventory" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="">-- Select warehouse --</option>
              <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
            </select>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <h4 class="text-sm font-semibold text-slate-700">Items</h4>
              <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input v-model="form.priceIncludesDiscount" type="checkbox" class="rounded border-slate-300 text-indigo-600" />
                <span>Unit price already includes discount (单价已是折后价)</span>
              </label>
            </div>
            <button type="button" class="text-xs text-indigo-600 hover:underline" @click="addRow">+ Add row</button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full border border-slate-200 text-sm">
              <thead class="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th class="px-2 py-2 text-left">Product</th>
                  <th class="px-2 py-2 text-left">Item Code</th>
                  <th class="px-2 py-2 text-left">Description</th>
                  <th class="px-2 py-2 text-left">Serial No</th>
                  <th class="px-2 py-2 text-right">Qty</th>
                  <th class="px-2 py-2 text-right">Unit Price</th>
                  <th class="px-2 py-2 text-right">Discount</th>
                  <th class="px-2 py-2 text-right">Amount</th>
                  <th class="w-10"></th>
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
                  <td class="w-56 px-2 py-2">
                    <ProductSelector
                      :model-value="row.product_id"
                      :initial-label="row.product_label"
                      @update:model-value="(v) => (row.product_id = v)"
                      @select="(p) => onProductSelect(row, p)"
                    />
                  </td>
                  <td class="px-2 py-2"><input v-model="row.item_code" class="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                  <td class="px-2 py-2">
                    <input v-model="row.description" class="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
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
                  <td class="w-20 px-2 py-2"><input v-model.number="row.quantity" type="number" step="0.001" class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm" /></td>
                  <td class="w-24 px-2 py-2"><input v-model.number="row.unit_price" type="number" step="0.01" class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm" /></td>
                  <td class="w-20 px-2 py-2"><input v-model.number="row.discount" :disabled="form.priceIncludesDiscount" type="number" step="0.01" :class="['w-full rounded border px-2 py-1 text-right text-sm', form.priceIncludesDiscount ? 'border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-300']" /></td>
                  <td class="w-24 px-2 py-2 text-right text-sm font-medium">{{ rowAmount(row).toFixed(2) }}</td>
                  <td class="px-2 py-2 text-right">
                    <button type="button" class="text-red-500 hover:text-red-700" @click="form.items.splice(idx, 1)">×</button>
                  </td>
                </tr>
                <tr v-if="form.items.length === 0">
                  <td colspan="9" class="px-2 py-4 text-center text-sm text-slate-400">Select a DO above to import items, or click "Add row" for cash/direct invoice.</td>
                </tr>
              </tbody>
              <tfoot class="bg-slate-50">
                <tr>
                  <td colspan="4" class="px-2 py-2 text-right text-sm font-semibold text-slate-700">Totals:</td>
                  <td class="px-2 py-2 text-right text-sm font-semibold">{{ totalQty.toFixed(3) }}</td>
                  <td colspan="2"></td>
                  <td class="px-2 py-2 text-right text-sm font-semibold">{{ totalAmount.toFixed(2) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <AttachmentSection
          ref="attachmentRef"
          :parent-id="form.id"
          resource="supplier-invoices"
          :attachments="attachments"
          @refresh="reloadAttachments"
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
import { useLocaleStore } from '../stores/locale'

const props = defineProps({
  id: { type: [Number, String, null], default: null },
  suppliers: { type: Array, default: () => [] },
  initialData: { type: Object, default: null },
  scanFocusKey: { type: String, default: 'all' },
  scanFocusRequestId: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'saved', 'scan-item-selected'])
const localeStore = useLocaleStore()

const form = reactive({
  id: null,
  supplier_id: '',
  do_id: '',
  invoice_no: '',
  invoice_date: new Date().toLocaleDateString('en-CA'),
  notes: '',
  post_to_inventory: true,
  warehouse_id: '',
  items: [],
  priceIncludesDiscount: false,
})

// When checked, discount fields are disabled (read-only) but values are preserved for display
const doOptions = ref([])
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
    unit_price: 0,
    discount: 0,
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

function normalizeOcrReviewContext(input, fallbackType = 'invoice') {
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
    type: input?.type === 'delivery_order' ? 'delivery_order' : fallbackType,
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
  return normalizeOcrReviewContext(ocrReviewContext.value, 'invoice')
}

// 中文注释：点击 invoice 某一行 item 时，通知父页面切换 OCR 聚焦到同一条商品。
function handleItemRowClick(index) {
  if (!Number.isInteger(index) || index < 0) return
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

// 中文注释：低置信度 invoice item 必须手动确认，避免 OCR 误识别后直接入账。
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
      unit_price: Number(row.unit_price) || 0,
      amount: rowAmount(row),
      ocr_confidence_level: row.ocr_confidence_level || 'low',
      ocr_confidence_percent: Number(row.ocr_confidence_percent) || 0,
      manual_confirmed_at: row.manual_confirmation_confirmed_at || new Date().toISOString(),
    }))
}

// 中文注释：点击 OCR 图片黄框后，自动滚动到对应的 invoice item 行，并短暂高亮方便肉眼定位。
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

// 中文注释：顶部低置信度提示点击后，直接定位到对应行，并同步右侧 OCR 聚焦。
async function jumpToLowConfidenceItem(index) {
  handleItemRowClick(index)
  await focusScanItemRow(index)
}

// 中文注释：点击时间线确认记录时，恢复当时的 OCR 核对上下文，并同步高亮对应的 invoice item。
async function handleTimelineItemClick(entry, item) {
  const itemIndex = Number(item?.itemIndex)
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return
  const context = normalizeOcrReviewContext(entry?.ocr_review_context || ocrReviewContext.value, 'invoice')
  emit('scan-item-selected', { itemIndex, ocrReviewContext: context })
  await focusScanItemRow(itemIndex)
}

// 中文注释：把识别结果预填到 Invoice 表单，能识别到的数量和单价先自动带入，用户最后复核即可。
async function applyInitialData(initialData) {
  form.id = null
  form.supplier_id = initialData?.supplier_id || ''
  form.do_id = ''
  form.invoice_no = initialData?.document_no || ''
  form.invoice_date = initialData?.document_date || new Date().toLocaleDateString('en-CA')
  form.notes = initialData?.notes || ''
  form.post_to_inventory = Boolean(initialData?.warehouse_id)
  form.warehouse_id = initialData?.warehouse_id || ''
  form.priceIncludesDiscount = false
  form.items = Array.isArray(initialData?.items) && initialData.items.length > 0
    ? initialData.items.map((item) => ({
        product_id: item.product_id || null,
        product_label: item.product_label || '',
        item_code: item.item_code || '',
        description: item.description || '',
        serial_no: item.serial_no || '',
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        discount: Number(item.discount) || 0,
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
  ocrReviewContext.value = normalizeOcrReviewContext(initialData, 'invoice')
  ocrConfirmationTimeline.value = []
  if (form.supplier_id) {
    await loadDOsForSupplier(form.supplier_id)
  }
}

function rowAmount(row) {
  const q = Number(row.quantity) || 0
  const u = Number(row.unit_price) || 0
  if (form.priceIncludesDiscount) {
    const raw = q * u
    return Number.isFinite(raw) ? Math.max(0, raw) : 0
  }
  const raw = q * u - (Number(row.discount) || 0)
  return Number.isFinite(raw) ? Math.max(0, raw) : 0
}

const totalQty = computed(() => form.items.reduce((s, r) => s + (Number(r.quantity) || 0), 0))
const totalAmount = computed(() => form.items.reduce((s, r) => s + rowAmount(r), 0))

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return String(d).slice(0, 10)
  return date.toLocaleDateString('en-CA')
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

async function loadDOsForSupplier(supplierId) {
  if (!supplierId) {
    doOptions.value = []
    return
  }
  try {
    const { data } = await api.get('/delivery-orders', {
      params: { supplierId, page: 1, pageSize: 200, excludeInvoiced: true },
    })
    doOptions.value = data.items || []
  } catch (error) {
    doOptions.value = []
  }
}

async function onSupplierChange() {
  form.do_id = ''
  form.items = []
  await loadDOsForSupplier(form.supplier_id)
}

async function onDoChange() {
  if (!form.do_id) return
  try {
    const { data } = await api.get(`/delivery-orders/${form.do_id}`)
    form.items = (data.items || []).map((it) => ({
      product_id: it.product_id,
      product_label: it.product_id ? `${it.product_product_code || ''} · ${it.product_name || ''}` : '',
      item_code: it.item_code || '',
      description: it.description || '',
      serial_no: it.serial_no || '',
      quantity: Number(it.quantity) || 0,
      unit_price: 0,
      discount: 0,
      manual_confirmation_required: false,
      manual_confirmation_done: true,
      manual_confirmation_confirmed_at: '',
    }))
    // 自动填充 invoice_no = do_no（仅当当前为空时）
    if (!form.invoice_no && data?.do_no) {
      form.invoice_no = data.do_no
    }
    // 自动填充 invoice_date = do_date
    if (data?.do_date) {
      form.invoice_date = new Date(data.do_date).toLocaleDateString('en-CA')
    }
  } catch (error) {
    errorMessage.value = 'Failed to load DO items.'
  }
}

async function reloadAttachments() {
  if (!form.id) return
  try {
    const { data } = await api.get(`/supplier-invoices/${form.id}`)
    attachments.value = data.attachments || []
  } catch (error) {
    // ignore
  }
}

async function loadExisting(id) {
  const { data } = await api.get(`/supplier-invoices/${id}`)
  form.id = data.id
  form.supplier_id = data.supplier_id
  form.do_id = data.do_id
  form.invoice_no = data.invoice_no
  form.invoice_date = data.invoice_date ? new Date(data.invoice_date).toLocaleDateString('en-CA') : ''
  form.notes = data.notes || ''
  form.post_to_inventory = Boolean(data.posted_to_inventory)
  form.warehouse_id = data.warehouse_id ? String(data.warehouse_id) : ''
  form.items = (data.items || []).map((it) => ({
    product_id: it.product_id,
    product_label: it.product_id ? `${it.product_product_code || ''} · ${it.product_name || ''}` : '',
    item_code: it.item_code || '',
    description: it.description || '',
    serial_no: it.serial_no || '',
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
    discount: Number(it.discount) || 0,
    manual_confirmation_required: false,
    manual_confirmation_done: true,
    manual_confirmation_confirmed_at: '',
  }))
  form.priceIncludesDiscount = Boolean(data.price_includes_discount)
  attachments.value = data.attachments || []
  importedSourceFile.value = null
  ocrReviewContext.value = normalizeOcrReviewContext(data.ocr_review_context, 'invoice')
  ocrConfirmationTimeline.value = Array.isArray(data.ocr_confirmation_timeline) ? data.ocr_confirmation_timeline : []
  await loadDOsForSupplier(data.supplier_id)
}

// 中文注释：Invoice 保存成功后自动上传原始扫描件，方便日后核对 OCR 与附件原图。
async function uploadImportedSourceFile(parentId) {
  if (!parentId || !importedSourceFile.value) return ''
  try {
    const formData = new FormData()
    formData.append('file', importedSourceFile.value)
    await api.post(`/supplier-invoices/${parentId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    importedSourceFile.value = null
    return ''
  } catch (error) {
    return error.response?.data?.message || error.message || 'Invoice saved, but source attachment upload failed.'
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
    const invalidPriceRow = form.items.find((it) => it.product_id && Number(it.unit_price || 0) <= 0)
    if (invalidPriceRow) {
      errorMessage.value = localeStore.locale === 'en' ? 'Unit price must be greater than 0.' : '单价必须大于 0（否则成本不会更新）。'
      submitting.value = false
      return
    }

    const payload = {
      supplier_id: Number(form.supplier_id),
      do_id: form.do_id ? Number(form.do_id) : null,
      invoice_no: form.invoice_no.trim(),
      invoice_date: form.invoice_date,
      notes: form.notes || null,
      post_to_inventory: !form.do_id ? form.post_to_inventory : false,
      warehouse_id: !form.do_id && form.post_to_inventory && form.warehouse_id ? Number(form.warehouse_id) : null,
      priceIncludesDiscount: form.priceIncludesDiscount,
      ocr_confirmation_audit: buildOcrConfirmationAuditPayload(),
      ocr_review_context: buildOcrReviewContextPayload(),
      items: form.items.map((it) => ({
        product_id: it.product_id || null,
        item_code: it.item_code || null,
        description: it.description || null,
        serial_no: it.serial_no || null,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        discount: Number(it.discount) || 0,
      })),
    }
    if (form.id) {
      await api.put(`/supplier-invoices/${form.id}`, payload)
    } else {
      const { data } = await api.post('/supplier-invoices', payload)
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
