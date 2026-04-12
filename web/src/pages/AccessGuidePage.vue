<script setup>
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth'
import { roleGuide } from '../constants/accessGuide'

const authStore = useAuthStore()
</script>

<template>
  <AppLayout>
    <section>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Roles</p>
      <h2 class="mt-2 text-3xl font-semibold text-slate-900">功能与权限说明</h2>
      <p class="mt-3 max-w-3xl text-sm text-slate-500">
        这里说明每个角色在系统里能看到什么、能操作什么，方便培训和日常交接。
      </p>

      <div class="mt-6 grid gap-5 xl:grid-cols-3">
        <article
          v-for="item in roleGuide"
          :key="item.role"
          class="rounded-3xl border p-5"
          :class="
            authStore.user?.role === item.role
              ? 'border-brand-300 bg-brand-50'
              : 'border-slate-200 bg-white'
          "
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm uppercase tracking-[0.25em] text-slate-400">{{ item.role }}</p>
              <h3 class="mt-2 text-2xl font-semibold text-slate-900">{{ item.title }}</h3>
            </div>
            <span
              v-if="authStore.user?.role === item.role"
              class="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
            >
              当前角色
            </span>
          </div>

          <p class="mt-4 text-sm leading-6 text-slate-600">{{ item.summary }}</p>

          <div class="mt-5 space-y-3">
            <div
              v-for="permission in item.permissions"
              :key="permission"
              class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            >
              {{ permission }}
            </div>
          </div>
        </article>
      </div>
    </section>
  </AppLayout>
</template>
