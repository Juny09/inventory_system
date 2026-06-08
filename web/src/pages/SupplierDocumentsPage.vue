<template>
  <AppLayout>
    <section>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Suppliers</p>
          <h2 class="mt-2 text-3xl font-semibold text-slate-900">Supplier Documents</h2>
          <p class="mt-2 text-sm text-slate-500">
            Record delivery orders, invoices, and returns / claim / repair documents issued by suppliers.
          </p>
        </div>
      </div>

      <div class="mt-6 flex gap-1 border-b border-slate-200">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="-mb-px px-4 py-2 text-sm font-medium"
          :class="activeTab === tab.key
            ? 'border-b-2 border-indigo-600 text-indigo-700'
            : 'text-slate-500 hover:text-slate-700'"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Stats cards -->
      <div class="mt-4 grid grid-cols-3 gap-4">
        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">Delivery Orders</p>
          <p class="mt-1 text-2xl font-bold text-slate-800">{{ counts.do }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">Invoices</p>
          <p class="mt-1 text-2xl font-bold text-slate-800">{{ counts.invoice }}</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p class="text-xs text-slate-500">Returns / Claim / Repair</p>
          <p class="mt-1 text-2xl font-bold text-slate-800">{{ counts.returns }}</p>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="searchInput"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
            @keyup.enter="applySearch"
          />
          <select
            v-model.number="yearFilter"
            class="rounded border border-slate-300 px-3 py-2 text-sm"
            @change="loadList(1)"
          >
            <option :value="0">All years</option>
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
          <select
            v-model.number="monthFilter"
            class="rounded border border-slate-300 px-3 py-2 text-sm"
            @change="loadList(1)"
          >
            <option :value="0">All months</option>
            <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
          </select>
          <select
            v-if="activeTab === 'returns'"
            v-model="docTypeFilter"
            class="rounded border border-slate-300 px-3 py-2 text-sm"
            @change="loadList(1)"
          >
            <option value="">All types</option>
            <option value="RETURN">Return</option>
            <option value="CLAIM">Claim</option>
            <option value="REPAIR">Repair</option>
          </select>
          <button type="button" class="rounded border border-slate-300 px-3 py-2 text-sm" @click="applySearch">
            Search
          </button>
          <button
            v-if="searchInput || yearFilter || monthFilter || docTypeFilter"
            type="button"
            class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
            @click="resetFilters"
          >
            Reset
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            ref="scanFileInputRef"
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleScanFileChange"
          />
          <button
            type="button"
            class="rounded border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="scanLoading"
            @click="triggerScanUpload"
          >
            {{ scanLoading ? 'Recognizing...' : 'Scan DO / Invoice' }}
          </button>
          <button
            type="button"
            class="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            @click="openCreate"
          >
            + New {{ currentTabLabelSingular }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {{ errorMessage }}
      </p>
      <p v-if="scanErrorMessage" class="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
        {{ scanErrorMessage }}
      </p>
      <div
        v-if="parsedDraft?.imported_from_scan && (modal === 'do' || modal === 'invoice')"
        class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800"
      >
        <div>
          <span class="font-medium">识别后已打开表单。</span>
          <span class="ml-1">如果类型判断不准，可以手动切换成正确的 DO / Invoice。</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded border px-3 py-1.5 text-xs font-semibold transition"
            :class="parsedDraft?.type === 'delivery_order'
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100'"
            @click="switchParsedDraftType('delivery_order')"
          >
            切换为 DO
          </button>
          <button
            type="button"
            class="rounded border px-3 py-1.5 text-xs font-semibold transition"
            :class="parsedDraft?.type === 'invoice'
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100'"
            @click="switchParsedDraftType('invoice')"
          >
            切换为 Invoice
          </button>
        </div>
      </div>
      <div
        v-if="parsedDraft?.imported_from_scan && scanLowConfidenceItems.length > 0 && (modal === 'do' || modal === 'invoice')"
        class="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-semibold">发现 {{ scanLowConfidenceItems.length }} 条低置信度 Item，建议优先人工复核。</p>
            <p class="mt-1 text-xs text-rose-700">已按风险排序显示在 OCR 面板和表单里，点击下面任一项可直接跳过去。</p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="item in scanLowConfidenceItems"
            :key="item.key"
            type="button"
            class="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            @click="setScanReviewFocus(item.key, { triggerScroll: true })"
          >
            {{ item.label }} · {{ item.confidence?.label || '低' }}
          </button>
        </div>
      </div>
      <button
        v-if="parsedDraft?.imported_from_scan && !scanReviewExpanded && (modal === 'do' || modal === 'invoice')"
        type="button"
        class="fixed bottom-4 right-4 z-[110] rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-lg hover:bg-indigo-50"
        @click="scanReviewExpanded = true"
      >
        打开 OCR 核对
      </button>
      <aside
        v-if="showScanReviewPanel"
        class="fixed inset-y-4 right-4 z-[110] w-[min(430px,calc(100vw-2rem))]"
      >
        <div class="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-900">OCR 核对面板</h3>
              <p class="text-xs text-slate-500">边看原图 / Raw text，边检查表单有没有识别错。</p>
            </div>
            <button
              type="button"
              class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              @click="scanReviewExpanded = false"
            >
              隐藏
            </button>
          </div>
          <div class="flex-1 space-y-4 overflow-y-auto p-4">
            <div v-if="scanTraceContext" class="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-amber-700">追查模式</p>
                  <p class="mt-1 text-sm font-semibold text-amber-900">
                    当前正在追查 {{ scanTraceContext.itemLabel || '某条确认记录' }}
                  </p>
                  <p class="mt-1 text-xs text-amber-800">
                    {{ scanTraceContext.documentLabel || '单据确认记录' }}
                    <span v-if="scanTraceContext.userLabel" class="ml-1">· {{ scanTraceContext.userLabel }}</span>
                    <span v-if="scanTraceContext.timeLabel" class="ml-1">· {{ scanTraceContext.timeLabel }}</span>
                  </p>
                </div>
                <button
                  type="button"
                  class="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                  @click="clearScanTraceMode()"
                >
                  退出追查模式
                </button>
              </div>
              <div v-if="scanTraceComparison" class="mt-3 rounded-lg border border-amber-200 bg-white/80 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-amber-900">历史确认摘要</p>
                  <div class="flex flex-wrap gap-2 text-[11px]">
                    <span class="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      历史 OCR {{ scanTraceComparison.historicalConfidence }}
                    </span>
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                      当前 OCR {{ scanTraceComparison.currentConfidence }}
                    </span>
                  </div>
                </div>
                <div class="mt-3 grid gap-2">
                  <div
                    v-for="field in scanTraceComparison.fields"
                    :key="field.key"
                    class="rounded border px-3 py-2"
                    :class="field.changed ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50/70'"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-xs font-semibold text-slate-800">{{ field.label }}</p>
                      <span
                        class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        :class="field.changed ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'"
                      >
                        {{ field.changed ? '已变更' : '一致' }}
                      </span>
                    </div>
                    <div class="mt-2 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p class="text-slate-500">历史确认值</p>
                        <p class="mt-1 font-medium text-slate-900">{{ field.historicalDisplay }}</p>
                      </div>
                      <div>
                        <p class="text-slate-500">当前 OCR/表单值</p>
                        <p class="mt-1 font-medium" :class="field.changed ? 'text-rose-700' : 'text-emerald-700'">{{ field.currentDisplay }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500">File</p>
                  <p class="mt-1 break-all text-sm font-medium text-slate-800">{{ parsedDraft?.source_file_name || '—' }}</p>
                </div>
                <a
                  v-if="scanOriginalPreviewUrl"
                  :href="scanOriginalPreviewUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="text-xs font-medium text-indigo-600 hover:underline"
                >
                  新窗口打开
                </a>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded border border-slate-200 bg-white px-2 py-2">
                  <p class="text-slate-500">当前类型</p>
                  <p class="mt-1 font-semibold text-slate-800">{{ parsedDraft?.type === 'delivery_order' ? 'DO' : 'Invoice' }}</p>
                </div>
                <div class="rounded border border-slate-200 bg-white px-2 py-2">
                  <p class="text-slate-500">系统判断</p>
                  <p class="mt-1 font-semibold text-slate-800">{{ parsedDraft?.detected_type || 'unknown' }}</p>
                </div>
              </div>
            </div>

            <div v-if="scanLowConfidenceItems.length > 0" class="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-rose-700">优先检查</p>
                  <p class="mt-1 text-sm font-semibold text-rose-900">有 {{ scanLowConfidenceItems.length }} 条低置信度 Item。</p>
                  <p class="mt-1 text-xs text-rose-700">这些项目已自动标红，并排在前面方便你先检查。</p>
                </div>
              </div>
              <div class="mt-3 space-y-2">
                <button
                  v-for="item in scanLowConfidenceItems"
                  :key="`risk-${item.key}`"
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg border border-rose-300 bg-white px-3 py-2 text-left text-xs text-rose-800 hover:bg-rose-100"
                  @click="setScanReviewFocus(item.key, { triggerScroll: true, clearTrace: true })"
                >
                  <span class="font-semibold">{{ item.label }} · {{ item.value }}</span>
                  <span class="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">{{ item.confidence?.label || '低' }}</span>
                </button>
              </div>
            </div>

            <div v-if="scanReviewHighlights.length > 0" class="rounded-lg border border-slate-200 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500">重点核对字段</p>
                  <p class="mt-1 text-xs text-slate-500">点击某个 Item 后，只保留这个商品对应的 OCR 高亮。</p>
                </div>
                <button
                  type="button"
                  class="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  @click="setScanReviewFocus('all', { clearTrace: true })"
                >
                  显示全部
                </button>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-full border px-3 py-1 text-xs font-medium transition"
                  :class="scanReviewFocusKey === 'all'
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                  @click="setScanReviewFocus('all', { clearTrace: true })"
                >
                  全部字段
                </button>
                <button
                  v-for="highlight in scanReviewHighlights"
                  :key="highlight.key"
                  type="button"
                  class="rounded-full border px-3 py-1 text-xs font-medium transition"
                  :class="scanReviewFocusKey === highlight.key
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'"
                  @click="setScanReviewFocus(highlight.key, { clearTrace: true })"
                >
                  {{ highlight.label }}: {{ highlight.value }}
                </button>
              </div>
              <div v-if="scanItemFocusOptions.length > 0" class="mt-4">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">按 Item 聚焦</p>
                <div class="mt-2 space-y-2">
                  <button
                    v-for="itemOption in scanItemFocusOptions"
                    :key="itemOption.key"
                    type="button"
                    class="w-full rounded-lg border px-3 py-2 text-left text-xs transition"
                    :class="scanReviewFocusKey === itemOption.key
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
                    @click="setScanReviewFocus(itemOption.key, { clearTrace: true })"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <span class="font-semibold">{{ itemOption.label }}</span>
                        <span class="ml-2">{{ itemOption.value }}</span>
                      </div>
                      <span
                        v-if="itemOption.confidence"
                        class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        :class="confidenceBadgeClass(itemOption.confidence.level)"
                      >
                        {{ itemOption.confidence.label }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="scanIsImageFile && scanOriginalPreviewUrl" class="rounded-lg border border-slate-200 p-3">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">原图</p>
              <div class="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img :src="scanOriginalPreviewUrl" alt="原图预览" class="block max-h-[360px] w-full object-contain" />
              </div>
            </div>

            <div v-if="scanIsPdfFile && scanOriginalPreviewUrl" class="rounded-lg border border-slate-200 p-3">
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500">PDF 预览</p>
              <div class="mt-3 overflow-hidden rounded-lg border border-slate-200">
                <iframe :src="scanOriginalPreviewUrl" title="PDF preview" class="h-[360px] w-full bg-white"></iframe>
              </div>
            </div>

            <div v-if="scanOcrPreviewUrl" class="rounded-lg border border-slate-200 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500">OCR 高亮图</p>
                  <p class="mt-1 text-xs text-slate-500">当前只显示：{{ scanFocusLabel }} 对应的 OCR 文字区域。</p>
                </div>
                <span class="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
                  {{ scanImageHighlightBoxes.length }} 处高亮
                </span>
              </div>
              <div class="relative mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img :src="scanOcrPreviewUrl" alt="OCR highlight preview" class="block w-full" />
                <button
                  v-for="box in scanImageHighlightBoxes"
                  :key="box.key"
                  type="button"
                  class="absolute rounded border-2 bg-amber-200/20 transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  :class="box.isItemFocus ? 'cursor-pointer border-amber-500 hover:bg-amber-300/30' : 'cursor-default border-slate-300/70'"
                  :style="box.style"
                  :title="box.title"
                  @click="handleScanHighlightBoxClick(box)"
                >
                  <span class="sr-only">{{ box.title }}</span>
                </button>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Raw Text</p>
                  <p class="mt-1 text-xs text-slate-500">当前高亮范围：{{ scanFocusLabel }}</p>
                </div>
              </div>
              <pre class="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700" v-html="highlightedRawText"></pre>
            </div>
          </div>
        </div>
      </aside>

      <!-- Top Pagination -->
      <PaginationBar v-if="pagination.totalPages > 1" class="mt-3" :pagination="pagination" @change="loadList" />

      <div class="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div v-if="loading" class="px-5 py-6 text-sm text-slate-500">Loading...</div>

        <!-- Delivery Orders table -->
        <div v-else-if="activeTab === 'do'" class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('do_no')">
                  DO No
                  <span v-if="sortField === 'do_no'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('do_date')">
                  Date
                  <span v-if="sortField === 'do_date'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('supplier_name')">
                  Supplier
                  <span v-if="sortField === 'supplier_name'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 text-right">Items</th>
                <th class="px-4 py-3 text-right">Attachments</th>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('created_at')">
                  Created
                  <span v-if="sortField === 'created_at'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in items" :key="row.id" class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-900">{{ row.do_no }}</td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(row.do_date) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.supplier_company_name || row.supplier_name || '—' }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.item_count || 0 }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.attachment_count || 0 }}</td>
                <td class="px-4 py-3 text-slate-500">{{ formatDateTime(row.created_at) }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button class="text-xs text-indigo-600 hover:underline" @click="openEdit(row.id)">Edit</button>
                    <button class="text-xs text-red-600 hover:underline" @click="removeRow(row.id)">Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="7" class="px-4 py-8 text-center text-sm text-slate-400">No delivery orders yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Invoices table -->
        <div v-else-if="activeTab === 'invoice'" class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('invoice_no')">
                  Invoice No
                  <span v-if="sortField === 'invoice_no'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('invoice_date')">
                  Date
                  <span v-if="sortField === 'invoice_date'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('supplier_name')">
                  Supplier
                  <span v-if="sortField === 'supplier_name'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('do_no')">
                  Ref DO
                  <span v-if="sortField === 'do_no'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 text-right">Total Qty</th>
                <th class="px-4 py-3 text-right">Total Amount</th>
                <th class="px-4 py-3 text-right">Att.</th>
                <th class="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in items" :key="row.id" class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-900">{{ row.invoice_no }}</td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(row.invoice_date) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.supplier_company_name || row.supplier_name || '—' }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.do_no || '—' }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ formatNumber(row.total_quantity) }}</td>
                <td class="px-4 py-3 text-right font-medium text-slate-900">{{ formatMoney(row.total_amount) }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.attachment_count || 0 }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button class="text-xs text-indigo-600 hover:underline" @click="openEdit(row.id)">Edit</button>
                    <button class="text-xs text-red-600 hover:underline" @click="removeRow(row.id)">Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="8" class="px-4 py-8 text-center text-sm text-slate-400">No invoices yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Returns table -->
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('document_no')">
                  Document No
                  <span v-if="sortField === 'document_no'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('document_date')">
                  Date
                  <span v-if="sortField === 'document_date'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 cursor-pointer" @click="sortBy('supplier_name')">
                  Supplier
                  <span v-if="sortField === 'supplier_name'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-4 py-3 text-right">Items</th>
                <th class="px-4 py-3 text-right">Att.</th>
                <th class="px-4 py-3 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in items" :key="row.id" class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-900">{{ row.document_no }}</td>
                <td class="px-4 py-3">
                  <span class="rounded px-2 py-0.5 text-xs font-semibold" :class="docTypeClass(row.doc_type)">
                    {{ row.doc_type }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(row.document_date) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.supplier_company_name || row.supplier_name || '—' }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.item_count || 0 }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ row.attachment_count || 0 }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button class="text-xs text-indigo-600 hover:underline" @click="openEdit(row.id)">Edit</button>
                    <button class="text-xs text-red-600 hover:underline" @click="removeRow(row.id)">Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="7" class="px-4 py-8 text-center text-sm text-slate-400">No documents yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <PaginationBar :pagination="pagination" @change="loadList" />
      </div>
    </section>

    <DeliveryOrderFormModal
      v-if="modal === 'do'"
      :id="editingId"
      :suppliers="suppliers"
      :initial-data="parsedDraft"
      :scan-focus-key="scanReviewFocusKey"
      :scan-focus-request-id="scanFocusRequestId"
      @close="closeModal"
      @saved="onSaved"
      @scan-item-selected="onScanItemSelected"
      @scan-trace-cleared="clearScanTraceMode"
    />
    <SupplierInvoiceFormModal
      v-if="modal === 'invoice'"
      :id="editingId"
      :suppliers="suppliers"
      :initial-data="parsedDraft"
      :scan-focus-key="scanReviewFocusKey"
      :scan-focus-request-id="scanFocusRequestId"
      @close="closeModal"
      @saved="onSaved"
      @scan-item-selected="onScanItemSelected"
      @scan-trace-cleared="clearScanTraceMode"
    />
    <SupplierReturnFormModal
      v-if="modal === 'returns'"
      :id="editingId"
      :suppliers="suppliers"
      @close="closeModal"
      @saved="onSaved"
    />
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import PaginationBar from '../components/PaginationBar.vue'
import DeliveryOrderFormModal from '../components/DeliveryOrderFormModal.vue'
import SupplierInvoiceFormModal from '../components/SupplierInvoiceFormModal.vue'
import SupplierReturnFormModal from '../components/SupplierReturnFormModal.vue'
import api from '../services/api'
import { useToastStore } from '../stores/toast'

const sortField = ref('do_no')
const sortOrder = ref('asc')

watch([sortField, sortOrder], ([field, order]) => {
  localStorage.setItem('supplier_docs_sort_field', field)
  localStorage.setItem('supplier_docs_sort_order', order)
})

function sortBy(field) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'desc'
  }
  loadList(1)
}

const toastStore = useToastStore()

const tabs = [
  { key: 'do', label: 'Delivery Orders', singular: 'Delivery Order', resource: '/delivery-orders' },
  { key: 'invoice', label: 'Invoices', singular: 'Invoice', resource: '/supplier-invoices' },
  { key: 'returns', label: 'Returns / Claim / Repair', singular: 'Return / Claim / Repair', resource: '/supplier-returns' },
]

const activeTab = ref('do')
const searchInput = ref('')
const search = ref('')
const docTypeFilter = ref('')
const yearFilter = ref(0)
const monthFilter = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const items = ref([])
const pagination = ref({ total: 0, page: 1, pageSize: 15, totalPages: 1 })
const suppliers = ref([])
const modal = ref(null) // 'po' | 'invoice' | 'returns' | null
const editingId = ref(null)
const parsedDraft = ref(null)
const scanLoading = ref(false)
const scanErrorMessage = ref('')
const scanFileInputRef = ref(null)
const scanReviewExpanded = ref(false)
const scanReviewFocusKey = ref('all')
const scanFocusRequestId = ref(0)
const scanTraceContext = ref(null)

const counts = ref({ do: 0, invoice: 0, returns: 0 })

const currentTab = computed(() => tabs.find((t) => t.key === activeTab.value))
const currentTabLabelSingular = computed(() => currentTab.value?.singular || '')
const searchPlaceholder = computed(() => {
  if (activeTab.value === 'do') return 'Search DO no or supplier'
  if (activeTab.value === 'invoice') return 'Search invoice no or supplier'
  return 'Search document no or supplier'
})

const yearOptions = computed(() => {
  const current = new Date().getFullYear()
  const arr = []
  for (let y = current + 1; y >= current - 5; y--) arr.push(y)
  return arr
})

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
function monthName(m) {
  return MONTH_NAMES[m] || m
}

function toInputDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }
  return date.toLocaleDateString('en-CA')
}

function formatMatchedProductLabel(product) {
  if (!product) return ''
  const code = product.product_code || product.sku || ''
  const name = product.name || ''
  return [code, name].filter(Boolean).join(' · ')
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalizePreviewToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '')
}

function buildKeywordTokens(value, options = {}) {
  const raw = String(value || '').trim()
  if (!raw) return []
  const tokens = []

  if (options.includeWhole !== false) {
    tokens.push(raw)
  }

  const parts = raw
    .split(/[\s,;:/()#|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)

  if (parts.length > 0) {
    tokens.push(...parts.slice(0, options.maxParts || parts.length))
  }

  return uniqueValues(tokens)
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text, tokens) {
  const source = String(text || '')
  const usableTokens = uniqueValues(tokens)
    .map((token) => String(token || '').trim())
    .filter((token) => token.length >= 2)
    .sort((a, b) => b.length - a.length)

  if (!source) {
    return '<span style="color:#94a3b8;">暂无 OCR 原文。</span>'
  }

  if (usableTokens.length === 0) {
    return escapeHtml(source)
  }

  const pattern = new RegExp(usableTokens.map(escapeRegExp).join('|'), 'gi')
  let cursor = 0
  let html = ''
  let match

  while ((match = pattern.exec(source)) !== null) {
    const matchText = match[0]
    const start = match.index
    if (start > cursor) {
      html += escapeHtml(source.slice(cursor, start))
    }
    html += `<mark style="background:#fef08a;color:#854d0e;padding:0 2px;border-radius:3px;">${escapeHtml(matchText)}</mark>`
    cursor = start + matchText.length
  }

  if (cursor < source.length) {
    html += escapeHtml(source.slice(cursor))
  }

  return html
}

function resolveAssetUrl(assetPath) {
  if (!assetPath || typeof window === 'undefined') return ''
  if (/^https?:\/\//i.test(assetPath)) return assetPath
  const baseUrl = String(api.defaults.baseURL || '')
  if (baseUrl.startsWith('http')) {
    return new URL(assetPath, baseUrl).toString()
  }
  return new URL(assetPath, window.location.origin).toString()
}

function buildReviewHighlights(draft) {
  if (!draft) return []

  const highlights = []
  if (draft.document_no) {
    highlights.push({
      key: 'document-no',
      label: '单号',
      value: draft.document_no,
      tokens: buildKeywordTokens(draft.document_no, { maxParts: 3 }),
    })
  }
  if (draft.document_date) {
    highlights.push({
      key: 'document-date',
      label: '日期',
      value: draft.document_date,
      tokens: buildKeywordTokens(draft.document_date, { maxParts: 3 }),
    })
  }
  if (draft.supplier_name) {
    highlights.push({
      key: 'supplier-name',
      label: '供应商',
      value: draft.supplier_name,
      tokens: buildKeywordTokens(draft.supplier_name, { maxParts: 4 }),
    })
  }

  draft.items.slice(0, 6).forEach((item, index) => {
    const label = item.description || item.product_label || ''
    const qty = Number(item.quantity) || 0
    if (!label) return
    highlights.push({
      key: `item-${index}`,
      label: `Item ${index + 1}`,
      value: qty > 0 ? `${label} x ${qty}` : label,
      itemIndex: index,
      confidence: item?.ocr_confidence_label
        ? {
            percent: Number(item.ocr_confidence_percent) || 0,
            level: item.ocr_confidence_level || 'low',
            label: item.ocr_confidence_label,
          }
        : null,
      tokens: uniqueValues([
        ...buildKeywordTokens(label, { maxParts: 3 }),
        qty > 0 ? String(qty) : '',
      ]),
    })
  })

  return highlights
}

function resolveDraftType(parsedType) {
  if (parsedType === 'delivery_order' || parsedType === 'invoice') {
    return parsedType
  }
  if (activeTab.value === 'do') return 'delivery_order'
  if (activeTab.value === 'invoice') return 'invoice'
  return 'invoice'
}

function toModalTab(documentType) {
  return documentType === 'delivery_order' ? 'do' : 'invoice'
}

function normalizePositiveNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? Number(numberValue.toFixed(2)) : null
}

function deriveUnitPrice(item) {
  const extractedUnitPrice = normalizePositiveNumber(item?.extractedUnitPrice)
  if (extractedUnitPrice !== null) return extractedUnitPrice

  const quantity = Number(item?.extractedQuantity) || 0
  const extractedAmount = normalizePositiveNumber(item?.extractedAmount)
  if (quantity > 0 && extractedAmount !== null) {
    return Number((extractedAmount / quantity).toFixed(2))
  }
  return 0
}

function buildItemReviewTokens(item, matchedProduct) {
  const quantity = Number(item?.extractedQuantity) || 0
  return uniqueValues([
    ...buildKeywordTokens(item?.extractedDescription || matchedProduct?.name || '', { maxParts: 4 }),
    matchedProduct?.product_code || matchedProduct?.sku || '',
    quantity > 0 ? String(quantity) : '',
  ])
}

function computeConfidenceLevel(score) {
  if (score >= 85) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}

function formatConfidenceLabel(level, score) {
  const prefix = level === 'high' ? '高' : level === 'medium' ? '中' : '低'
  return `${prefix} ${score}%`
}

// 中文注释：把 OCR 单词命中率和 OCR 自带置信度合并成一个更直观的 item 评分。
function computeItemConfidence(tokens, ocrWords) {
  const normalizedTokens = uniqueValues(tokens)
    .map((token) => normalizePreviewToken(token))
    .filter(Boolean)

  if (normalizedTokens.length === 0 || !Array.isArray(ocrWords) || ocrWords.length === 0) {
    return {
      percent: 0,
      level: 'low',
      label: '低 0%',
      matchedWords: 0,
    }
  }

  const tokenSet = new Set(normalizedTokens)
  const matchedWords = ocrWords.filter((word) => tokenSet.has(normalizePreviewToken(word?.text)))
  if (matchedWords.length === 0) {
    return {
      percent: 0,
      level: 'low',
      label: '低 0%',
      matchedWords: 0,
    }
  }

  const matchedTokenSet = new Set(matchedWords.map((word) => normalizePreviewToken(word?.text)).filter(Boolean))
  const coverageScore = (matchedTokenSet.size / tokenSet.size) * 100
  const avgWordConfidence = matchedWords.reduce((sum, word) => sum + (Number(word?.confidence) || 0), 0) / matchedWords.length
  const finalScore = Math.max(0, Math.min(100, Math.round(avgWordConfidence * 0.7 + coverageScore * 0.3)))
  const level = computeConfidenceLevel(finalScore)

  return {
    percent: finalScore,
    level,
    label: formatConfidenceLabel(level, finalScore),
    matchedWords: matchedWords.length,
  }
}

function confidenceBadgeClass(level) {
  if (level === 'high') return 'bg-emerald-100 text-emerald-800'
  if (level === 'medium') return 'bg-amber-100 text-amber-800'
  return 'bg-rose-100 text-rose-800'
}

function isLowConfidenceLevel(level) {
  return level === 'low'
}

// 中文注释：把 OCR/解析结果转换成现有表单能直接吃的结构，做到“上传后直接弹出并自动带值”。
function buildParsedDraft(preview, documentType, sourceFile) {
  const normalizedType = documentType === 'delivery_order' ? 'delivery_order' : 'invoice'
  const ocrWords = Array.isArray(preview?.ocrWords) ? preview.ocrWords : []
  const items = Array.isArray(preview?.items)
    ? preview.items.map((item) => {
        const matchedProduct = item?.matchedProducts?.[0] || null
        const itemTokens = buildItemReviewTokens(item, matchedProduct)
        const confidence = computeItemConfidence(itemTokens, ocrWords)
        return {
          product_id: matchedProduct?.id || null,
          product_label: formatMatchedProductLabel(matchedProduct),
          item_code: matchedProduct?.product_code || matchedProduct?.sku || '',
          description: item?.extractedDescription || matchedProduct?.name || '',
          serial_no: '',
          quantity: Number(item?.extractedQuantity) || 1,
          unit_price: normalizedType === 'invoice' ? deriveUnitPrice(item) : 0,
          discount: 0,
          extracted_amount: normalizedType === 'invoice' ? normalizePositiveNumber(item?.extractedAmount) || 0 : 0,
          ocr_confidence_percent: confidence.percent,
          ocr_confidence_level: confidence.level,
          ocr_confidence_label: confidence.label,
          ocr_confidence_matched_words: confidence.matchedWords,
        }
      })
    : []

  return {
    imported_from_scan: true,
    source_file_name: preview?.fileName || '',
    source_file: sourceFile || null,
    supplier_id: preview?.matchedSupplier?.id ? String(preview.matchedSupplier.id) : '',
    supplier_name: preview?.matchedSupplier?.name || preview?.supplierName || '',
    warehouse_id: preview?.defaultWarehouse?.id ? String(preview.defaultWarehouse.id) : '',
    document_no: preview?.documentNumber || '',
    document_date: toInputDate(preview?.date) || new Date().toLocaleDateString('en-CA'),
    notes: preview?.fileName ? `Imported from document scan: ${preview.fileName}` : '',
    items,
    type: normalizedType,
    detected_type: preview?.documentType || 'unknown',
    raw_text: preview?.rawText || '',
    file_url: preview?.fileUrl || '',
    file_mime_type: preview?.fileMimeType || '',
    ocr_words: Array.isArray(preview?.ocrWords) ? preview.ocrWords : [],
    ocr_preview_url: preview?.ocrPreviewUrl || '',
    ocr_preview_width: Number(preview?.ocrPreviewWidth) || 0,
    ocr_preview_height: Number(preview?.ocrPreviewHeight) || 0,
  }
}

const showScanReviewPanel = computed(() => {
  return Boolean(parsedDraft.value?.imported_from_scan && scanReviewExpanded.value && (modal.value === 'do' || modal.value === 'invoice'))
})

const scanReviewHighlights = computed(() => buildReviewHighlights(parsedDraft.value))
const scanItemFocusOptions = computed(() => {
  return scanReviewHighlights.value
    .filter((item) => String(item.key || '').startsWith('item-'))
    .sort((a, b) => {
      const aScore = Number(a.confidence?.percent ?? 999)
      const bScore = Number(b.confidence?.percent ?? 999)
      return aScore - bScore
    })
})
const scanLowConfidenceItems = computed(() => {
  return scanItemFocusOptions.value.filter((item) => isLowConfidenceLevel(item.confidence?.level))
})
const scanActiveReviewHighlights = computed(() => {
  if (scanReviewFocusKey.value === 'all') {
    return scanReviewHighlights.value
  }
  const matched = scanReviewHighlights.value.find((item) => item.key === scanReviewFocusKey.value)
  return matched ? [matched] : scanReviewHighlights.value
})
const scanFocusLabel = computed(() => {
  if (scanReviewFocusKey.value === 'all') {
    return '全部字段'
  }
  return scanActiveReviewHighlights.value[0]?.value || '全部字段'
})
const scanHighlightTokens = computed(() => uniqueValues(scanActiveReviewHighlights.value.flatMap((item) => item.tokens || [])))
const highlightedRawText = computed(() => highlightText(parsedDraft.value?.raw_text || '', scanHighlightTokens.value))
const scanOriginalPreviewUrl = computed(() => resolveAssetUrl(parsedDraft.value?.file_url || ''))
const scanOcrPreviewUrl = computed(() => resolveAssetUrl(parsedDraft.value?.ocr_preview_url || ''))
const scanIsImageFile = computed(() => String(parsedDraft.value?.file_mime_type || '').startsWith('image/'))
const scanIsPdfFile = computed(() => parsedDraft.value?.file_mime_type === 'application/pdf')
const scanImageHighlightBoxes = computed(() => {
  const previewWidth = Number(parsedDraft.value?.ocr_preview_width) || 0
  const previewHeight = Number(parsedDraft.value?.ocr_preview_height) || 0
  const words = Array.isArray(parsedDraft.value?.ocr_words) ? parsedDraft.value.ocr_words : []
  if (!previewWidth || !previewHeight || words.length === 0) return []

  return scanActiveReviewHighlights.value
    .flatMap((highlight) => {
      const normalizedTokens = new Set(
        (highlight.tokens || [])
          .map((token) => normalizePreviewToken(token))
          .filter(Boolean),
      )

      return words
        .filter((word) => {
          const text = normalizePreviewToken(word?.text)
          return text && normalizedTokens.has(text) && Number(word?.width) > 0 && Number(word?.height) > 0
        })
        .slice(0, 120)
        .map((word, index) => ({
          key: `${highlight.key}-${index}-${word.text}-${word.left}-${word.top}`,
          label: word.text,
          title: `${highlight.label}: ${highlight.value}`,
          focusKey: highlight.key,
          itemIndex: typeof highlight.itemIndex === 'number' ? highlight.itemIndex : null,
          isItemFocus: typeof highlight.itemIndex === 'number',
          style: {
            left: `${(Number(word.left) / previewWidth) * 100}%`,
            top: `${(Number(word.top) / previewHeight) * 100}%`,
            width: `${(Number(word.width) / previewWidth) * 100}%`,
            height: `${(Number(word.height) / previewHeight) * 100}%`,
            zIndex: typeof highlight.itemIndex === 'number' ? 20 : 10,
          },
        }))
    })
    .slice(0, 160)
})

function clearScanTraceMode() {
  scanTraceContext.value = null
}

function normalizeTraceText(value) {
  return String(value ?? '').trim()
}

function normalizeTraceNumber(value, decimals = 3) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  return Number(numberValue.toFixed(decimals))
}

function formatTraceValue(value, type = 'text') {
  if (type === 'qty') {
    const normalized = normalizeTraceNumber(value, 3)
    return normalized === null ? '—' : normalized.toLocaleString('en-US', { maximumFractionDigits: 3 })
  }
  if (type === 'money') {
    const normalized = normalizeTraceNumber(value, 2)
    return normalized === null ? '—' : normalized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const normalized = normalizeTraceText(value)
  return normalized || '—'
}

function isSameTraceValue(left, right, type = 'text') {
  if (type === 'qty') {
    return normalizeTraceNumber(left, 3) === normalizeTraceNumber(right, 3)
  }
  if (type === 'money') {
    return normalizeTraceNumber(left, 2) === normalizeTraceNumber(right, 2)
  }
  return normalizeTraceText(left) === normalizeTraceText(right)
}

function buildTraceCompareField(key, label, historicalValue, currentValue, type = 'text') {
  return {
    key,
    label,
    historicalDisplay: formatTraceValue(historicalValue, type),
    currentDisplay: formatTraceValue(currentValue, type),
    changed: !isSameTraceValue(historicalValue, currentValue, type),
  }
}

const scanTraceComparison = computed(() => {
  if (!scanTraceContext.value) return null

  const itemIndex = Number(scanTraceContext.value.itemIndex)
  const currentItem = Number.isInteger(itemIndex) && itemIndex >= 0 ? parsedDraft.value?.items?.[itemIndex] || {} : {}
  const historicalItem = scanTraceContext.value.historicalItem || {}
  const isInvoiceTrace = parsedDraft.value?.type === 'invoice'
  const fields = [
    buildTraceCompareField('item_code', 'Item Code', historicalItem.item_code, currentItem.item_code),
    buildTraceCompareField('description', 'Description', historicalItem.description, currentItem.description),
    buildTraceCompareField('quantity', 'Qty', historicalItem.quantity, currentItem.quantity, 'qty'),
  ]

  if (isInvoiceTrace) {
    fields.push(
      buildTraceCompareField('unit_price', 'Unit Price', historicalItem.unit_price, currentItem.unit_price, 'money'),
      buildTraceCompareField('amount', 'Amount', historicalItem.amount, currentItem.extracted_amount, 'money'),
    )
  }

  return {
    historicalConfidence: formatAuditConfidence(historicalItem.ocr_confidence_level, historicalItem.ocr_confidence_percent),
    currentConfidence: formatAuditConfidence(currentItem.ocr_confidence_level, currentItem.ocr_confidence_percent),
    fields,
  }
})

function setScanReviewFocus(key = 'all', options = {}) {
  scanReviewFocusKey.value = key || 'all'
  if (options.clearTrace) {
    clearScanTraceMode()
  }
  if (options.triggerScroll) {
    scanFocusRequestId.value += 1
  }
}

function handleScanHighlightBoxClick(box) {
  if (!box?.isItemFocus || !box.focusKey) return
  setScanReviewFocus(box.focusKey, { triggerScroll: true })
}

// 中文注释：当用户从表单里点某一行 item 时，右侧 OCR 面板同步切到同一条商品，实现双向联动。
function onScanItemSelected(payload) {
  const itemIndex = Number(payload?.itemIndex)
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return
  if (payload?.ocrReviewContext && typeof payload.ocrReviewContext === 'object') {
    parsedDraft.value = {
      ...payload.ocrReviewContext,
      imported_from_scan: true,
    }
  }
  if (payload?.traceContext && typeof payload.traceContext === 'object') {
    scanTraceContext.value = payload.traceContext
  } else {
    clearScanTraceMode()
  }
  scanReviewExpanded.value = true
  setScanReviewFocus(`item-${itemIndex}`)
}

function formatDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
  return d.toLocaleDateString('en-CA')
}
function formatDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}
function formatNumber(v) {
  const n = Number(v || 0)
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 })
}
function formatMoney(v) {
  const n = Number(v || 0)
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function docTypeClass(t) {
  if (t === 'RETURN') return 'bg-amber-100 text-amber-800'
  if (t === 'CLAIM') return 'bg-rose-100 text-rose-800'
  if (t === 'REPAIR') return 'bg-sky-100 text-sky-800'
  return 'bg-slate-100 text-slate-700'
}

function switchTab(key) {
  if (activeTab.value === key) return
  activeTab.value = key
  searchInput.value = ''
  search.value = ''
  docTypeFilter.value = ''
  yearFilter.value = 0
  monthFilter.value = 0
  pagination.value.page = 1
  loadList(1)
}

function applySearch() {
  search.value = searchInput.value.trim()
  loadList(1)
}

function resetFilters() {
  searchInput.value = ''
  search.value = ''
  yearFilter.value = 0
  monthFilter.value = 0
  docTypeFilter.value = ''
  loadList(1)
}

function triggerScanUpload() {
  scanErrorMessage.value = ''
  scanFileInputRef.value?.click()
}

// 中文注释：允许用户在扫描后手动切换 DO / Invoice 类型，复用同一份解析结果。
function switchParsedDraftType(nextType) {
  if (!parsedDraft.value) return
  parsedDraft.value = {
    ...parsedDraft.value,
    type: nextType,
  }
  clearScanTraceMode()
  scanReviewExpanded.value = true
  activeTab.value = toModalTab(nextType)
  editingId.value = null
  modal.value = activeTab.value
}

// 中文注释：上传文档后直接调用现有解析接口，成功就打开对应 DO / Invoice 弹窗。
async function handleScanFileChange(event) {
  const selectedFile = event.target?.files?.[0]
  if (!selectedFile) return

  scanLoading.value = true
  scanErrorMessage.value = ''
      clearScanTraceMode()

  try {
    const formData = new FormData()
    formData.append('file', selectedFile)
    const { data } = await api.post('/documents/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    const detectedType = data?.documentType === 'delivery_order' || data?.documentType === 'invoice'
      ? data.documentType
      : 'unknown'
    const documentType = resolveDraftType(detectedType)
    if (detectedType === 'unknown') {
      scanErrorMessage.value = '系统暂时无法 100% 判断这是 DO 还是 Invoice，已先按当前页签打开；如果不对，可以点击上方按钮手动切换。'
    }

    parsedDraft.value = buildParsedDraft(data, documentType, selectedFile)
    scanReviewExpanded.value = true
    scanReviewFocusKey.value = 'all'
    scanFocusRequestId.value = 0
    editingId.value = null
    activeTab.value = toModalTab(documentType)
    modal.value = activeTab.value

    toastStore.pushToast({
      tone: 'success',
      message: documentType === 'delivery_order'
        ? 'DO recognized. Please review and click Save.'
        : 'Invoice recognized. Please review and click Save.',
    })
  } catch (error) {
    scanErrorMessage.value = error.response?.data?.message || error.message || 'Failed to parse document.'
  } finally {
    scanLoading.value = false
    if (event.target) {
      event.target.value = ''
    }
  }
}

async function loadSuppliers() {
  try {
    const { data } = await api.get('/suppliers', { params: { pageSize: 500 } })
    const list = data?.items || data?.suppliers || (Array.isArray(data) ? data : [])
    suppliers.value = list.map((s) => ({
      id: s.id,
      name: s.name || s.company_name,
      company_name: s.company_name || s.name,
    }))
  } catch (error) {
    suppliers.value = []
  }
}

async function loadList(page = 1) {
  loading.value = true
  errorMessage.value = ''
  pagination.value.page = page
  try {
    const params = { page, pageSize: pagination.value.pageSize }
    params.sort = sortField.value
    params.order = sortOrder.value
    if (search.value) params.search = search.value
    if (yearFilter.value) params.year = yearFilter.value
    if (monthFilter.value) params.month = monthFilter.value
    if (activeTab.value === 'returns' && docTypeFilter.value) params.docType = docTypeFilter.value
    const { data } = await api.get(currentTab.value.resource, { params })
    items.value = data?.items || []
    pagination.value = data?.pagination || { ...pagination.value, total: items.value.length, totalPages: 1 }
  } catch (error) {
    items.value = []
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to load.'
  } finally {
    loading.value = false
  }
}

async function loadCounts() {
  try {
    const [doRes, invRes, retRes] = await Promise.all([
      api.get('/delivery-orders', { params: { page: 1, pageSize: 1 } }),
      api.get('/supplier-invoices', { params: { page: 1, pageSize: 1 } }),
      api.get('/supplier-returns', { params: { page: 1, pageSize: 1 } }),
    ])
    counts.value = {
      do: doRes.data?.pagination?.total || 0,
      invoice: invRes.data?.pagination?.total || 0,
      returns: retRes.data?.pagination?.total || 0,
    }
  } catch {
    // ignore count errors
  }
}

function openCreate() {
  editingId.value = null
  parsedDraft.value = null
  clearScanTraceMode()
  scanReviewExpanded.value = false
  scanReviewFocusKey.value = 'all'
  scanFocusRequestId.value = 0
  modal.value = activeTab.value
}
function openEdit(id) {
  editingId.value = id
  parsedDraft.value = null
  clearScanTraceMode()
  scanReviewExpanded.value = false
  scanReviewFocusKey.value = 'all'
  scanFocusRequestId.value = 0
  modal.value = activeTab.value
}
function closeModal() {
  modal.value = null
  editingId.value = null
  parsedDraft.value = null
  clearScanTraceMode()
  scanReviewExpanded.value = false
  scanReviewFocusKey.value = 'all'
  scanFocusRequestId.value = 0
}
async function onSaved(payload) {
  const attachmentWarning = payload?.attachmentWarning || ''
  closeModal()
  toastStore.pushToast({
    tone: attachmentWarning ? 'warning' : 'success',
    message: attachmentWarning || 'Saved.',
  })
  await loadCounts()
  loadList(pagination.value.page)
}

async function removeRow(id) {
  if (!window.confirm('Delete this document? This cannot be undone.')) return
  try {
    await api.delete(`${currentTab.value.resource}/${id}`)
    toastStore.pushToast({ tone: 'success', message: 'Deleted.' })
    await loadCounts()
    loadList(pagination.value.page)
  } catch (error) {
    toastStore.pushToast({ tone: 'error', message: error.response?.data?.message || 'Failed to delete.' })
  }
}

onMounted(async () => {
  await loadSuppliers()
  await loadCounts()
  await loadList(1)
})
</script>
