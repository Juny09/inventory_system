<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'
import { useToastStore } from '../stores/toast'

const router = useRouter()
const localeStore = useLocaleStore()
const toastStore = useToastStore()

const file = ref(null)
const fileInput = ref(null)
const loading = ref(false)
const preview = ref(null)
const errorMessage = ref('')

// AI 模型 + prompt
const ollamaModels = ref([])
const selectedModel = ref('')
const customPrompt = ref('')
const showPromptEditor = ref(false)

// Prompt 库
const savedPrompts = ref([])
const selectedPromptId = ref('')
const savePromptName = ref('')
const showSaveDialog = ref(false)

async function loadModels() {
  try {
    const { data } = await api.get('/documents/ollama/models')
    ollamaModels.value = data.models || []
  } catch (e) {
    console.log('Failed to load Ollama models:', e)
  }
}

async function loadDefaultPrompt() {
  try {
    const { data } = await api.get('/prompts/default/content')
    if (data.found && data.prompt?.content) {
      customPrompt.value = data.prompt.content
    }
  } catch (e) {
    console.log('Failed to load default prompt:', e)
  }
}

async function loadPrompts() {
  try {
    const { data } = await api.get('/prompts')
    savedPrompts.value = data.prompts || []
  } catch (e) {
    console.log('Failed to load prompts:', e)
  }
}

function selectPrompt(id) {
  selectedPromptId.value = id
  const p = savedPrompts.value.find((x) => String(x.id) === String(id))
  if (p) {
    customPrompt.value = p.content
  }
}

async function savePrompt() {
  const name = savePromptName.value.trim()
  if (!name) {
    errorMessage.value = localeStore.locale === 'en' ? 'Please enter a prompt name.' : '请输入 Prompt 名称。'
    return
  }
  if (!customPrompt.value.trim()) {
    errorMessage.value = localeStore.locale === 'en' ? 'Prompt content is empty.' : 'Prompt 内容为空。'
    return
  }
  loading.value = true
  try {
    await api.post('/prompts', {
      name,
      content: customPrompt.value,
      is_default: false,
    })
    await loadPrompts()
    showSaveDialog.value = false
    savePromptName.value = ''
    toastStore.pushToast({
      tone: 'success',
      message: localeStore.locale === 'en' ? 'Prompt saved.' : 'Prompt 已保存。',
    })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to save prompt.'
  } finally {
    loading.value = false
  }
}

async function deletePrompt(id) {
  if (!confirm(localeStore.locale === 'en' ? 'Delete this prompt?' : '删除此 Prompt？')) return
  try {
    await api.delete(`/prompts/${id}`)
    await loadPrompts()
    if (String(selectedPromptId.value) === String(id)) {
      selectedPromptId.value = ''
    }
  } catch (e) {
    console.log('Delete prompt failed:', e)
  }
}

async function setAsDefault(id) {
  try {
    await api.put(`/prompts/${id}`, { is_default: true })
    await loadPrompts()
    toastStore.pushToast({
      tone: 'success',
      message: localeStore.locale === 'en' ? 'Set as default.' : '已设为默认。',
    })
  } catch (e) {
    console.log('Set default failed:', e)
  }
}

loadModels()
loadDefaultPrompt()
loadPrompts()

const form = reactive({
  documentType: '',
  documentNumber: '',
  date: '',
  supplierId: '',
  warehouseId: '',
  notes: '',
  items: [],
})

function onFileChange(e) {
  file.value = e.target.files[0]
  preview.value = null
  errorMessage.value = ''
}

function formatDateLocal(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toISOString().split('T')[0]
}

async function uploadAndParse() {
  if (!file.value) {
    errorMessage.value = localeStore.locale === 'en' ? 'Please select a file.' : '请选择文件。'
    return
  }

  loading.value = true
  errorMessage.value = ''

  const formData = new FormData()
  formData.append('file', file.value)
  if (selectedModel.value) formData.append('model', selectedModel.value)
  if (customPrompt.value) formData.append('customPrompt', customPrompt.value)

  try {
    const { data } = await api.post('/documents/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    preview.value = data
    form.documentType = data.documentType || ''
    form.documentNumber = data.documentNumber || ''
    form.date = formatDateLocal(data.date) || ''
    form.supplierId = data.matchedSupplier?.id ? String(data.matchedSupplier.id) : ''
    form.warehouseId = data.defaultWarehouse?.id ? String(data.defaultWarehouse.id) : ''
    form.notes = ''

    // 初始化 items：每个提取行匹配第一个产品
    form.items = (data.items || []).map((it) => ({
      extractedQuantity: it.extractedQuantity,
      extractedDescription: it.extractedDescription,
      productId: it.matchedProducts?.[0]?.id ? String(it.matchedProducts[0].id) : '',
      quantity: it.extractedQuantity || 1,
      unitCost: 0,
      description: it.extractedDescription || '',
      matchedProducts: it.matchedProducts || [],
    }))

    if (form.items.length === 0) {
      toastStore.pushToast({
        tone: 'warning',
        message: localeStore.locale === 'en'
          ? 'No items found. Please check the document or enter manually.'
          : '未识别到产品列表，请检查文档或手动输入。',
      })
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to parse document.'
  } finally {
    loading.value = false
  }
}

async function confirmAndCreate() {
  if (!form.documentType || !form.documentNumber || !form.date || !form.supplierId) {
    errorMessage.value = localeStore.locale === 'en'
      ? 'Please fill in document type, number, date and supplier.'
      : '请填写文档类型、单号、日期和供应商。'
    return
  }

  loading.value = true

  const payload = {
    documentType: form.documentType,
    documentNumber: form.documentNumber,
    date: form.date,
    supplierId: Number(form.supplierId),
    warehouseId: form.warehouseId ? Number(form.warehouseId) : null,
    notes: form.notes || null,
    items: form.items
      .filter((it) => it.productId && Number(it.quantity) > 0)
      .map((it) => ({
        productId: Number(it.productId),
        quantity: Number(it.quantity),
        unitCost: Number(it.unitCost) || 0,
        description: it.description || '',
      })),
  }

  try {
    const { data } = await api.post('/documents/create', payload)
    toastStore.pushToast({
      tone: 'success',
      message: localeStore.locale === 'en' ? `Created: ${data.message}` : `已创建：${data.message}`,
    })
    // 跳转到对应页面
    if (data.type === 'delivery_order') {
      router.push('/delivery-orders')
    } else if (data.type === 'invoice') {
      router.push('/supplier-invoices')
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to create document.'
    loading.value = false
  }
}
</script>

<template>
  <AppLayout>
    <section class="p-6">
      <h1 class="text-xl font-bold text-slate-900">
        {{ localeStore.locale === 'en' ? 'Upload Document (DO / Invoice)' : '上传文档（送货单 / 发票）' }}
      </h1>
      <p class="mt-2 text-sm text-slate-500">
        {{ localeStore.locale === 'en'
          ? 'Upload a photo or PDF of a Delivery Order or Invoice to auto-extract details.'
          : '上传送货单或发票的照片或 PDF，自动提取信息。'
        }}
      </p>

      <div v-if="errorMessage" class="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ errorMessage }}
      </div>

      <!-- AI 设置 -->
      <div v-if="!preview" class="mt-6 space-y-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <label class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'AI Model' : 'AI 模型' }}</label>
          <select v-model="selectedModel" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
            <option value="">{{ localeStore.locale === 'en' ? 'Auto select (recommended)' : '自动选择（推荐）' }}</option>
            <option v-for="m in ollamaModels" :key="m" :value="m">{{ m }}</option>
          </select>
          <p class="mt-1 text-xs text-slate-400">{{ ollamaModels.length === 0 ? (localeStore.locale === 'en' ? 'Ollama not detected. Will use OCR fallback.' : '未检测到 Ollama，将使用 OCR 回退。') : '' }}</p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center justify-between">
            <button type="button" class="flex-1 text-left text-sm font-medium text-slate-700" @click="showPromptEditor = !showPromptEditor">
              {{ localeStore.locale === 'en' ? 'Extraction Prompt (click to edit)' : '提取 Prompt（点击编辑）' }}
              <span class="text-xs text-slate-400">{{ showPromptEditor ? '▲' : '▼' }}</span>
            </button>
            <div class="flex gap-2">
              <button type="button" class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white" @click="showSaveDialog = true">
                {{ localeStore.locale === 'en' ? 'Save' : '保存' }}
              </button>
              <button type="button" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700" @click="loadDefaultPrompt">
                {{ localeStore.locale === 'en' ? 'Default' : '默认' }}
              </button>
            </div>
          </div>

          <div v-if="savedPrompts.length > 0" class="mt-3">
            <label class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Saved Prompts' : '已保存的 Prompt' }}</label>
            <div class="mt-1 flex flex-wrap gap-2">
              <button
                v-for="p in savedPrompts"
                :key="p.id"
                type="button"
                class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
                :class="selectedPromptId == p.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'"
                @click="selectPrompt(p.id)"
              >
                {{ p.name }}
                <span v-if="p.is_default" class="rounded bg-emerald-100 px-1 text-[10px] text-emerald-700">默认</span>
                <span v-if="selectedPromptId == p.id" class="ml-1 text-slate-400 hover:text-rose-600" @click.stop="deletePrompt(p.id)">×</span>
              </button>
            </div>
          </div>

          <div v-if="showPromptEditor" class="mt-3">
            <textarea v-model="customPrompt" rows="12" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700 outline-none focus:border-brand-500"></textarea>
            <p class="mt-2 text-xs text-slate-400">
              {{ localeStore.locale === 'en'
                ? 'Tip: Tell the AI exactly what fields you want, how to name them (e.g. DO_No, Company_Name), and the output JSON structure. Only modify if the default results are not accurate.'
                : '提示：告诉 AI 你需要提取哪些字段、字段名如何命名（如 DO_No、Company_Name），以及输出 JSON 结构。仅在默认结果不准确时修改。'
              }}
            </p>
          </div>
        </div>
      </div>

      <!-- 上传区域 -->
      <div v-if="!preview" class="mt-4">
        <label class="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 hover:bg-slate-100">
          <input ref="fileInput" type="file" accept=".pdf,image/*" class="hidden" @change="onFileChange" />
          <svg class="mb-3 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p class="text-sm font-medium text-slate-700">
            {{ file ? file.name : (localeStore.locale === 'en' ? 'Click to select PDF or photo' : '点击选择 PDF 或照片') }}
          </p>
          <p class="mt-1 text-xs text-slate-400">
            {{ localeStore.locale === 'en' ? 'Supported: PDF, JPG, PNG, WebP (max 10MB)' : '支持：PDF、JPG、PNG、WebP（最大 10MB）' }}
          </p>
        </label>
        <button
          v-if="file"
          class="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="loading"
          @click="uploadAndParse"
        >
          {{ loading ? (localeStore.locale === 'en' ? 'Parsing...' : '解析中...') : (localeStore.locale === 'en' ? 'Parse Document' : '解析文档') }}
        </button>
      </div>

      <!-- 预览/确认区域 -->
      <div v-if="preview" class="mt-6 space-y-4">
        <div class="rounded-3xl border border-slate-200 bg-white p-5">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-slate-900">
              {{ localeStore.locale === 'en' ? 'Extracted Info' : '提取信息' }}
            </h2>
            <button class="text-sm text-brand-600" @click="preview = null; file = null; fileInput && (fileInput.value = '')">
              {{ localeStore.locale === 'en' ? 'Upload another' : '上传另一个' }}
            </button>
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Document Type' : '文档类型' }}</label>
              <select v-model="form.documentType" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select' : '选择' }}</option>
                <option value="delivery_order">Delivery Order</option>
                <option value="invoice">Invoice</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Document No.' : '单号' }}</label>
              <input v-model="form.documentNumber" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
            </div>
            <div>
              <label class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Date' : '日期' }}</label>
              <input v-model="form.date" type="date" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
            </div>
            <div>
              <label class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Supplier' : '供应商' }}</label>
              <input v-if="preview.matchedSupplier" v-model="form.supplierId" type="hidden" />
              <p v-if="preview.matchedSupplier" class="mt-1 text-sm text-slate-700">
                {{ preview.matchedSupplier.name }}
                <span class="text-xs text-emerald-600">(matched)</span>
              </p>
              <p v-else class="mt-1 text-sm text-rose-600">
                {{ localeStore.locale === 'en' ? 'No supplier matched. Please create supplier first.' : '未匹配到供应商，请先创建供应商。' }}
              </p>
            </div>
            <div>
              <label class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Warehouse' : '仓库' }}</label>
              <select v-model="form.warehouseId" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500">
                <option value="">{{ localeStore.locale === 'en' ? 'Select warehouse' : '选择仓库' }}</option>
                <option v-if="preview.defaultWarehouse" :value="String(preview.defaultWarehouse.id)">
                  {{ preview.defaultWarehouse.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Notes' : '备注' }}</label>
              <input v-model="form.notes" type="text" class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
            </div>
          </div>
        </div>

        <!-- Items -->
        <div class="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 class="font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Items' : '产品明细' }}
          </h3>
          <p v-if="form.items.length === 0" class="mt-2 text-sm text-slate-400">
            {{ localeStore.locale === 'en' ? 'No items extracted.' : '未识别到产品。' }}
          </p>
          <div v-else class="mt-3 space-y-3">
            <div v-for="(item, index) in form.items" :key="index" class="rounded-2xl border border-slate-200 p-3">
              <div class="flex items-center gap-3">
                <span class="text-xs font-semibold text-slate-400">#{{ index + 1 }}</span>
                <div class="flex-1">
                  <p class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Extracted' : '识别到' }}: {{ item.extractedDescription }}</p>
                  <p class="text-xs text-slate-500">{{ localeStore.locale === 'en' ? 'Qty' : '数量' }}: {{ item.extractedQuantity }}</p>
                </div>
              </div>
              <div class="mt-2 grid gap-2 sm:grid-cols-3">
                <select v-model="item.productId" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                  <option value="">{{ localeStore.locale === 'en' ? 'Match product' : '匹配产品' }}</option>
                  <option v-for="p in item.matchedProducts" :key="p.id" :value="String(p.id)">
                    {{ p.sku }} - {{ p.name }}
                  </option>
                </select>
                <input v-model="item.quantity" type="number" min="1" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Quantity' : '数量'" />
                <input v-if="form.documentType === 'invoice'" v-model="item.unitCost" type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" :placeholder="localeStore.locale === 'en' ? 'Unit cost' : '单价'" />
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-3">
          <button
            class="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            :disabled="loading"
            @click="confirmAndCreate"
          >
            {{ loading ? (localeStore.locale === 'en' ? 'Creating...' : '创建中...') : (localeStore.locale === 'en' ? 'Confirm & Create' : '确认并创建') }}
          </button>
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            @click="preview = null; file = null; fileInput && (fileInput.value = '')"
          >
            {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
          </button>
        </div>
      </div>

      <!-- 保存 Prompt 弹窗 -->
      <div v-if="showSaveDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
          <h3 class="text-base font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Save Prompt' : '保存 Prompt' }}
          </h3>
          <p class="mt-1 text-xs text-slate-500">
            {{ localeStore.locale === 'en' ? 'Give it a name so you can reuse it later.' : '给 Prompt 起个名字，方便以后复用。' }}
          </p>
          <input
            v-model="savePromptName"
            type="text"
            :placeholder="localeStore.locale === 'en' ? 'e.g. TECOLINE DO Extractor' : '例如：TECOLINE 送货单提取器'"
            class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
          />
          <div class="mt-4 flex gap-3">
            <button
              class="flex-1 rounded-2xl bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="loading"
              @click="savePrompt"
            >
              {{ loading ? '...' : (localeStore.locale === 'en' ? 'Save' : '保存') }}
            </button>
            <button
              class="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
              @click="showSaveDialog = false"
            >
              {{ localeStore.locale === 'en' ? 'Cancel' : '取消' }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
