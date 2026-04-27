<script setup>
import { computed, onMounted, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import HelpHint from '../components/HelpHint.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'
import { useAuthStore } from '../stores/auth'
import { useTodosStore } from '../stores/todos'

const localeStore = useLocaleStore()
const authStore = useAuthStore()
const todosStore = useTodosStore()
const draft = ref('')
const assigneeId = ref('')
const assignees = ref([])

const remainingCount = computed(() => todosStore.items.filter((item) => !item.done).length)

function addTodo() {
  const resolved = assignees.value.find((user) => String(user.id) === String(assigneeId.value)) || null
  todosStore.add(draft.value, resolved ? { id: resolved.id, name: resolved.full_name || resolved.fullName } : null)
  draft.value = ''
}

async function loadAssignees() {
  const self = authStore.user
  assignees.value = self ? [{ id: self.id, full_name: self.full_name || self.fullName }] : []
  assigneeId.value = self?.id ? String(self.id) : ''

  if (!['ADMIN', 'MANAGER'].includes(authStore.user?.role || '')) {
    return
  }

  try {
    const { data } = await api.get('/users', { params: { all: 'true' } })
    const list = Array.isArray(data.items) ? data.items : []
    assignees.value = list
    if (!assigneeId.value && list[0]) {
      assigneeId.value = String(list[0].id)
    }
  } catch {
    // ignore
  }
}

onMounted(() => {
  loadAssignees()
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">{{ localeStore.locale === 'en' ? 'Support' : '支持' }}</p>
          <h2 class="mt-2 flex items-center gap-2 text-3xl font-semibold text-slate-900">
            {{ localeStore.t('todos.title') }}
            <HelpHint :text="localeStore.t('todos.subtitle')" />
          </h2>
          <p class="mt-2 text-sm text-slate-500">{{ localeStore.t('todos.subtitle') }}</p>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          @click="todosStore.clearDone"
        >
          {{ localeStore.t('todos.clearDone') }}
        </button>
      </div>

      <div class="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
        <div class="flex flex-wrap items-center gap-3">
          <select
            v-model="assigneeId"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 md:w-56"
          >
            <option value="">{{ localeStore.t('todos.unassigned') }}</option>
            <option v-for="user in assignees" :key="user.id" :value="String(user.id)">
              {{ user.full_name || user.fullName }}
            </option>
          </select>
          <input
            v-model="draft"
            type="text"
            class="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500"
            :placeholder="localeStore.t('todos.addPlaceholder')"
            @keydown.enter.prevent="addTodo"
          />
          <button class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" @click="addTodo">
            {{ localeStore.t('todos.add') }}
          </button>
        </div>

        <p class="mt-4 text-sm text-slate-500">
          {{ localeStore.t('todos.remaining') }}: {{ remainingCount }}
        </p>

        <div class="mt-4 space-y-2">
          <div
            v-for="item in todosStore.items"
            :key="item.id"
            class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
          >
            <label class="flex min-w-0 flex-1 items-center gap-3">
              <input :checked="item.done" type="checkbox" class="size-4 rounded border-slate-300" @change="todosStore.toggle(item.id)" />
              <span class="min-w-0">
                <span class="block truncate text-sm" :class="item.done ? 'text-slate-400 line-through' : 'text-slate-900'">
                  {{ item.title }}
                </span>
                <span class="mt-1 block truncate text-xs text-slate-400">
                  {{ localeStore.t('todos.assignee') }}:
                  {{ item.assigneeName || localeStore.t('todos.unassigned') }}
                </span>
              </span>
            </label>
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              @click="todosStore.remove(item.id)"
            >
              {{ localeStore.t('common.remove') }}
            </button>
          </div>
          <p v-if="todosStore.items.length === 0" class="text-sm text-slate-500">{{ localeStore.t('todos.empty') }}</p>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
