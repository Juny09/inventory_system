<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const tenants = ref([])
const stats = ref({})
const errorMessage = ref('')
const filter = ref('ALL') // ALL | PENDING | ACTIVE | REJECTED | SUSPENDED

// 拒绝弹窗状态
const rejectModal = ref({ open: false, tenant: null, reason: '' })
const actingId = ref(null)

const filteredTenants = computed(() => {
  if (filter.value === 'ALL') return tenants.value
  return tenants.value.filter((t) => t.status === filter.value)
})

const statusBadge = (status) => {
  const map = {
    PENDING: 'bg-amber-100 text-amber-700',
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-rose-100 text-rose-700',
    SUSPENDED: 'bg-slate-200 text-slate-700',
    DELETED: 'bg-slate-300 text-slate-500',
  }
  return map[status] || 'bg-slate-100 text-slate-700'
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [listResp, statsResp] = await Promise.all([
      api.get('/admin/tenants'),
      api.get('/admin/stats'),
    ])
    tenants.value = listResp.data.tenants || []
    stats.value = statsResp.data || {}
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Failed to load tenants.'
  } finally {
    loading.value = false
  }
}

async function approveTenant(tenant) {
  if (!confirm(`Approve "${tenant.name}" (${tenant.code})?\nThe company admin will be able to log in immediately.`)) return
  actingId.value = tenant.id
  try {
    await api.post(`/admin/tenants/${tenant.id}/approve`)
    await loadData()
  } catch (error) {
    alert(error.response?.data?.message || 'Failed to approve tenant.')
  } finally {
    actingId.value = null
  }
}

function openRejectModal(tenant) {
  rejectModal.value = { open: true, tenant, reason: '' }
}

async function confirmReject() {
  const { tenant, reason } = rejectModal.value
  if (!tenant) return
  actingId.value = tenant.id
  try {
    await api.post(`/admin/tenants/${tenant.id}/reject`, { reason: reason.trim() || null })
    rejectModal.value = { open: false, tenant: null, reason: '' }
    await loadData()
  } catch (error) {
    alert(error.response?.data?.message || 'Failed to reject tenant.')
  } finally {
    actingId.value = null
  }
}

async function suspendTenant(tenant) {
  if (!confirm(`Suspend "${tenant.name}"? Active users won't be able to log in until re-approved.`)) return
  actingId.value = tenant.id
  try {
    await api.post(`/admin/tenants/${tenant.id}/suspend`)
    await loadData()
  } catch (error) {
    alert(error.response?.data?.message || 'Failed to suspend tenant.')
  } finally {
    actingId.value = null
  }
}

function logout() {
  authStore.clearAuth()
  router.push({ name: 'login' })
}

const formatDate = (d) => (d ? new Date(d).toLocaleString() : '-')

onMounted(loadData)
</script>

<template>
  <div class="min-h-screen bg-slate-100 px-6 py-8">
    <div class="mx-auto max-w-7xl">
      <!-- Header -->
      <header class="mb-8 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Platform Console</p>
          <h1 class="mt-2 text-3xl font-bold text-slate-900">Tenant Management</h1>
          <p class="mt-1 text-sm text-slate-500">
            Signed in as <span class="font-semibold">{{ authStore.user?.email }}</span>
          </p>
        </div>
        <button
          class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          @click="logout"
        >
          Logout
        </button>
      </header>

      <!-- Stats -->
      <div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-xs uppercase tracking-wider text-slate-500">Pending</p>
          <p class="mt-2 text-3xl font-bold text-amber-600">{{ stats.pending_count || 0 }}</p>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-xs uppercase tracking-wider text-slate-500">Active</p>
          <p class="mt-2 text-3xl font-bold text-emerald-600">{{ stats.active_count || 0 }}</p>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-xs uppercase tracking-wider text-slate-500">Rejected</p>
          <p class="mt-2 text-3xl font-bold text-rose-600">{{ stats.rejected_count || 0 }}</p>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-xs uppercase tracking-wider text-slate-500">Suspended</p>
          <p class="mt-2 text-3xl font-bold text-slate-600">{{ stats.suspended_count || 0 }}</p>
        </div>
        <div class="rounded-2xl bg-white p-5 shadow-sm">
          <p class="text-xs uppercase tracking-wider text-slate-500">Total Users</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">{{ stats.total_users || 0 }}</p>
        </div>
      </div>

      <!-- Filter tabs -->
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="f in ['ALL', 'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED']"
          :key="f"
          class="rounded-xl px-4 py-2 text-sm font-semibold transition"
          :class="filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
          @click="filter = f"
        >
          {{ f }}
        </button>
        <button
          class="ml-auto rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          :disabled="loading"
          @click="loadData"
        >
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>

      <!-- Error -->
      <p v-if="errorMessage" class="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ errorMessage }}
      </p>

      <!-- Table -->
      <div class="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Company</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Admin</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Plan</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Users</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Registered</th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm text-slate-700">
            <tr v-if="!loading && filteredTenants.length === 0">
              <td class="px-4 py-10 text-center text-slate-400" colspan="7">
                No tenants match the current filter.
              </td>
            </tr>
            <tr v-for="t in filteredTenants" :key="t.id" class="hover:bg-slate-50">
              <td class="px-4 py-3">
                <div class="font-semibold text-slate-900">{{ t.name }}</div>
                <div class="text-xs text-slate-500">Code: {{ t.code }}</div>
              </td>
              <td class="px-4 py-3">
                <div>{{ t.admin_name || '-' }}</div>
                <div class="text-xs text-slate-500">{{ t.admin_email || t.contact_email || '-' }}</div>
              </td>
              <td class="px-4 py-3">{{ t.plan }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold" :class="statusBadge(t.status)">
                  {{ t.status }}
                </span>
                <div v-if="t.status === 'REJECTED' && t.rejected_reason" class="mt-1 text-xs text-rose-500">
                  Reason: {{ t.rejected_reason }}
                </div>
              </td>
              <td class="px-4 py-3">{{ t.user_count }} / {{ t.max_users }}</td>
              <td class="px-4 py-3 text-xs text-slate-500">{{ formatDate(t.created_at) }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    v-if="t.status === 'PENDING' || t.status === 'REJECTED' || t.status === 'SUSPENDED'"
                    class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    :disabled="actingId === t.id"
                    @click="approveTenant(t)"
                  >
                    Approve
                  </button>
                  <button
                    v-if="t.status === 'PENDING'"
                    class="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    :disabled="actingId === t.id"
                    @click="openRejectModal(t)"
                  >
                    Reject
                  </button>
                  <button
                    v-if="t.status === 'ACTIVE'"
                    class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    :disabled="actingId === t.id"
                    @click="suspendTenant(t)"
                  >
                    Suspend
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Reject Modal -->
    <div
      v-if="rejectModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
      @click.self="rejectModal.open = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="text-lg font-bold text-slate-900">
          Reject "{{ rejectModal.tenant?.name }}"
        </h3>
        <p class="mt-2 text-sm text-slate-500">
          The company will be marked as REJECTED and admins won't be able to log in. You can re-approve later.
        </p>
        <label class="mt-4 block">
          <span class="mb-2 block text-sm font-medium text-slate-700">Reason (optional)</span>
          <textarea
            v-model="rejectModal.reason"
            rows="3"
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="e.g. Duplicate registration / Unable to verify company"
          />
        </label>
        <div class="mt-5 flex justify-end gap-2">
          <button
            class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="rejectModal.open = false"
          >
            Cancel
          </button>
          <button
            class="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            :disabled="actingId === rejectModal.tenant?.id"
            @click="confirmReject"
          >
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
