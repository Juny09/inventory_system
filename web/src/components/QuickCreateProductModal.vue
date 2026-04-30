<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" @click.self="$emit('close')">
    <div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-800">Quick Create Product</h3>
        <button class="text-slate-400 hover:text-slate-600" @click="$emit('close')">×</button>
      </div>

      <p class="mb-3 text-xs text-slate-500">
        Cost / selling price / category / stock can be refined later on the Products page.
      </p>

      <form class="space-y-3" @submit.prevent="submit">
        <div>
          <label class="block text-xs font-medium text-slate-600">Name <span class="text-red-500">*</span></label>
          <input v-model="form.name" required class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600">SKU <span class="text-red-500">*</span></label>
          <input v-model="form.sku" required placeholder="e.g. SKU-0001" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600">Product Code</label>
          <input v-model="form.productCode" placeholder="Leave blank to auto-generate" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600">Description</label>
          <textarea v-model="form.description" rows="2" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"></textarea>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600">Unit</label>
          <input v-model="form.unit" class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm" @click="$emit('close')">Cancel</button>
          <button
            type="submit"
            :disabled="submitting"
            class="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {{ submitting ? 'Saving...' : 'Create & Select' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import api from '../services/api'

const emit = defineEmits(['close', 'created'])

const form = reactive({
  name: '',
  sku: '',
  productCode: '',
  description: '',
  unit: 'pcs',
})
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  submitting.value = true
  errorMessage.value = ''
  try {
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      productCode: form.productCode.trim() || undefined,
      description: form.description.trim() || undefined,
      unit: form.unit.trim() || 'pcs',
      costPrice: 0,
      sellingPrice: 0,
      markupPercentage: 0,
      suggestedPrice: 0,
      reorderLevel: 0,
      isActive: true,
    }
    const { data } = await api.post('/products', payload)
    // /products POST 返回 { product: {...} } 或直接产品对象；兼容两种
    const product = data?.product || data
    if (!product || !product.id) {
      throw new Error('Unexpected response shape.')
    }
    emit('created', product)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to create product.'
  } finally {
    submitting.value = false
  }
}
</script>
