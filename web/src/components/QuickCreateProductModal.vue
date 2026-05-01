<template>
  <div class="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 p-4" @click.self="$emit('close')">
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
        <div>
          <div class="flex items-center justify-between">
            <label class="block text-xs font-medium text-slate-600">Brand</label>
            <button
              v-if="!showNewBrand"
              type="button"
              class="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              @click="openNewBrand"
            >
              + New brand
            </button>
          </div>
          <select
            v-if="!showNewBrand"
            v-model="form.brandId"
            class="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select brand (optional)</option>
            <option v-for="b in brands" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
          </select>
          <div v-else class="mt-1 space-y-2 rounded border border-indigo-200 bg-indigo-50 p-2">
            <input
              v-model="newBrandName"
              placeholder="New brand name"
              class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              @keydown.enter.prevent="createBrand"
            />
            <p v-if="newBrandError" class="text-xs text-red-600">{{ newBrandError }}</p>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded border border-slate-300 px-3 py-1 text-xs"
                :disabled="creatingBrand"
                @click="cancelNewBrand"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                :disabled="creatingBrand"
                @click="createBrand"
              >
                {{ creatingBrand ? 'Saving...' : 'Create brand' }}
              </button>
            </div>
          </div>
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
import { onMounted, reactive, ref } from 'vue'
import api from '../services/api'

const emit = defineEmits(['close', 'created'])

const form = reactive({
  name: '',
  sku: '',
  productCode: '',
  description: '',
  unit: 'pcs',
  brandId: '',
})
const submitting = ref(false)
const errorMessage = ref('')
const brands = ref([])

const showNewBrand = ref(false)
const newBrandName = ref('')
const newBrandError = ref('')
const creatingBrand = ref(false)

async function loadBrands() {
  try {
    const { data } = await api.get('/brands', { params: { all: 'true', status: 'active' } })
    brands.value = data.items || []
  } catch {
    brands.value = []
  }
}

function openNewBrand() {
  newBrandName.value = ''
  newBrandError.value = ''
  showNewBrand.value = true
}

function cancelNewBrand() {
  showNewBrand.value = false
  newBrandName.value = ''
  newBrandError.value = ''
}

async function createBrand() {
  const name = newBrandName.value.trim()
  if (!name) {
    newBrandError.value = 'Brand name is required.'
    return
  }
  creatingBrand.value = true
  newBrandError.value = ''
  try {
    const { data } = await api.post('/brands', { name, isActive: true })
    const created = data?.brand || data
    if (!created || !created.id) {
      throw new Error('Unexpected response shape.')
    }
    await loadBrands()
    form.brandId = String(created.id)
    showNewBrand.value = false
    newBrandName.value = ''
  } catch (error) {
    newBrandError.value = error.response?.data?.message || error.message || 'Failed to create brand.'
  } finally {
    creatingBrand.value = false
  }
}

onMounted(() => {
  loadBrands()
})

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
      brandId: form.brandId ? Number(form.brandId) : null,
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
