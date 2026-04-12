<script setup>
import { onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import api from '../services/api'

const categories = ref([])
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
  description: '',
})

async function loadCategories(page = pagination.value.page) {
  loading.value = true

  try {
    const { data } = await api.get('/categories', {
      params: {
        search: searchKeyword.value,
        page,
        pageSize: pagination.value.pageSize,
      },
    })
    categories.value = data.items
    pagination.value = data.pagination
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load categories.'
  } finally {
    loading.value = false
  }
}

function editCategory(category) {
  Object.assign(form, {
    id: category.id,
    name: category.name,
    description: category.description || '',
  })
}

function resetForm() {
  Object.assign(form, {
    id: null,
    name: '',
    description: '',
  })
}

async function saveCategory() {
  try {
    if (form.id) {
      await api.put(`/categories/${form.id}`, form)
    } else {
      await api.post('/categories', form)
    }

    resetForm()
    await loadCategories()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to save category.'
  }
}

async function deleteCategory(id) {
  try {
    await api.delete(`/categories/${id}`)
    await loadCategories()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to delete category.'
  }
}

function handleSearch() {
  loadCategories(1)
}

onMounted(loadCategories)
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Master Data</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">Category management</h2>
        </div>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索分类"
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500 md:w-72"
          @input="handleSearch"
        />
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div class="mt-6 grid gap-6 2xl:grid-cols-[360px_1fr]">
        <form class="rounded-3xl border border-slate-200 bg-slate-50 p-5" @submit.prevent="saveCategory">
          <h3 class="text-xl font-semibold text-slate-900">
            {{ form.id ? 'Edit category' : 'Create category' }}
          </h3>
          <div class="mt-5 space-y-4">
            <input
              v-model="form.name"
              type="text"
              placeholder="Category name"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
            <textarea
              v-model="form.description"
              rows="4"
              placeholder="Description"
              class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            />
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
          <div v-if="loading" class="border-b border-slate-200 px-4 py-4 text-sm text-slate-500">加载中...</div>
          <div class="space-y-3 p-4 md:hidden">
            <article
              v-for="category in categories"
              :key="category.id"
              class="rounded-3xl border border-slate-200 p-4"
            >
              <p class="font-medium text-slate-900">{{ category.name }}</p>
              <p class="mt-2 text-sm text-slate-500">{{ category.description || '—' }}</p>
              <div class="mt-4 flex gap-2">
                <button
                  class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  @click="editCategory(category)"
                >
                  Edit
                </button>
                <button
                  class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                  @click="deleteCategory(category.id)"
                >
                  Delete
                </button>
              </div>
            </article>
          </div>
          <table class="hidden min-w-full text-left text-sm md:table">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-4 py-4">Name</th>
                <th class="px-4 py-4">Description</th>
                <th class="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="category in categories" :key="category.id" class="border-t border-slate-100">
                <td class="px-4 py-4 font-medium text-slate-900">{{ category.name }}</td>
                <td class="px-4 py-4 text-slate-500">{{ category.description || '—' }}</td>
                <td class="px-4 py-4">
                  <div class="flex gap-2">
                    <button
                      class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      @click="editCategory(category)"
                    >
                      Edit
                    </button>
                    <button
                      class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                      @click="deleteCategory(category.id)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <PaginationBar :pagination="pagination" @change="loadCategories" />
        </div>
      </div>
    </section>
  </AppLayout>
</template>
