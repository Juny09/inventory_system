<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const router = useRouter()
const localeStore = useLocaleStore()
const loading = ref(false)
const errorMessage = ref('')
const suppliers = ref([])
const searchKeyword = ref('')
const statusFilter = ref('all')
const sortBy = ref('updated_at')
const sortOrder = ref('desc')
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
})

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

async function loadSuppliers(page = pagination.value.page) {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data } = await api.get('/suppliers', {
      params: {
        search: searchKeyword.value,
        status: statusFilter.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        page,
        pageSize: pagination.value.pageSize,
      },
    })
    suppliers.value = data.items
    pagination.value = data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load suppliers.', '加载供应商失败。')
  } finally {
    loading.value = false
  }
}

async function deleteSupplier(id) {
  try {
    await api.delete(`/suppliers/${id}`)
    await loadSuppliers(1)
  } catch (error) {
    if (error.response?.status === 404) {
      errorMessage.value = tr('Delete endpoint not found. Please restart the server.', '删除接口不存在，请重启后端服务。')
      return
    }
    errorMessage.value = error.response?.data?.message || tr('Failed to delete supplier.', '删除供应商失败。')
  }
}

function handleSearch() {
  loadSuppliers(1)
}

function goToAdd() {
  router.push({ name: 'supplier-form' })
}

function goToEdit(id) {
  router.push({ name: 'supplier-form', query: { id: String(id) } })
}

function goToDetail(id) {
  router.push({ name: 'supplier-detail', params: { id: String(id) } })
}

onMounted(() => loadSuppliers(1))
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Master Data</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('Supplier management', '供应商管理') }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ tr('Manage supplier contacts and purchase info.', '管理供应商联系方式与采购信息。') }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <select
            v-model="statusFilter"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
            @change="handleSearch"
          >
            <option value="all">{{ tr('All status', '全部状态') }}</option>
            <option value="active">{{ tr('Active', '启用') }}</option>
            <option value="inactive">{{ tr('Inactive', '停用') }}</option>
          </select>
          <input
            v-model="searchKeyword"
            type="text"
            :placeholder="tr('Search company / contact / phone', '搜索公司/联系人/电话')"
            class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500 md:w-80"
            @input="handleSearch"
          />
          <button class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" @click="goToAdd">
            {{ tr('Add supplier', '新增供应商') }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 overflow-hidden rounded-3xl border border-slate-200">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <select
            v-model="sortBy"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500"
            @change="handleSearch"
          >
            <option value="updated_at">{{ tr('Sort: updated', '排序：更新时间') }}</option>
            <option value="created_at">{{ tr('Sort: created', '排序：创建时间') }}</option>
            <option value="name">{{ tr('Sort: name', '排序：名称') }}</option>
            <option value="lead_time_days">{{ tr('Sort: lead time', '排序：交货周期') }}</option>
          </select>
          <select
            v-model="sortOrder"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500"
            @change="handleSearch"
          >
            <option value="desc">{{ tr('Desc', '降序') }}</option>
            <option value="asc">{{ tr('Asc', '升序') }}</option>
          </select>
        </div>

        <div v-if="loading" class="border-b border-slate-200 px-4 py-4 text-sm text-slate-500">
          {{ tr('Loading...', '加载中...') }}
        </div>

        <div class="space-y-3 p-4 md:hidden">
          <article v-for="supplier in suppliers" :key="supplier.id" class="rounded-3xl border border-slate-200 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-slate-900">{{ supplier.company_name || supplier.name }}</p>
                <p class="mt-1 text-sm text-slate-500">
                  {{ supplier.contact_name || '—' }} · {{ supplier.phone || '—' }}
                </p>
              </div>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="supplier.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'"
              >
                {{ supplier.is_active ? tr('Active', '启用') : tr('Inactive', '停用') }}
              </span>
            </div>
            <p class="mt-3 text-xs text-slate-500">
              {{ tr('Products', '关联商品') }}: {{ supplier.linked_product_count }}
            </p>
            <div class="mt-4 flex gap-2">
              <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="goToDetail(supplier.id)">
                {{ tr('Open', '打开') }}
              </button>
              <button class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="goToEdit(supplier.id)">
                {{ tr('Edit', '编辑') }}
              </button>
              <button class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white" @click="deleteSupplier(supplier.id)">
                {{ tr('Delete', '删除') }}
              </button>
            </div>
          </article>
        </div>

        <table class="hidden min-w-full text-left text-sm md:table">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-4">{{ tr('Company name', '公司名称') }}</th>
              <th class="px-4 py-4">{{ tr('Contact', '联系人') }}</th>
              <th class="px-4 py-4">{{ tr('Lead time', '交货周期') }}</th>
              <th class="px-4 py-4">{{ tr('Products', '关联商品') }}</th>
              <th class="px-4 py-4">{{ tr('Status', '状态') }}</th>
              <th class="px-4 py-4">{{ tr('Actions', '操作') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="supplier in suppliers" :key="supplier.id" class="border-t border-slate-100">
              <td class="px-4 py-4">
                <p class="font-semibold text-slate-900">{{ supplier.company_name || supplier.name }}</p>
              </td>
              <td class="px-4 py-4 text-slate-600">
                <div>
                  <p class="font-medium">{{ supplier.contact_name || '—' }}</p>
                  <p class="text-xs text-slate-500">{{ supplier.phone || supplier.email || '—' }}</p>
                </div>
              </td>
              <td class="px-4 py-4 text-slate-600">{{ supplier.lead_time_days }}d</td>
              <td class="px-4 py-4 text-slate-600">{{ supplier.linked_product_count }}</td>
              <td class="px-4 py-4">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="supplier.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'"
                >
                  {{ supplier.is_active ? tr('Active', '启用') : tr('Inactive', '停用') }}
                </span>
              </td>
              <td class="px-4 py-4">
                <div class="flex gap-2">
                  <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" @click="goToDetail(supplier.id)">
                    {{ tr('Open', '打开') }}
                  </button>
                  <button class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="goToEdit(supplier.id)">
                    {{ tr('Edit', '编辑') }}
                  </button>
                  <button class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white" @click="deleteSupplier(supplier.id)">
                    {{ tr('Delete', '删除') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <PaginationBar :pagination="pagination" @change="loadSuppliers" />
      </div>
    </section>
  </AppLayout>
</template>
