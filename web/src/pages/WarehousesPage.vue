<script setup>
import { onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const warehouses = ref([])
const localeStore = useLocaleStore()
const errorMessage = ref('')
const loading = ref(false)
const searchKeyword = ref('')
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
})
const form = reactive({
  id: null,
  name: '',
  code: '',
  address: '',
  managerName: '',
  isActive: true,
})

async function loadWarehouses(page = pagination.value.page) {
  loading.value = true

  try {
    const { data } = await api.get('/warehouses', {
      params: {
        search: searchKeyword.value,
        page,
        pageSize: pagination.value.pageSize,
      },
    })
    warehouses.value = data.items
    pagination.value = data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load warehouses.'
  } finally {
    loading.value = false
  }
}

function editWarehouse(warehouse) {
  Object.assign(form, {
    id: warehouse.id,
    name: warehouse.name,
    code: warehouse.code,
    address: warehouse.address || '',
    managerName: warehouse.manager_name || '',
    isActive: warehouse.is_active,
  })
}

function resetForm() {
  Object.assign(form, {
    id: null,
    name: '',
    code: '',
    address: '',
    managerName: '',
    isActive: true,
  })
}

async function saveWarehouse() {
  try {
    if (form.id) {
      await api.put(`/warehouses/${form.id}`, form)
    } else {
      await api.post('/warehouses', form)
    }

    resetForm()
    await loadWarehouses()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to save warehouse.'
  }
}

async function deleteWarehouse(id) {
  try {
    await api.delete(`/warehouses/${id}`)
    await loadWarehouses()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to delete warehouse.'
  }
}

function handleSearch() {
  loadWarehouses(1)
}

onMounted(loadWarehouses)
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Storage</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">Warehouse management</h2>
        </div>
        <input
          v-model="searchKeyword"
          type="text"
          :placeholder="localeStore.locale === 'en' ? 'Search warehouses' : '搜索仓库'"
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500 md:w-72"
          @input="handleSearch"
        />
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 grid gap-6 2xl:grid-cols-[360px_1fr]">
        <form class="rounded-3xl border border-slate-200 bg-slate-50 p-5" @submit.prevent="saveWarehouse">
          <h3 class="text-xl font-semibold text-slate-900">
            {{ form.id ? 'Edit warehouse' : 'Create warehouse' }}
          </h3>
          <div class="mt-5 space-y-4">
            <input
              v-model="form.name"
              type="text"
              placeholder="Warehouse name"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <input
              v-model="form.code"
              type="text"
              placeholder="Warehouse code"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <input
              v-model="form.managerName"
              type="text"
              placeholder="Manager name"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <textarea
              v-model="form.address"
              rows="4"
              placeholder="Address"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <label class="flex items-center gap-3 text-sm text-slate-600">
              <input v-model="form.isActive" type="checkbox" class="size-4 rounded border-slate-300" />
              Warehouse is active
            </label>
            <div class="flex gap-3">
              <button class="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                Save
              </button>
              <button
                type="button"
                class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                @click="resetForm"
              >
                Reset
              </button>
            </div>
          </div>
        </form>

        <div class="overflow-hidden rounded-3xl border border-slate-200">
          <div v-if="loading" class="border-b border-slate-200 px-4 py-4 text-sm text-slate-500">
            {{ localeStore.locale === 'en' ? 'Loading...' : '加载中...' }}
          </div>
          <div class="space-y-3 p-4 md:hidden">
            <article
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              class="rounded-3xl border border-slate-200 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-medium text-slate-900">{{ warehouse.name }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ warehouse.code }}</p>
                </div>
                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  :class="
                    warehouse.is_active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-600'
                  "
                >
                  {{ warehouse.is_active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <p class="mt-3 text-sm text-slate-500">{{ warehouse.address || 'No address' }}</p>
              <p class="mt-1 text-sm text-slate-500">Manager: {{ warehouse.manager_name || '—' }}</p>
              <div class="mt-4 flex gap-2">
                <button class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="editWarehouse(warehouse)">Edit</button>
                <button class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white" @click="deleteWarehouse(warehouse.id)">Delete</button>
              </div>
            </article>
          </div>
          <table class="hidden min-w-full text-left text-sm md:table">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-4">Warehouse</th>
                <th class="px-4 py-4">Code</th>
                <th class="px-4 py-4">Manager</th>
                <th class="px-4 py-4">Status</th>
                <th class="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="warehouse in warehouses" :key="warehouse.id" class="border-t border-slate-100">
                <td class="px-4 py-4">
                  <p class="font-medium text-slate-900">{{ warehouse.name }}</p>
                  <p class="text-xs text-slate-500">{{ warehouse.address || 'No address' }}</p>
                </td>
                <td class="px-4 py-4">{{ warehouse.code }}</td>
                <td class="px-4 py-4">{{ warehouse.manager_name || '—' }}</td>
                <td class="px-4 py-4">
                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="
                      warehouse.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                    "
                  >
                    {{ warehouse.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-4 py-4">
                  <div class="flex gap-2">
                    <button
                      class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      @click="editWarehouse(warehouse)"
                    >
                      Edit
                    </button>
                    <button
                      class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                      @click="deleteWarehouse(warehouse.id)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <PaginationBar :pagination="pagination" @change="loadWarehouses" />
        </div>
      </div>
    </section>
  </AppLayout>
</template>
