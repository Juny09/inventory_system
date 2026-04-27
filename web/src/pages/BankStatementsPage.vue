<script setup>
import { computed, onMounted, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import HelpHint from '../components/HelpHint.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'
import { useToastStore } from '../stores/toast'

const localeStore = useLocaleStore()
const toastStore = useToastStore()

const month = ref('')
const file = ref(null)
const fileInputRef = ref(null)
const errorMessage = ref('')
const loading = ref(false)
const uploading = ref(false)
const fileName = computed(() => file.value?.name || '')

const items = ref([])
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})

function formatMonth(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatSize(bytes) {
  const n = Number(bytes || 0)
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

async function loadStatements(page = pagination.value.page) {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get('/bank-statements', { params: { page, pageSize: pagination.value.pageSize } })
    items.value = data.items || []
    pagination.value = data.pagination || pagination.value
  } catch (error) {
    errorMessage.value = error.response?.data?.message || localeStore.t('bankStatements.loadFailed')
  } finally {
    loading.value = false
  }
}

function handleFileChange(event) {
  const picked = event.target.files?.[0]
  file.value = picked || null
}

function openFilePicker() {
  fileInputRef.value?.click()
}

async function uploadStatement() {
  errorMessage.value = ''
  if (!month.value) {
    errorMessage.value = localeStore.t('bankStatements.selectMonth')
    return
  }
  if (!file.value) {
    errorMessage.value = localeStore.t('bankStatements.selectFile')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('month', month.value)
    formData.append('file', file.value)
    await api.post('/bank-statements', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    toastStore.pushToast({ tone: 'success', message: localeStore.t('bankStatements.uploaded') })
    file.value = null
    month.value = ''
    await loadStatements(1)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || localeStore.t('bankStatements.uploadFailed')
  } finally {
    uploading.value = false
  }
}

async function downloadStatement(id, originalName) {
  try {
    const response = await api.get(`/bank-statements/${id}/download`, { responseType: 'blob' })
    const blobUrl = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = originalName || `bank-statement-${id}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (error) {
    toastStore.pushToast({ tone: 'error', message: error.response?.data?.message || localeStore.t('bankStatements.downloadFailed') })
  }
}

async function deleteStatement(id) {
  try {
    await api.delete(`/bank-statements/${id}`)
    toastStore.pushToast({ tone: 'success', message: localeStore.t('bankStatements.deleted') })
    await loadStatements(pagination.value.page)
  } catch (error) {
    toastStore.pushToast({ tone: 'error', message: error.response?.data?.message || localeStore.t('bankStatements.deleteFailed') })
  }
}

onMounted(async () => {
  await loadStatements(1)
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">{{ localeStore.locale === 'en' ? 'Analytics' : '分析' }}</p>
          <h2 class="mt-2 flex items-center gap-2 text-3xl font-semibold text-slate-900">
            {{ localeStore.t('bankStatements.title') }}
            <HelpHint :text="localeStore.t('bankStatements.subtitle')" />
          </h2>
          <p class="mt-2 text-sm text-slate-500">{{ localeStore.t('bankStatements.subtitle') }}</p>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 grid gap-6 2xl:grid-cols-[380px_1fr]">
        <form class="rounded-3xl border border-slate-200 bg-slate-50 p-5" @submit.prevent="uploadStatement">
          <h3 class="text-xl font-semibold text-slate-900">
            {{ localeStore.t('bankStatements.uploadTitle') }}
          </h3>
          <p class="mt-2 text-sm text-slate-500">{{ localeStore.t('bankStatements.uploadHint') }}</p>
          <div class="mt-5 space-y-4">
            <div class="relative">
              <input v-model="month" type="month" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 bg-white px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
              <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
                {{ localeStore.t('bankStatements.month') }}
              </label>
            </div>
            <div class="relative">
              <input
                :value="fileName"
                type="text"
                readonly
                placeholder=" "
                class="peer w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 pb-2 pt-5 text-sm outline-none focus:border-brand-500"
                @click="openFilePicker"
              />
              <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
                {{ localeStore.t('bankStatements.file') }}
              </label>
              <input
                ref="fileInputRef"
                type="file"
                accept="application/pdf,image/*,.xls,.xlsx"
                class="hidden"
                @change="handleFileChange"
              />
            </div>
            <button
              type="submit"
              class="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="uploading"
            >
              {{ uploading ? localeStore.t('common.loading') : localeStore.t('common.upload') }}
            </button>
          </div>
        </form>

        <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h3 class="text-xl font-semibold text-slate-900">{{ localeStore.t('bankStatements.historyTitle') }}</h3>
            <button
              type="button"
              class="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              :disabled="loading"
              @click="loadStatements(1)"
            >
              {{ loading ? localeStore.t('common.loading') : localeStore.t('common.refresh') }}
            </button>
          </div>

          <div v-if="loading" class="px-5 py-4 text-sm text-slate-500">{{ localeStore.t('common.loading') }}</div>

          <div class="hidden overflow-x-auto md:block">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-slate-500">
                <tr>
                  <th class="px-4 py-4">{{ localeStore.t('bankStatements.month') }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('bankStatements.file') }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('bankStatements.size') }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('bankStatements.uploadedAt') }}</th>
                  <th class="px-4 py-4">{{ localeStore.t('table.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in items" :key="row.id" class="border-t border-slate-100">
                  <td class="px-4 py-4 font-medium text-slate-900">{{ formatMonth(row.statement_month) }}</td>
                  <td class="px-4 py-4 text-slate-700">{{ row.original_name }}</td>
                  <td class="px-4 py-4 text-slate-500">{{ formatSize(row.file_size) }}</td>
                  <td class="px-4 py-4 text-slate-500">{{ new Date(row.created_at).toLocaleString() }}</td>
                  <td class="px-4 py-4">
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                        @click="downloadStatement(row.id, row.original_name)"
                      >
                        {{ localeStore.t('common.download') }}
                      </button>
                      <button
                        type="button"
                        class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                        @click="deleteStatement(row.id)"
                      >
                        {{ localeStore.t('common.delete') }}
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!loading && items.length === 0">
                  <td class="px-4 py-6 text-sm text-slate-500" colspan="5">
                    {{ localeStore.t('bankStatements.empty') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="grid gap-3 p-4 md:hidden">
            <article v-for="row in items" :key="row.id" class="rounded-3xl border border-slate-200 p-4">
              <p class="font-medium text-slate-900">{{ formatMonth(row.statement_month) }}</p>
              <p class="mt-1 text-sm text-slate-700">{{ row.original_name }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatSize(row.file_size) }} · {{ new Date(row.created_at).toLocaleString() }}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                  @click="downloadStatement(row.id, row.original_name)"
                >
                  {{ localeStore.t('common.download') }}
                </button>
                <button
                  type="button"
                  class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                  @click="deleteStatement(row.id)"
                >
                  {{ localeStore.t('common.delete') }}
                </button>
              </div>
            </article>
          </div>

          <PaginationBar :pagination="pagination" @change="loadStatements" />
        </div>
      </div>
    </section>
  </AppLayout>
</template>
