<template>
  <div class="rounded border border-slate-200 bg-slate-50 p-3">
    <div class="mb-2 flex items-center justify-between">
      <h4 class="text-sm font-semibold text-slate-700">Attachments (PDF / JPG / PNG, max 25MB)</h4>
      <label class="cursor-pointer rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700">
        Upload
        <input type="file" class="hidden" accept=".pdf,image/jpeg,image/png,image/webp" @change="onSelect" />
      </label>
    </div>
    <p v-if="uploading" class="text-xs text-slate-500">Uploading...</p>
    <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
    <ul class="space-y-1">
      <li v-for="a in attachments" :key="a.id" class="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm">
        <div>
          <span class="font-medium text-slate-800">{{ a.original_name }}</span>
          <span class="ml-2 text-xs text-slate-500">{{ fmtSize(a.file_size) }}</span>
        </div>
        <div class="flex gap-2">
          <button class="text-indigo-600 hover:text-indigo-800" @click="download(a)">Download</button>
          <button class="text-red-500 hover:text-red-700" @click="remove(a)">Delete</button>
        </div>
      </li>
      <li v-if="attachments.length === 0" class="text-xs text-slate-400">No attachments uploaded yet.</li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../services/api'

const props = defineProps({
  parentId: { type: [Number, String], required: true },
  resource: { type: String, required: true }, // purchase-orders / supplier-invoices / supplier-returns
  attachments: { type: Array, default: () => [] },
})
const emit = defineEmits(['refresh'])

const uploading = ref(false)
const errorMessage = ref('')

function fmtSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / (1024 * 1024)).toFixed(2)}MB`
}

async function onSelect(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  uploading.value = true
  errorMessage.value = ''
  try {
    const form = new FormData()
    form.append('file', file)
    await api.post(`/${props.resource}/${props.parentId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    emit('refresh')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || 'Upload failed.'
  } finally {
    uploading.value = false
  }
}

async function download(a) {
  try {
    const response = await api.get(`/${props.resource}/${props.parentId}/attachments/${a.id}/download`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = a.original_name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Download failed.'
  }
}

async function remove(a) {
  if (!confirm(`Delete "${a.original_name}"?`)) return
  try {
    await api.delete(`/${props.resource}/${props.parentId}/attachments/${a.id}`)
    emit('refresh')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Delete failed.'
  }
}
</script>
