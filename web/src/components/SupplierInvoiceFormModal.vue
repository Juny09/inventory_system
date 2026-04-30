<template>
  <div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4" @click.self="$emit('close')">
    <div class="my-8 w-full max-w-6xl rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 class="text-lg font-semibold text-slate-800">
          {{ form.id ? `Invoice #${form.invoice_no}` : 'New Supplier Invoice' }}
        </h3>
        <button class="text-slate-400 hover:text-slate-600" @click="$emit('close')">×</button>
      </div>

      <form class="space-y-4 px-5 py-4" @submit.prevent="submit">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label class="block text-xs font-medium text-slate-600">Supplier Company <span class="text-red-500">*</span></label>
            <select v-model="form.supplier_id" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" @change="onSupplierChange">
              <option value="">-- Select --</option>
              <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.company_name || s.name }}</option>
            </select>
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
            <label class="block text-xs font-medium text-slate-600">Refer to PO <span class="text-red-500">*</span></label>
            <select v-model="form.po_id" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" @change="onPoChange">
              <option value="">-- Select PO --</option>
              <option v-for="po in poOptions" :key="po.id" :value="po.id">{{ po.po_no }} ({{ formatDate(po.po_date) }})</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600">Notes</label>
          <textarea v-model="form.notes" rows="2" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"></textarea>
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
                  <td class="w-20 px-2 py-2"><input v-model.number="row.discount" type="number" step="0.01" class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm" /></td>
                  <td class="w-24 px-2 py-2 text-right text-sm font-medium">{{ rowAmount(row).toFixed(2) }}</td>
                  <td class="px-2 py-2 text-right">
                    <button type="button" class="text-red-500 hover:text-red-700" @click="form.items.splice(idx, 1)">×</button>
                  </td>
                </tr>
                <tr v-if="form.items.length === 0">
                  <td colspan="9" class="px-2 py-4 text-center text-sm text-slate-400">Select a PO above to import items, or click "Add row".</td>
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
          v-if="form.id"
          :parent-id="form.id"
          resource="supplier-invoices"
          :attachments="attachments"
          @refresh="reloadAttachments"
        />
        <p v-else class="text-xs text-slate-500">Attachments can be uploaded after saving.</p>

        <p v-if="errorMessage" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage }}</p>

        <div class="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm" @click="$emit('close')">Cancel</button>
          <button type="submit" :disabled="submitting" class="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {{ submitting ? 'Saving...' : 'Save' }}
          </button>
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

const props = defineProps({
  id: { type: [Number, String, null], default: null },
  suppliers: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'saved'])

const form = reactive({
  id: null,
  supplier_id: '',
  po_id: '',
  invoice_no: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  notes: '',
  items: [],
})
const poOptions = ref([])
const attachments = ref([])
const submitting = ref(false)
const errorMessage = ref('')

function blankRow() {
  return { product_id: null, product_label: '', item_code: '', description: '', serial_no: '', quantity: 1, unit_price: 0, discount: 0 }
}

function rowAmount(row) {
  const raw = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0) - (Number(row.discount) || 0)
  return Number.isFinite(raw) ? Math.max(0, raw) : 0
}

const totalQty = computed(() => form.items.reduce((s, r) => s + (Number(r.quantity) || 0), 0))
const totalAmount = computed(() => form.items.reduce((s, r) => s + rowAmount(r), 0))

function formatDate(d) {
  return String(d || '').slice(0, 10)
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

async function loadPOsForSupplier(supplierId) {
  if (!supplierId) {
    poOptions.value = []
    return
  }
  try {
    const { data } = await api.get('/purchase-orders', {
      params: { supplierId, page: 1, pageSize: 200 },
    })
    poOptions.value = data.items || []
  } catch (error) {
    poOptions.value = []
  }
}

async function onSupplierChange() {
  form.po_id = ''
  form.items = []
  await loadPOsForSupplier(form.supplier_id)
}

async function onPoChange() {
  if (!form.po_id) return
  try {
    const { data } = await api.get(`/purchase-orders/${form.po_id}`)
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
  } catch (error) {
    errorMessage.value = 'Failed to load PO items.'
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
  form.po_id = data.po_id
  form.invoice_no = data.invoice_no
  form.invoice_date = String(data.invoice_date).slice(0, 10)
  form.notes = data.notes || ''
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
  attachments.value = data.attachments || []
  await loadPOsForSupplier(data.supplier_id)
}

async function submit() {
  submitting.value = true
  errorMessage.value = ''
  try {
    const payload = {
      supplier_id: Number(form.supplier_id),
      po_id: Number(form.po_id),
      invoice_no: form.invoice_no.trim(),
      invoice_date: form.invoice_date,
      notes: form.notes || null,
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
    emit('saved', form.id)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to save.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (props.id) {
    loadExisting(props.id)
  }
})
</script>
