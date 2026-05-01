<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const brands = ref([])
const suppliers = ref([])
const localeStore = useLocaleStore()
const errorMessage = ref('')
const loading = ref(false)
const searchKeyword = ref('')
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
})
const form = reactive({
  id: null,
  name: '',
  description: '',
  isActive: true,
  supplierIds: [],
})

// Supplier searchable multi-select state
const supplierQuery = ref('')
const supplierDropdownOpen = ref(false)
const supplierHighlight = ref(0)
const supplierInputRef = ref(null)

const suppliersById = computed(() => {
  const map = new Map()
  suppliers.value.forEach(s => map.set(Number(s.id), s))
  return map
})

const selectedSuppliers = computed(() =>
  (form.supplierIds || [])
    .map(id => suppliersById.value.get(Number(id)))
    .filter(Boolean),
)

const filteredSuppliers = computed(() => {
  const q = supplierQuery.value.trim().toLowerCase()
  return suppliers.value
    .filter(s => !form.supplierIds.includes(Number(s.id)))
    .filter(s => {
      if (!q) return true
      const name = String(s.name || '').toLowerCase()
      const company = String(s.company_name || '').toLowerCase()
      const branch = String(s.branch || '').toLowerCase()
      return name.includes(q) || company.includes(q) || branch.includes(q)
    })
    .slice(0, 50)
})

function openSupplierDropdown() {
  supplierDropdownOpen.value = true
  supplierHighlight.value = 0
}

function closeSupplierDropdown() {
  setTimeout(() => {
    supplierDropdownOpen.value = false
  }, 150)
}

function addSupplier(s) {
  if (!s) return
  const id = Number(s.id)
  if (!form.supplierIds.includes(id)) {
    form.supplierIds = [...form.supplierIds, id]
  }
  supplierQuery.value = ''
  supplierHighlight.value = 0
  nextTick(() => {
    if (supplierInputRef.value) supplierInputRef.value.focus()
  })
}

function removeSupplier(id) {
  form.supplierIds = form.supplierIds.filter(x => Number(x) !== Number(id))
}

function onSupplierKeyDown(event) {
  if (!supplierDropdownOpen.value) {
    supplierDropdownOpen.value = true
  }
  const list = filteredSuppliers.value
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    supplierHighlight.value = Math.min(supplierHighlight.value + 1, Math.max(list.length - 1, 0))
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    supplierHighlight.value = Math.max(supplierHighlight.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const pick = list[supplierHighlight.value]
    if (pick) addSupplier(pick)
  } else if (event.key === 'Escape') {
    supplierDropdownOpen.value = false
    supplierQuery.value = ''
  } else if (event.key === 'Backspace' && !supplierQuery.value && form.supplierIds.length) {
    // backspace to remove last selected when input empty
    removeSupplier(form.supplierIds[form.supplierIds.length - 1])
  }
}

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

async function loadBrands(page = pagination.value.page) {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data } = await api.get('/brands', {
      params: {
        search: searchKeyword.value,
        page,
        pageSize: pagination.value.pageSize,
      },
    })
    brands.value = data.items
    pagination.value = data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load brands.', '加载品牌失败。')
  } finally {
    loading.value = false
  }
}

async function loadSuppliers() {
  try {
    const { data } = await api.get('/suppliers', { params: { status: 'active', page: 1, pageSize: 500 } })
    suppliers.value = data.items || []
  } catch {
    suppliers.value = []
  }
}

async function editBrand(brand) {
  Object.assign(form, {
    id: brand.id,
    name: brand.name,
    description: brand.description || '',
    isActive: Boolean(brand.is_active),
    supplierIds: [],
  })
  try {
    const { data } = await api.get(`/brands/${brand.id}`)
    form.supplierIds = Array.isArray(data.suppliers) ? data.suppliers.map(s => Number(s.id)) : []
  } catch {
    form.supplierIds = []
  }
}

function resetForm() {
  Object.assign(form, {
    id: null,
    name: '',
    description: '',
    isActive: true,
    supplierIds: [],
  })
}

async function saveBrand() {
  errorMessage.value = ''
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      isActive: form.isActive,
      supplierIds: Array.isArray(form.supplierIds) ? form.supplierIds.map(Number) : [],
    }
    if (form.id) {
      await api.put(`/brands/${form.id}`, payload)
    } else {
      await api.post('/brands', payload)
    }

    resetForm()
    await loadBrands()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to save brand.', '保存品牌失败。')
  }
}

async function deleteBrand(id) {
  if (!window.confirm(tr('Delete this brand? Associated suppliers will be unlinked and products will lose their brand.', '确认删除该品牌？关联供应商将被解绑，产品品牌将被清空。'))) {
    return
  }
  try {
    await api.delete(`/brands/${id}`)
    await loadBrands()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to delete brand.', '删除品牌失败。')
  }
}

function handleSearch() {
  loadBrands(1)
}

onMounted(() => {
  loadBrands()
  loadSuppliers()
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Master Data</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">
            {{ tr('Brand management', '品牌管理') }}
          </h2>
          <p class="mt-2 max-w-2xl text-sm text-slate-500">
            {{ tr('Manage brands and link them to suppliers and products.', '维护品牌信息，绑定供应商负责范围并分配给产品。') }}
          </p>
        </div>
        <input
          v-model="searchKeyword"
          type="text"
          :placeholder="tr('Search brands', '搜索品牌')"
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500 md:w-72"
          @input="handleSearch"
        />
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 grid gap-6 2xl:grid-cols-[360px_1fr]">
        <form class="rounded-3xl border border-slate-200 bg-slate-50 p-5" @submit.prevent="saveBrand">
          <h3 class="text-xl font-semibold text-slate-900">
            {{ form.id ? tr('Edit brand', '编辑品牌') : tr('Create brand', '新建品牌') }}
          </h3>
          <div class="mt-5 space-y-4">
            <input
              v-model="form.name"
              type="text"
              :placeholder="tr('Brand name', '品牌名称')"
              required
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <textarea
              v-model="form.description"
              rows="4"
              :placeholder="tr('Description', '描述')"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {{ tr('Linked suppliers', '关联供应商') }}
              </p>
              <!-- Selected chips -->
              <div v-if="selectedSuppliers.length" class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="s in selectedSuppliers"
                  :key="s.id"
                  class="inline-flex items-center gap-1 rounded-full border border-brand-500 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                >
                  {{ s.name }}{{ s.branch ? ` (${s.branch})` : '' }}
                  <button
                    type="button"
                    class="ml-1 text-brand-500 hover:text-brand-700"
                    @click="removeSupplier(s.id)"
                  >×</button>
                </span>
              </div>
              <!-- Searchable input with dropdown -->
              <div class="relative mt-2">
                <input
                  ref="supplierInputRef"
                  v-model="supplierQuery"
                  type="text"
                  :placeholder="tr('Search suppliers to add...', '搜索供应商进行关联...')"
                  class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  @focus="openSupplierDropdown"
                  @blur="closeSupplierDropdown"
                  @keydown="onSupplierKeyDown"
                />
                <ul
                  v-if="supplierDropdownOpen && filteredSuppliers.length"
                  class="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <li
                    v-for="(s, index) in filteredSuppliers"
                    :key="s.id"
                    class="cursor-pointer px-3 py-2 text-sm text-slate-700"
                    :class="index === supplierHighlight ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50'"
                    @mousedown.prevent="addSupplier(s)"
                    @mouseenter="supplierHighlight = index"
                  >
                    <span class="font-medium">{{ s.name }}</span>
                    <span v-if="s.branch" class="ml-1 text-xs text-slate-500">({{ s.branch }})</span>
                    <span v-if="s.company_name && s.company_name !== s.name" class="ml-1 text-xs text-slate-400">· {{ s.company_name }}</span>
                  </li>
                </ul>
                <div
                  v-else-if="supplierDropdownOpen && supplierQuery && !filteredSuppliers.length"
                  class="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg"
                >
                  {{ tr('No matching suppliers.', '没有匹配的供应商。') }}
                </div>
              </div>
              <p class="mt-2 text-xs text-slate-400">
                {{ tr('Type to search by name / company / branch. ↑↓ to navigate, Enter to add.', '输入可按名称/公司/分公司搜索，↑↓ 选择，回车添加。') }}
              </p>
            </div>
            <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <input v-model="form.isActive" type="checkbox" class="size-4 rounded border-slate-300" />
              {{ tr('Active brand', '启用') }}
            </label>
            <div class="flex gap-3">
              <button class="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                {{ tr('Save', '保存') }}
              </button>
              <button
                type="button"
                class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                @click="resetForm"
              >
                {{ tr('Reset', '重置') }}
              </button>
            </div>
          </div>
        </form>

        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div v-if="loading" class="border-b border-slate-200 px-4 py-4 text-sm text-slate-500">
            {{ tr('Loading...', '加载中...') }}
          </div>
          <div class="space-y-3 p-4 md:hidden">
            <article
              v-for="brand in brands"
              :key="brand.id"
              class="rounded-3xl border border-slate-200 p-4"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="font-medium text-slate-900">{{ brand.name }}</p>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="brand.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'"
                >
                  {{ brand.is_active ? tr('Active', '启用') : tr('Inactive', '停用') }}
                </span>
              </div>
              <p class="mt-2 text-sm text-slate-500">{{ brand.description || '—' }}</p>
              <p class="mt-1 text-xs text-slate-400">
                {{ tr('Suppliers', '供应商') }}: {{ brand.supplier_count ?? 0 }} · {{ tr('Products', '产品') }}: {{ brand.product_count ?? 0 }}
              </p>
              <div class="mt-4 flex gap-2">
                <button class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="editBrand(brand)">
                  {{ tr('Edit', '编辑') }}
                </button>
                <button class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white" @click="deleteBrand(brand.id)">
                  {{ tr('Delete', '删除') }}
                </button>
              </div>
            </article>
          </div>
          <table class="hidden min-w-full text-left text-sm md:table">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-4">{{ tr('Name', '名称') }}</th>
                <th class="px-4 py-4">{{ tr('Description', '描述') }}</th>
                <th class="px-4 py-4">{{ tr('Suppliers', '供应商') }}</th>
                <th class="px-4 py-4">{{ tr('Products', '产品') }}</th>
                <th class="px-4 py-4">{{ tr('Status', '状态') }}</th>
                <th class="px-4 py-4">{{ tr('Actions', '操作') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="brand in brands" :key="brand.id" class="border-t border-slate-100">
                <td class="px-4 py-4 font-medium text-slate-900">{{ brand.name }}</td>
                <td class="px-4 py-4 text-slate-500">
                  <p class="max-w-xs truncate" :title="brand.description || '—'">{{ brand.description || '—' }}</p>
                </td>
                <td class="px-4 py-4 text-slate-500">{{ brand.supplier_count ?? 0 }}</td>
                <td class="px-4 py-4 text-slate-500">{{ brand.product_count ?? 0 }}</td>
                <td class="px-4 py-4">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="brand.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'"
                  >
                    {{ brand.is_active ? tr('Active', '启用') : tr('Inactive', '停用') }}
                  </span>
                </td>
                <td class="px-4 py-4">
                  <div class="flex gap-2">
                    <button class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="editBrand(brand)">
                      {{ tr('Edit', '编辑') }}
                    </button>
                    <button class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white" @click="deleteBrand(brand.id)">
                      {{ tr('Delete', '删除') }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!brands.length">
                <td colspan="6" class="px-4 py-8 text-center text-sm text-slate-400">
                  {{ tr('No brands yet.', '暂无品牌。') }}
                </td>
              </tr>
            </tbody>
          </table>
          <PaginationBar :pagination="pagination" @change="loadBrands" />
        </div>
      </div>
    </section>
  </AppLayout>
</template>
