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
                <tr v-for="(row, idx) in form.items" :key="idx" class="border-t border-slate-200 align-top">
                  <td class="w-56 px-2 py-2">
                    <ProductSelector
                      :model-value="row.product_id"
                      :initial-label="row.product_label"
                      @update:model-value="(v) => (row.product_id = v)"
                      @select="(p) => onProductSelect(row, p)"
                    />
                  </td>
                  <td class="px-2 py-2"><input v-model="row.item_code" class="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                  <td class="px-2 py-2"><input v-model="row.description" class="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
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
            <button type="submit" :disabled="submitting" class="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {{ submitting ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue'
import api from '../services/api'
import ProductSelector from './ProductSelector.vue'
import AttachmentSection from './AttachmentSection.vue'
import SupplierSearchSelect from './SupplierSearchSelect.vue'

const props = defineProps({
  id: { type: [Number, String, null], default: null },
  suppliers: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'saved'])

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

async function loadWarehouses() {
  try {
    const { data } = await api.get('/warehouses')
    warehouses.value = Array.isArray(data) ? data : data.items || []
  } catch {
    warehouses.value = []
  }
}

function blankRow() {
  return { product_id: null, product_label: '', item_code: '', description: '', serial_no: '', quantity: 1, unit_price: 0, discount: 0 }
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
  }))
  form.priceIncludesDiscount = Boolean(data.price_includes_discount)
  attachments.value = data.attachments || []
  await loadDOsForSupplier(data.supplier_id)
}

async function submit() {
  submitting.value = true
  errorMessage.value = ''
  try {
    const payload = {
      supplier_id: Number(form.supplier_id),
      do_id: form.do_id ? Number(form.do_id) : null,
      invoice_no: form.invoice_no.trim(),
      invoice_date: form.invoice_date,
      notes: form.notes || null,
      post_to_inventory: !form.do_id ? form.post_to_inventory : false,
      warehouse_id: !form.do_id && form.post_to_inventory && form.warehouse_id ? Number(form.warehouse_id) : null,
      priceIncludesDiscount: form.priceIncludesDiscount,
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
    emit('saved', form.id)
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
  }
})
</script>
