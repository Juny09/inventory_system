<script setup>
import AppLayout from '../layouts/AppLayout.vue'
import { useLocaleStore } from '../stores/locale'

const localeStore = useLocaleStore()
</script>

<template>
  <AppLayout>
    <section>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">
        {{ localeStore.locale === 'en' ? 'Learning' : '教学' }}
      </p>
      <h2 class="mt-2 text-3xl font-semibold text-slate-900">
        {{ localeStore.locale === 'en' ? 'Tutorial Center' : '教学中心' }}
      </h2>
      <p class="mt-2 text-sm text-slate-500">
        {{
          localeStore.locale === 'en'
            ? 'Step-by-step guides for linking marketplace stores and running daily operations.'
            : '提供店铺接入与日常运营的分步骤教学。'
        }}
      </p>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <article class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 class="text-xl font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Store Connection Steps' : '店铺接入步骤' }}
          </h3>
          <ol class="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>{{ localeStore.locale === 'en' ? 'Create API app in Shopee/Lazada/TikTok seller center.' : '在 Shopee/Lazada/TikTok 卖家后台创建 API 应用。' }}</li>
            <li>{{ localeStore.locale === 'en' ? 'Get API base URL and access token from your app.' : '获取 API Base URL 与 Access Token。' }}</li>
            <li>{{ localeStore.locale === 'en' ? 'Save connection via Marketplace API endpoint.' : '通过 Marketplace 配置接口保存连接参数。' }}</li>
            <li>{{ localeStore.locale === 'en' ? 'Run inventory and order sync.' : '执行库存同步与订单同步。' }}</li>
          </ol>
        </article>

        <article class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 class="text-xl font-semibold text-slate-900">
            {{ localeStore.locale === 'en' ? 'Useful API Examples' : '常用接口示例' }}
          </h3>
          <div class="mt-4 space-y-2 text-sm text-slate-700">
            <p><code>PUT /api/marketplace/connections/shopee</code></p>
            <p><code>POST /api/marketplace/sync/shopee</code></p>
            <p><code>POST /api/orders/sync/shopee</code></p>
            <p><code>POST /api/shipping/shipments/:orderId/create</code></p>
          </div>
        </article>
      </div>
    </section>
  </AppLayout>
</template>
