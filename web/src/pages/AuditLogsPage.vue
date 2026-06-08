<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { exportToCsv, exportToJson, exportToPdf } from '../utils/export'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'

const authStore = useAuthStore()
const localeStore = useLocaleStore()
const logs = ref([])
const errorMessage = ref('')
const loading = ref(false)
const exportLoading = ref('')
const presetName = ref('')
const selectedPresetName = ref('')
const filterPresets = ref([])
const filters = reactive({
  search: '',
  action: 'all',
  entityType: 'all',
  startDate: '',
  endDate: '',
})
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
})
const expandedIds = ref([])
const rawExpandedIds = ref([])

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

const actionOptions = [
  'all',
  'LOGIN',
  'STOCK_COUNT_CREATE',
  'STOCK_COUNT_SAVE',
  'STOCK_COUNT_COMPLETE',
  'STOCK_COUNT_APPLY',
  'ALERT_UPDATE',
  'ALERT_BULK_UPDATE',
  'DELIVERY_ORDER_CREATE',
  'DELIVERY_ORDER_UPDATE',
  'SUPPLIER_INVOICE_CREATE',
  'SUPPLIER_INVOICE_UPDATE',
]
const entityTypeOptions = [
  'all',
  'AUTH',
  'USERS',
  'CATEGORIES',
  'WAREHOUSES',
  'PRODUCTS',
  'INVENTORY',
  'STOCK_COUNT',
  'ALERT',
  'DELIVERY_ORDER',
  'SUPPLIER_INVOICE',
]
const auditColumns = [
  { key: 'created_at', label: tr('Time', '时间') },
  { key: 'user_email', label: tr('User', '用户') },
  { key: 'user_role', label: tr('Role', '角色') },
  { key: 'action', label: tr('Action', '动作') },
  { key: 'entity_type', label: tr('Entity', '实体') },
  { key: 'path', label: tr('Path', '路径') },
  { key: 'description', label: tr('Description', '说明') },
]

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString()
}

// 中文注释：把审计 metadata 里的 OCR 人工确认记录提取出来，页面就能直接渲染可读卡片而不是只看原始 JSON。
function getConfirmationSummary(log) {
  return log?.metadata?.lowConfidenceConfirmations || null
}

function hasConfirmationSummary(log) {
  return Boolean(getConfirmationSummary(log))
}

function getDocumentTypeLabel(documentType) {
  if (documentType === 'delivery_order') return tr('Delivery Order', '送货单')
  if (documentType === 'supplier_invoice') return tr('Supplier Invoice', '供应商发票')
  return documentType || '-'
}

function getConfidenceBadgeClass(level) {
  if (level === 'high') return 'bg-emerald-100 text-emerald-800'
  if (level === 'medium') return 'bg-amber-100 text-amber-800'
  return 'bg-rose-100 text-rose-800'
}

function getConfidenceLabel(item) {
  const level = item?.ocrConfidenceLevel || 'low'
  const percent = Number(item?.ocrConfidencePercent) || 0
  const prefix = level === 'high' ? tr('High', '高') : level === 'medium' ? tr('Medium', '中') : tr('Low', '低')
  return `${prefix} ${percent}%`
}

function toggleRawExpanded(id) {
  if (rawExpandedIds.value.includes(id)) {
    rawExpandedIds.value = rawExpandedIds.value.filter((item) => item !== id)
    return
  }

  rawExpandedIds.value = [...rawExpandedIds.value, id]
}

const confirmationLogs = computed(() => logs.value.filter((log) => hasConfirmationSummary(log)))
const confirmationStats = computed(() => {
  const totalLogs = confirmationLogs.value.length
  const totalItems = confirmationLogs.value.reduce((sum, log) => {
    const items = getConfirmationSummary(log)?.items || []
    return sum + items.length
  }, 0)
  const latestTime = confirmationLogs.value[0]?.created_at || ''

  return {
    totalLogs,
    totalItems,
    latestTime,
  }
})

function getPresetStorageKey() {
  return `inventory_audit_presets_${authStore.user?.id || 'guest'}`
}

async function loadLogs(page = pagination.value.page) {
  loading.value = true

  try {
    const { data } = await api.get('/audit-logs', {
      params: {
        ...getParams(),
        page,
        pageSize: pagination.value.pageSize,
      },
    })

    logs.value = data.items
    pagination.value = data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load audit logs.'
  } finally {
    loading.value = false
  }
}

function getParams(extra = {}) {
  return {
    search: filters.search || undefined,
    action: filters.action,
    entityType: filters.entityType,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    ...extra,
  }
}

function loadFilterPresets() {
  const rawValue = localStorage.getItem(getPresetStorageKey())

  if (!rawValue) {
    filterPresets.value = []
    return
  }

  try {
    filterPresets.value = JSON.parse(rawValue)
  } catch {
    filterPresets.value = []
    localStorage.removeItem(getPresetStorageKey())
  }
}

function persistFilterPresets() {
  localStorage.setItem(getPresetStorageKey(), JSON.stringify(filterPresets.value))
}

async function fetchAllLogs() {
  const { data } = await api.get('/audit-logs', {
    params: getParams({ all: true }),
  })

  return data.items.map((item) => ({
    ...item,
    created_at: new Date(item.created_at).toLocaleString(),
  }))
}

async function exportAuditCsv() {
  exportLoading.value = 'csv'

  try {
    const rows = await fetchAllLogs()
    exportToCsv('audit-logs.csv', auditColumns, rows)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to export audit logs.'
  } finally {
    exportLoading.value = ''
  }
}

async function exportAuditPdf() {
  exportLoading.value = 'pdf'

  try {
    const rows = await fetchAllLogs()
    await exportToPdf('Audit Logs', 'audit-logs.pdf', auditColumns, rows)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to export audit logs.'
  } finally {
    exportLoading.value = ''
  }
}

async function exportAuditJson() {
  exportLoading.value = 'json'

  try {
    const rows = await fetchAllLogs()
    exportToJson('audit-logs.json', rows)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to export audit logs.'
  } finally {
    exportLoading.value = ''
  }
}

function toggleExpanded(id) {
  if (expandedIds.value.includes(id)) {
    expandedIds.value = expandedIds.value.filter((item) => item !== id)
    return
  }

  expandedIds.value = [...expandedIds.value, id]
}

function handleFilter() {
  loadLogs(1)
}

function saveCurrentPreset() {
  const trimmedName = presetName.value.trim()

  if (!trimmedName) {
    return
  }

  filterPresets.value = [
    ...filterPresets.value.filter((preset) => preset.name !== trimmedName),
    {
      name: trimmedName,
      isDefault: filterPresets.value.find((preset) => preset.name === trimmedName)?.isDefault || false,
      filters: {
        ...filters,
      },
    },
  ]
  selectedPresetName.value = trimmedName
  presetName.value = ''
  persistFilterPresets()
}

function applyPreset(name) {
  const preset = filterPresets.value.find((item) => item.name === name)

  if (!preset) {
    return
  }

  Object.assign(filters, preset.filters)
  selectedPresetName.value = name
  loadLogs(1)
}

function renameSelectedPreset() {
  const trimmedName = presetName.value.trim()

  if (!selectedPresetName.value || !trimmedName) {
    return
  }

  filterPresets.value = filterPresets.value.map((preset) => {
    if (preset.name !== selectedPresetName.value) {
      return preset
    }

    return {
      ...preset,
      name: trimmedName,
    }
  })

  selectedPresetName.value = trimmedName
  presetName.value = ''
  persistFilterPresets()
}

function setDefaultPreset(name) {
  filterPresets.value = filterPresets.value.map((preset) => ({
    ...preset,
    isDefault: preset.name === name,
  }))
  selectedPresetName.value = name
  persistFilterPresets()
}

function deletePreset(name) {
  filterPresets.value = filterPresets.value.filter((preset) => preset.name !== name)

  if (selectedPresetName.value === name) {
    selectedPresetName.value = ''
  }

  persistFilterPresets()
}

function resetFilters() {
  Object.assign(filters, {
    search: '',
    action: 'all',
    entityType: 'all',
    startDate: '',
    endDate: '',
  })
  loadLogs(1)
}

onMounted(() => {
  loadFilterPresets()
  const defaultPreset = filterPresets.value.find((preset) => preset.isDefault)

  if (defaultPreset) {
    applyPreset(defaultPreset.name)
    return
  }

  loadLogs()
})
</script>

<template>
  <AppLayout>
    <section>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Audit</p>
      <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Operation audit logs', '操作审计日志') }}</h2>
      <p class="mt-3 max-w-3xl text-sm text-slate-500">{{ tr('Review who did what and when for traceability.', '查看谁在什么时间执行了什么操作，方便追溯和排查。') }}</p>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 rounded-3xl border border-slate-200 p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm text-slate-500">{{ tr('Supports metadata expansion and full filtered export.', '支持展开查看 metadata 明细，也可导出全部筛选结果。') }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-2xl border border-slate-300 px-4 py-2 text-sm"
              @click="exportAuditCsv"
            >
              {{ exportLoading === 'csv' ? tr('Exporting...', '导出中...') : tr('Export All CSV', '导出全部 CSV') }}
            </button>
            <button
              type="button"
              class="rounded-2xl border border-slate-300 px-4 py-2 text-sm"
              @click="exportAuditJson"
            >
              {{ exportLoading === 'json' ? tr('Exporting...', '导出中...') : tr('Export All JSON', '导出全部 JSON') }}
            </button>
            <button
              type="button"
              class="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
              @click="exportAuditPdf"
            >
              {{ exportLoading === 'pdf' ? tr('Exporting...', '导出中...') : tr('Export All PDF', '导出全部 PDF') }}
            </button>
          </div>
        </div>

        <div class="mb-4 grid gap-3 md:grid-cols-3">
          <div class="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-indigo-500">{{ tr('OCR confirmation logs', 'OCR 确认日志') }}</p>
            <p class="mt-2 text-2xl font-semibold text-indigo-900">{{ confirmationStats.totalLogs }}</p>
            <p class="mt-1 text-sm text-indigo-700">{{ tr('Current filtered results containing OCR manual confirmation traces.', '当前筛选结果中包含 OCR 人工确认痕迹的日志数。') }}</p>
          </div>
          <div class="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-rose-500">{{ tr('Confirmed items', '已确认条目') }}</p>
            <p class="mt-2 text-2xl font-semibold text-rose-900">{{ confirmationStats.totalItems }}</p>
            <p class="mt-1 text-sm text-rose-700">{{ tr('Low-confidence OCR items that were manually reviewed.', '已人工复核过的低置信度 OCR Item 总数。') }}</p>
          </div>
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p class="text-xs font-medium uppercase tracking-wide text-emerald-500">{{ tr('Latest confirmation', '最近确认时间') }}</p>
            <p class="mt-2 text-lg font-semibold text-emerald-900">{{ formatDateTime(confirmationStats.latestTime) }}</p>
            <p class="mt-1 text-sm text-emerald-700">{{ tr('Shows the latest audit time in the current filtered results.', '显示当前筛选结果里最近一次审计记录时间。') }}</p>
          </div>
        </div>

        <div class="mb-4 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[1fr_220px_160px_160px]">
          <input
            v-model="presetName"
            type="text"
            :placeholder="tr('Save current filters as preset', '保存当前筛选为预设')"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
          />
          <select
            v-model="selectedPresetName"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @change="applyPreset(selectedPresetName)"
          >
            <option value="">{{ tr('Select filter preset', '选择筛选预设') }}</option>
            <option v-for="preset in filterPresets" :key="preset.name" :value="preset.name">
              {{ preset.name }}
            </option>
          </select>
          <button
            type="button"
            class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            @click="saveCurrentPreset"
          >
            {{ tr('Save preset', '保存预设') }}
          </button>
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            :disabled="!selectedPresetName"
            @click="renameSelectedPreset"
          >
            {{ tr('Rename selected', '重命名所选') }}
          </button>
        </div>

        <div v-if="filterPresets.length > 0" class="mb-4 flex flex-wrap gap-2">
          <div
            v-for="preset in filterPresets"
            :key="preset.name"
            class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <button type="button" class="font-medium text-slate-900" @click="applyPreset(preset.name)">
              {{ preset.name }}{{ preset.isDefault ? tr(' · Default', ' · 默认') : '' }}
            </button>
            <button type="button" class="text-slate-400" @click="setDefaultPreset(preset.name)">
              {{ tr('Default', '默认') }}
            </button>
            <button type="button" class="text-slate-400" @click="deletePreset(preset.name)">
              ×
            </button>
          </div>
        </div>

        <div class="grid gap-3 xl:grid-cols-6">
          <input
            v-model="filters.search"
            type="text"
            :placeholder="tr('Search email, path, action', '搜索邮箱、路径、动作')"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @input="handleFilter"
          />
          <select
            v-model="filters.action"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @change="handleFilter"
          >
            <option v-for="option in actionOptions" :key="option" :value="option">
              {{ option === 'all' ? tr('All actions', '全部动作') : option }}
            </option>
          </select>
          <select
            v-model="filters.entityType"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @change="handleFilter"
          >
            <option v-for="option in entityTypeOptions" :key="option" :value="option">
              {{ option === 'all' ? tr('All entities', '全部实体') : option }}
            </option>
          </select>
          <input
            v-model="filters.startDate"
            type="date"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @change="handleFilter"
          />
          <input
            v-model="filters.endDate"
            type="date"
            class="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            @change="handleFilter"
          />
          <button
            type="button"
            class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            @click="resetFilters"
          >
            {{ tr('Reset filters', '重置筛选') }}
          </button>
        </div>

        <div v-if="loading" class="mt-5 text-sm text-slate-500">{{ tr('Loading...', '加载中...') }}</div>

        <div class="mt-5 space-y-3">
          <article v-for="log in logs" :key="log.id" class="rounded-3xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {{ log.action }}
                  </span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {{ log.entity_type }}
                  </span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {{ log.method }}
                  </span>
                </div>
                <p class="mt-3 text-sm font-medium text-slate-900">
                  {{ log.user_email || 'System' }} · {{ log.user_role || 'UNKNOWN' }}
                </p>
                <p class="mt-1 break-all text-sm text-slate-500">{{ log.path }}</p>
                <p v-if="log.description" class="mt-2 text-sm text-slate-600">{{ log.description }}</p>
                <div v-if="hasConfirmationSummary(log)" class="mt-3 flex flex-wrap gap-2">
                  <span class="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                    {{ tr('OCR Manual Confirmation', 'OCR 人工确认') }}
                  </span>
                  <span class="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {{ getDocumentTypeLabel(getConfirmationSummary(log)?.documentType) }}
                  </span>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {{ tr('Items', '条目') }} {{ getConfirmationSummary(log)?.confirmationCount || 0 }}
                  </span>
                </div>
              </div>
              <div class="text-right">
                <span class="text-xs text-slate-400">{{ formatDateTime(log.created_at) }}</span>
                <button
                  type="button"
                  class="mt-3 block rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                  @click="toggleExpanded(log.id)"
                >
                  {{ expandedIds.includes(log.id) ? tr('Hide detail', '收起详情') : tr('View detail', '展开详情') }}
                </button>
              </div>
            </div>
            <div
              v-if="expandedIds.includes(log.id)"
              class="mt-4 space-y-4"
            >
              <div v-if="hasConfirmationSummary(log)" class="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-medium uppercase tracking-wide text-rose-600">{{ tr('Manual Confirmation Summary', '人工确认摘要') }}</p>
                    <h3 class="mt-2 text-lg font-semibold text-rose-900">
                      {{ getDocumentTypeLabel(getConfirmationSummary(log)?.documentType) }}
                      <span v-if="getConfirmationSummary(log)?.documentNo">#{{ getConfirmationSummary(log)?.documentNo }}</span>
                    </h3>
                    <p class="mt-1 text-sm text-rose-700">
                      {{ tr('Confirmed by', '确认人') }} {{ getConfirmationSummary(log)?.confirmedBy?.email || log.user_email || 'System' }}
                      · {{ tr('Total items', '确认条数') }} {{ getConfirmationSummary(log)?.confirmationCount || 0 }}
                    </p>
                  </div>
                  <div class="text-sm text-rose-700">
                    <p>{{ tr('Audit time', '审计时间') }}: {{ formatDateTime(log.created_at) }}</p>
                  </div>
                </div>

                <div class="mt-4 space-y-3">
                  <div
                    v-for="item in getConfirmationSummary(log)?.items || []"
                    :key="`${log.id}-${item.itemIndex}-${item.sortOrder}`"
                    class="rounded-2xl border border-white bg-white p-3 shadow-sm"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-sm font-semibold text-slate-900">{{ item.itemLabel || `Item ${Number(item.itemIndex) + 1}` }}</span>
                          <span
                            class="rounded-full px-2 py-0.5 text-xs font-semibold"
                            :class="getConfidenceBadgeClass(item.ocrConfidenceLevel)"
                          >
                            {{ getConfidenceLabel(item) }}
                          </span>
                          <span v-if="item.itemCode" class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {{ item.itemCode }}
                          </span>
                        </div>
                        <p class="mt-2 text-sm text-slate-700">{{ item.description || tr('No description', '无描述') }}</p>
                      </div>
                      <div class="text-right text-xs text-slate-500">
                        <p>{{ tr('Confirmed at', '确认时间') }}: {{ formatDateTime(item.manualConfirmedAt) }}</p>
                        <p>{{ tr('Confirmed by', '确认人') }}: {{ item.confirmedBy?.email || getConfirmationSummary(log)?.confirmedBy?.email || '-' }}</p>
                      </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2 text-xs">
                      <span class="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {{ tr('Qty', '数量') }} {{ item.quantity ?? 0 }}
                      </span>
                      <span v-if="item.unitPrice" class="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {{ tr('Unit Price', '单价') }} {{ Number(item.unitPrice).toFixed(2) }}
                      </span>
                      <span v-if="item.amount" class="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {{ tr('Amount', '金额') }} {{ Number(item.amount).toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <p class="font-semibold text-slate-100">{{ tr('Raw metadata', '原始 metadata') }}</p>
                  <button
                    type="button"
                    class="rounded-xl border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                    @click="toggleRawExpanded(log.id)"
                  >
                    {{ rawExpandedIds.includes(log.id) ? tr('Hide raw JSON', '收起原始 JSON') : tr('Show raw JSON', '显示原始 JSON') }}
                  </button>
                </div>
                <pre v-if="rawExpandedIds.includes(log.id)" class="whitespace-pre-wrap break-all">{{ JSON.stringify(log.metadata, null, 2) }}</pre>
                <p v-else class="text-slate-400">{{ tr('Raw JSON is hidden by default. Expand only when deeper troubleshooting is needed.', '原始 JSON 默认折叠，仅在需要深度排查时再展开。') }}</p>
              </div>
            </div>
          </article>
        </div>

        <PaginationBar :pagination="pagination" @change="loadLogs" />
      </div>
    </section>
  </AppLayout>
</template>
