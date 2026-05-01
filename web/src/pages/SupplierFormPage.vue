<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import { useLocaleStore } from '../stores/locale'

const route = useRoute()
const router = useRouter()
const localeStore = useLocaleStore()
const loading = ref(false)
const errorMessage = ref('')
const supplierList = ref([])
const brands = ref([])
const form = reactive({
  id: null,
  name: '',
  branch: '',
  parentCompany: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  paymentTerms: '',
  leadTimeDays: 0,
  businessHours: '',
  mapLink: '',
  notes: '',
  isActive: true,
  brandIds: [],
})

const paymentTermsOptions = [
  { value: '1_month', label: { en: '1 Month', cn: '1 个月' } },
  { value: '2_months', label: { en: '2 Months', cn: '2 个月' } },
  { value: '3_months', label: { en: '3 Months', cn: '3 个月' } },
  { value: '4_months', label: { en: '4 Months', cn: '4 个月' } },
  { value: 'others', label: { en: 'Others', cn: '其他' } },
]

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

async function loadSupplierList() {
  try {
    const { data } = await api.get('/suppliers', { params: { pageSize: 200 } })
    supplierList.value = (data.items || []).filter(s => s.id !== form.id)
  } catch {
    // ignore
  }
}

async function loadBrandsList() {
  try {
    const { data } = await api.get('/brands', { params: { all: 'true', status: 'active' } })
    brands.value = data.items || []
  } catch {
    // ignore
  }
}

async function loadSupplier(id) {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get(`/suppliers/${id}`)
    Object.assign(form, {
      id: data.supplier.id,
      name: data.supplier.name,
      branch: data.supplier.branch || '',
      parentCompany: data.supplier.parent_company || '',
      contactName: data.supplier.contact_name || '',
      phone: data.supplier.phone || '',
      email: data.supplier.email || '',
      address: data.supplier.address || '',
      paymentTerms: data.supplier.payment_terms || '',
      leadTimeDays: Number(data.supplier.lead_time_days || 0),
      businessHours: data.supplier.business_hours || '',
      mapLink: data.supplier.map_link || '',
      notes: data.supplier.notes || '',
      isActive: Boolean(data.supplier.is_active),
      brandIds: Array.isArray(data.brands) ? data.brands.map(b => Number(b.id)) : [],
    })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load supplier.', '加载供应商失败。')
  } finally {
    loading.value = false
  }
}

async function saveSupplier() {
  errorMessage.value = ''
  loading.value = true
  try {
    const payload = {
      name: form.name,
      branch: form.branch,
      parentCompany: form.parentCompany,
      contactName: form.contactName,
      phone: form.phone,
      email: form.email,
      address: form.address,
      paymentTerms: form.paymentTerms,
      leadTimeDays: Number(form.leadTimeDays || 0),
      businessHours: form.businessHours,
      mapLink: form.mapLink,
      notes: form.notes,
      isActive: form.isActive,
      brandIds: Array.isArray(form.brandIds) ? form.brandIds.map(Number) : [],
    }

    if (form.id) {
      await api.put(`/suppliers/${form.id}`, payload)
    } else {
      await api.post('/suppliers', payload)
    }

    router.push({ name: 'suppliers' })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to save supplier.', '保存供应商失败。')
  } finally {
    loading.value = false
  }
}

function cancel() {
  router.push({ name: 'suppliers' })
}

onMounted(() => {
  const id = route.query.id ? Number(route.query.id) : null
  loadSupplierList()
  loadBrandsList()
  if (id) {
    loadSupplier(id)
  }
})
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Master Data</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">
            {{ form.id ? tr('Edit supplier', '编辑供应商') : tr('Add supplier', '新增供应商') }}
          </h2>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          @click="cancel"
        >
          {{ tr('Back to list', '返回列表') }}
        </button>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <form class="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5" @submit.prevent="saveSupplier">
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Company Name (was Supplier Name) -->
          <div class="relative sm:col-span-2">
            <input v-model="form.name" type="text" placeholder=" " required class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Company name', '公司名称') }} *
            </label>
          </div>

          <!-- Branch -->
          <div class="relative">
            <input v-model="form.branch" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Branch', '分公司') }}
            </label>
          </div>

          <!-- Under Company (Parent Company) - Select from supplier list -->
          <div class="relative">
            <select v-model="form.parentCompany" class="peer w-full rounded-2xl border border-slate-200 bg-white px-4 pb-2 pt-5 text-sm outline-none focus:border-brand-500">
              <option value="">{{ tr('None', '无') }}</option>
              <option v-for="s in supplierList" :key="s.id" :value="s.name">
                {{ s.name }}{{ s.branch ? ` (${s.branch})` : '' }}
              </option>
            </select>
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500">
              {{ tr('Under company', '母公司') }}
            </label>
          </div>

          <!-- Contact Person -->
          <div class="relative">
            <input v-model="form.contactName" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Contact person', '联系人') }}
            </label>
          </div>

          <!-- Phone -->
          <div class="relative">
            <input v-model="form.phone" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Phone', '电话') }}
            </label>
          </div>

          <!-- Email -->
          <div class="relative">
            <input v-model="form.email" type="email" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Email', '邮箱') }}
            </label>
          </div>

          <!-- Business Hours -->
          <div class="relative">
            <input v-model="form.businessHours" type="text" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Business hours', '营业时间') }}
            </label>
          </div>

          <!-- Lead Time -->
          <div class="relative">
            <input v-model="form.leadTimeDays" type="number" min="0" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Lead time (days)', '交货周期（天）') }}
            </label>
          </div>

          <!-- Payment Terms (Selection) -->
          <div class="relative sm:col-span-2">
            <select v-model="form.paymentTerms" class="peer w-full rounded-2xl border border-slate-200 bg-white px-4 pb-2 pt-5 text-sm outline-none focus:border-brand-500">
              <option value="" disabled>{{ tr('Select payment terms', '选择付款条件') }}</option>
              <option v-for="opt in paymentTermsOptions" :key="opt.value" :value="opt.value">
                {{ tr(opt.label.en, opt.label.cn) }}
              </option>
            </select>
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500">
              {{ tr('Payment terms', '付款条件') }}
            </label>
          </div>

          <!-- Map Link -->
          <div class="relative sm:col-span-2">
            <input v-model="form.mapLink" type="url" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Map link', '地图链接') }}
            </label>
          </div>

          <!-- Address -->
          <div class="relative sm:col-span-2">
            <textarea v-model="form.address" rows="3" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Address', '地址') }}
            </label>
          </div>

          <!-- Notes -->
          <div class="relative sm:col-span-2">
            <textarea v-model="form.notes" rows="3" placeholder=" " class="peer w-full rounded-2xl border border-slate-200 px-4 pb-2 pt-5 outline-none focus:border-brand-500" />
            <label class="pointer-events-none absolute left-4 top-3 text-xs text-slate-500 transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-3 peer-focus:text-xs peer-focus:text-slate-500">
              {{ tr('Notes', '备注') }}
            </label>
          </div>

          <!-- Brands responsible -->
          <div class="sm:col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {{ tr('Brands represented', '代理品牌') }}
            </p>
            <p v-if="!brands.length" class="mt-2 text-sm text-slate-400">
              {{ tr('No brands available. Create brands in Master Data → Brands.', '暂无品牌，请先到 主数据 → 品牌 中创建。') }}
            </p>
            <div v-else class="mt-3 flex flex-wrap gap-2">
              <label
                v-for="b in brands"
                :key="b.id"
                class="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:border-brand-400"
                :class="form.brandIds.includes(Number(b.id)) ? 'border-brand-500 bg-brand-50 text-brand-700' : ''"
              >
                <input
                  type="checkbox"
                  :value="Number(b.id)"
                  v-model="form.brandIds"
                  class="size-3.5 rounded border-slate-300"
                />
                <span>{{ b.name }}</span>
              </label>
            </div>
          </div>

          <!-- Active -->
          <label class="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <input v-model="form.isActive" type="checkbox" class="size-4 rounded border-slate-300" />
            {{ tr('Active supplier', '启用供应商') }}
          </label>
        </div>

        <div class="mt-5 flex gap-3">
          <button class="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" :disabled="loading">
            {{ loading ? tr('Saving...', '保存中...') : tr('Save', '保存') }}
          </button>
          <button type="button" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700" @click="cancel">
            {{ tr('Cancel', '取消') }}
          </button>
        </div>
      </form>
    </section>
  </AppLayout>
</template>
