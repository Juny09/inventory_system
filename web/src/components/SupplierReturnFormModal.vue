<template>
  <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-2" @click.self="$emit('close')">
    <div class="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <div class="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 class="text-lg font-semibold text-slate-800">
          {{ form.id ? `${form.doc_type} #${form.document_no}` : 'New Return / Claim / Repair' }}
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
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">Type <span class="text-red-500">*</span></label>
            <select v-model="form.doc_type" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="RETURN">Return</option>
              <option value="CLAIM">Claim</option>
              <option value="REPAIR">Repair</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">Date <span class="text-red-500">*</span></label>
            <input v-model="form.document_date" required type="date" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600">Document No <span class="text-red-500">*</span></label>
            <input v-model="form.document_no" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
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
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in form.items" :key="idx" class="border-t border-slate-200 align-top">
                  <td class="w-64 px-2 py-2">
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
                  <td class="w-24 px-2 py-2"><input v-model.number="row.quantity" type="number" step="0.001" class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm" /></td>
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
          resource="supplier-returns"
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
import { reactive, ref, onMounted } from 'vue'
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
  doc_type: 'RETURN',
  document_no: '',
  document_date: new Date().toLocaleDateString('en-CA'),
  notes: '',
  items: [],
})
const attachments = ref([])
const attachmentRef = ref(null)
const submitting = ref(false)
const errorMessage = ref('')

function blankRow() {
  return { product_id: null, product_label: '', item_code: '', description: '', serial_no: '', quantity: 1 }
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

async function reloadAttachments() {
  if (!form.id) return
  try {
    const { data } = await api.get(`/supplier-returns/${form.id}`)
    attachments.value = data.attachments || []
  } catch (error) {
    // ignore
  }
}

async function loadExisting(id) {
  const { data } = await api.get(`/supplier-returns/${id}`)
  form.id = data.id
  form.supplier_id = data.supplier_id
  form.doc_type = data.doc_type
  form.document_no = data.document_no
  form.document_date = data.document_date ? new Date(data.document_date).toLocaleDateString('en-CA') : ''
  form.notes = data.notes || ''
  form.items = (data.items || []).map((it) => ({
    product_id: it.product_id,
    product_label: it.product_id ? `${it.product_product_code || ''} · ${it.product_name || ''}` : '',
    item_code: it.item_code || '',
    description: it.description || '',
    serial_no: it.serial_no || '',
    quantity: Number(it.quantity) || 0,
  }))
  attachments.value = data.attachments || []
}

async function submit() {
  submitting.value = true
  errorMessage.value = ''
  try {
    const payload = {
      supplier_id: Number(form.supplier_id),
      doc_type: form.doc_type,
      document_no: form.document_no.trim(),
      document_date: form.document_date,
      notes: form.notes || null,
      items: form.items.map((it) => ({
        product_id: it.product_id || null,
        item_code: it.item_code || null,
        description: it.description || null,
        serial_no: it.serial_no || null,
        quantity: Number(it.quantity) || 0,
      })),
    }
    if (form.id) {
      await api.put(`/supplier-returns/${form.id}`, payload)
    } else {
      const { data } = await api.post('/supplier-returns', payload)
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
  if (props.id) {
    loadExisting(props.id)
  } else {
    form.items = [blankRow()]
  }
})
</script>
