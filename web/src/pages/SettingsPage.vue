<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import api from '../services/api'
import HelpHint from '../components/HelpHint.vue'
import { useAuthStore } from '../stores/auth'
import { useCurrencyStore } from '../stores/currency'
import { useLocaleStore } from '../stores/locale'
import { useToastStore } from '../stores/toast'

const authStore = useAuthStore()
const currencyStore = useCurrencyStore()
const localeStore = useLocaleStore()
const toastStore = useToastStore()
const loading = ref(false)
const savingPriceChange = ref(false)
const savingPreferences = ref(false)
const errorMessage = ref('')
const priceChangeForm = reactive({
  thresholdPercent: 10,
  enabled: true,
  roles: ['ADMIN', 'MANAGER'],
})
const preferenceForm = reactive({
  currency: 'MYR',
})

const canManagePriceChange = computed(() => authStore.user?.role === 'ADMIN')

function tr(en, cn) {
  return localeStore.locale === 'en' ? en : cn
}

async function loadPriceChangeSettings() {
  const { data } = await api.get('/settings/price-change')
  priceChangeForm.thresholdPercent = data.thresholdPercent
  priceChangeForm.enabled = data.enabled
  priceChangeForm.roles = data.roles
}

async function loadPreferences() {
  const { data } = await api.get('/settings/preferences')
  preferenceForm.currency = data.currency || 'MYR'
  currencyStore.setCurrency(preferenceForm.currency)
}

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''
  try {
    await loadPreferences()
    if (canManagePriceChange.value) {
      await loadPriceChangeSettings()
    }
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to load settings.', '加载设置失败。')
  } finally {
    loading.value = false
  }
}

function toggleRole(role) {
  if (priceChangeForm.roles.includes(role)) {
    priceChangeForm.roles = priceChangeForm.roles.filter((item) => item !== role)
    return
  }
  priceChangeForm.roles = [...priceChangeForm.roles, role]
}

async function savePreferences() {
  savingPreferences.value = true
  errorMessage.value = ''
  try {
    await api.put('/settings/preferences', {
      currency: preferenceForm.currency,
    })
    currencyStore.setCurrency(preferenceForm.currency)
    toastStore.pushToast({ tone: 'success', message: tr('Preferences saved.', '偏好设置已保存。') })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to save settings.', '保存设置失败。')
  } finally {
    savingPreferences.value = false
  }
}

async function savePriceChange() {
  savingPriceChange.value = true
  errorMessage.value = ''
  try {
    await api.put('/settings/price-change', {
      thresholdPercent: Number(priceChangeForm.thresholdPercent),
      enabled: Boolean(priceChangeForm.enabled),
      roles: priceChangeForm.roles,
    })
    toastStore.pushToast({ tone: 'success', message: tr('Settings saved.', '设置已保存。') })
    await loadPriceChangeSettings()
  } catch (error) {
    errorMessage.value = error.response?.data?.message || tr('Failed to save settings.', '保存设置失败。')
  } finally {
    savingPriceChange.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">{{ tr('Governance', '治理') }}</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">{{ tr('System settings', '系统设置') }}</h2>
          <p class="mt-2 text-sm text-slate-500">{{ tr('Manage preferences and policy.', '管理个人偏好与系统策略。') }}</p>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ errorMessage }}
      </p>

      <div v-if="loading" class="mt-6 rounded-3xl border border-slate-200 px-4 py-4 text-sm text-slate-500">
        {{ tr('Loading...', '加载中...') }}
      </div>

      <div v-else class="mt-6 space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="flex items-center gap-2 text-xl font-semibold text-slate-900">
                {{ tr('Preferences', '个人偏好') }}
                <HelpHint :text="tr('Saved to your account and applied next login.', '保存到账号，下次登录自动生效。')" />
              </h3>
              <p class="mt-1 text-sm text-slate-500">{{ tr('Choose currency display for prices.', '选择价格显示的货币单位。') }}</p>
            </div>
            <button
              class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="savingPreferences"
              @click="savePreferences"
            >
              {{ savingPreferences ? tr('Saving...', '保存中...') : tr('Save', '保存') }}
            </button>
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div class="rounded-3xl border border-slate-200 bg-white p-4">
              <p class="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {{ tr('Currency', '货币') }}
                <HelpHint :text="tr('Controls how prices are displayed across the app.', '控制整个系统价格显示的单位。')" />
              </p>
              <p class="mt-1 text-xs text-slate-500">{{ tr('Used across products and dashboard.', '用于商品与仪表盘等所有价格。') }}</p>
              <select
                v-model="preferenceForm.currency"
                class="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
              >
                <option value="MYR">MYR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </div>

        <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="flex items-center gap-2 text-xl font-semibold text-slate-900">
                {{ tr('Price change alerts', '价格变动提醒') }}
                <HelpHint :text="tr('Create notifications when cost price changes exceed threshold.', '当成本变动超过阈值时自动生成提醒。')" />
              </h3>
              <p class="mt-1 text-sm text-slate-500">
                {{ tr('Notifications are generated when cost price changes exceed the threshold.', '当成本变动超过阈值时自动生成提醒。') }}
              </p>
            </div>
            <button
              v-if="canManagePriceChange"
              class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="savingPriceChange"
              @click="savePriceChange"
            >
              {{ savingPriceChange ? tr('Saving...', '保存中...') : tr('Save', '保存') }}
            </button>
          </div>

          <p v-if="!canManagePriceChange" class="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
            {{ tr('Only admins can edit this section.', '仅管理员可编辑此项。') }}
          </p>

          <label class="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <input v-model="priceChangeForm.enabled" type="checkbox" class="size-4 rounded border-slate-300" :disabled="!canManagePriceChange" />
            {{ tr('Enable notifications', '启用通知') }}
          </label>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div class="rounded-3xl border border-slate-200 bg-white p-4">
              <p class="text-sm font-semibold text-slate-900">{{ tr('Threshold (%)', '阈值（%）') }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ tr('Absolute percent change.', '按绝对百分比计算。') }}</p>
              <input
                v-model="priceChangeForm.thresholdPercent"
                type="number"
                min="0"
                step="0.01"
                class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-500 disabled:bg-slate-100"
                :disabled="!canManagePriceChange"
              />
            </div>
            <div class="rounded-3xl border border-slate-200 bg-white p-4">
              <p class="text-sm font-semibold text-slate-900">{{ tr('Notify roles', '通知角色') }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ tr('Who should receive notifications.', '哪些角色会收到提醒。') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-full border px-4 py-2 text-sm font-semibold"
                  :class="priceChangeForm.roles.includes('ADMIN') ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'"
                  :disabled="!priceChangeForm.enabled || !canManagePriceChange"
                  @click="toggleRole('ADMIN')"
                >
                  ADMIN
                </button>
                <button
                  type="button"
                  class="rounded-full border px-4 py-2 text-sm font-semibold"
                  :class="priceChangeForm.roles.includes('MANAGER') ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'"
                  :disabled="!priceChangeForm.enabled || !canManagePriceChange"
                  @click="toggleRole('MANAGER')"
                >
                  MANAGER
                </button>
                <button
                  type="button"
                  class="rounded-full border px-4 py-2 text-sm font-semibold"
                  :class="priceChangeForm.roles.includes('STAFF') ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'"
                  :disabled="!priceChangeForm.enabled || !canManagePriceChange"
                  @click="toggleRole('STAFF')"
                >
                  STAFF
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
            <p class="text-sm font-semibold text-slate-900">{{ tr('Preview', '预览') }}</p>
            <p class="mt-1 text-sm text-slate-600">
              {{
                priceChangeForm.enabled
                  ? tr(
                      `When cost change >= ${Number(priceChangeForm.thresholdPercent || 0).toFixed(2)}%, create notifications for: ${priceChangeForm.roles.join(', ') || '—'}.`,
                      `当成本变动 >= ${Number(priceChangeForm.thresholdPercent || 0).toFixed(2)}% 时，向以下角色发出提醒：${priceChangeForm.roles.join('、') || '—'}。`,
                    )
                  : tr('Notifications are disabled.', '通知已关闭。')
              }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
