import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

function buildStorageKey(userId) {
  return `inventory_todos_${userId || 'guest'}`
}

function readTodos(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useTodosStore = defineStore('todos', () => {
  const authStore = useAuthStore()
  const storageKey = computed(() => buildStorageKey(authStore.user?.id))
  const items = ref(readTodos(storageKey.value))

  function persist() {
    localStorage.setItem(storageKey.value, JSON.stringify(items.value))
  }

  function add(title, assignee) {
    const trimmed = String(title || '').trim()
    if (!trimmed) return
    const assigneeId = assignee?.id ?? assignee?.userId ?? null
    const assigneeName = assignee?.name ?? assignee?.full_name ?? assignee?.fullName ?? null
    items.value = [
      {
        id: Date.now(),
        title: trimmed,
        done: false,
        createdAt: new Date().toISOString(),
        assigneeId: assigneeId ? Number(assigneeId) : null,
        assigneeName: assigneeName ? String(assigneeName) : null,
      },
      ...items.value,
    ]
    persist()
  }

  function toggle(id) {
    items.value = items.value.map((item) => (Number(item.id) === Number(id) ? { ...item, done: !item.done } : item))
    persist()
  }

  function remove(id) {
    items.value = items.value.filter((item) => Number(item.id) !== Number(id))
    persist()
  }

  function clearDone() {
    items.value = items.value.filter((item) => !item.done)
    persist()
  }

  function setAssignee(id, assignee) {
    const assigneeId = assignee?.id ?? assignee?.userId ?? null
    const assigneeName = assignee?.name ?? assignee?.full_name ?? assignee?.fullName ?? null
    items.value = items.value.map((item) =>
      Number(item.id) === Number(id)
        ? {
            ...item,
            assigneeId: assigneeId ? Number(assigneeId) : null,
            assigneeName: assigneeName ? String(assigneeName) : null,
          }
        : item,
    )
    persist()
  }

  function reload() {
    items.value = readTodos(storageKey.value)
  }

  return {
    items,
    add,
    toggle,
    remove,
    clearDone,
    setAssignee,
    reload,
  }
})
