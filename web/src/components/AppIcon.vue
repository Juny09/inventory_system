<script setup>
import { computed } from 'vue'
import { getIconUrl } from '../utils/iconUrlMap'

/**
 * AppIcon —— 完全按 TraeWork 设计系统规范实现的单色图标组件
 *
 * 【和旧实现的 3 个关键区别】
 *  1) 渲染方式：从 `<svg>` + 内联 path 改成 `<span mask-image: url(xxx.svg)>` + `background: currentColor`
 *     - 这样父元素改 `color: var(--text-brand)` 时，图标**自动变成品牌色**（旧 SVG 方式虽然也有 currentColor，但在组件边界下有时继承不到）
 *     - 完全符合 SKILL.md 要求："单色图标走 currentColor"
 *  2) 资源来源：从写死的 12 个 path 数组 → 改为 `web/src/assets/traework/icons/*.svg` 共 671 个本地 SVG
 *     - 完全符合 SKILL.md 要求："只用本地 SVG，不用外部 icon 库/字体/emoji/CDN"
 *  3) 尺寸规范：严格对齐 TraeWork Iconography 章节的 3 档官方尺寸
 *     - 默认   16px  → 传 `size="default"` 或写 class="icon icon--16"
 *     - 紧凑   14px  → 传 `size="compact"` 或 class="icon icon--14"
 *     - 大锚点 24px  → 传 `size="large"`   或 class="icon icon--24"
 *     - （另外为了兼容 B-1 AppLayout 已写好的 icon--12/20 调用点，也额外支持 12/20）
 *
 * 【Props 说明】
 * @param {string} name    - 图标名字，可以是旧名字（如 "chevronLeft"）、TraeWork 文件名（如 "Help.svg" / "Help"）
 * @param {string} [size]  - 尺寸档位：'compact'(14) | 'default'(16,默认) | 'large'(24)；不传则根据 class 里的 icon--12/14/16/20/24 自动
 * @param {string} [class] - 额外 class，比如 "icon icon--16 text-tw-text-secondary"（文字色 = 图标色）
 * @param {string} [ariaLabel] - 无障碍标签（如果图标有语义就传；纯装饰不传即可，默认 aria-hidden true）
 */
const props = defineProps({
  name: { type: String, required: true },
  size: {
    type: String,
    default: '',
    validator: (v) => !v || ['compact', 'default', 'large'].includes(v),
  },
  class: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
})

// 给 mask-image 用的 SVG URL（Vite 打包好的 URL）
const iconUrl = computed(() => getIconUrl(props.name))

// 根据 size prop 推断尺寸 class（和 TraeWork components.css 里的 .icon--12/14/16/20/24 保持同名）
const sizeClass = computed(() => {
  if (props.size === 'compact') return 'icon icon--14'
  if (props.size === 'large') return 'icon icon--24'
  if (props.size === 'default') return 'icon icon--16'
  // 用户没传 size → 返回空，让他自己在 props.class 里写 icon--14/16/24（B-1 AppLayout 就是这么写的）
  return ''
})

// 合并 class：用户 class 优先，其次自动 sizeClass；保证至少有一份尺寸（避免 0 宽 0 高）
const mergedClass = computed(() => {
  const userCls = props.class || ''
  const hasExplicitSize = /(?:^|\s)icon--(?:12|14|16|20|24)(?:\s|$)/.test(userCls)
  if (hasExplicitSize) return userCls
  if (sizeClass.value) return [sizeClass.value, userCls].filter(Boolean).join(' ')
  // 兜底：没传 size 也没写尺寸 class → 按 TraeWork 默认 16×16
  return `icon icon--16 ${userCls}`.trim()
})

// CSS 自定义属性：把 URL 直接挂到 style 上，样式里用 var(--app-icon-url) 取
const maskStyle = computed(() => ({
  '--app-icon-url': `url(${iconUrl.value})`,
}))
</script>

<template>
  <!-- 用语义中性的 <span>，不用 <img>/不用 <svg>——符合 TraeWork "mask + currentColor" 规范 -->
  <span
    class="app-icon inline-grid place-items-center shrink-0 select-none"
    :class="mergedClass"
    :style="maskStyle"
    :aria-hidden="ariaLabel ? false : true"
    :aria-label="ariaLabel || undefined"
    role="img"
  ></span>
</template>

<style scoped>
/*
  TraeWork 官方图标尺寸（与 components.css 中 .ds-btn .icon--NN 定义完全对齐）：
  - 核心三档：icon--14（紧凑/菜单/标签）、icon--16（默认/大部分按钮）、icon--24（卡片锚点）
  - 为兼容 AppLayout 已写好的调用，额外保留 --12 / --20
*/
.app-icon {
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
  -webkit-mask-position: center;
          mask-position: center;
  -webkit-mask-size: contain;
          mask-size: contain;
  -webkit-mask-image: var(--app-icon-url);
          mask-image: var(--app-icon-url);
  /*
    TraeWork Iconography §"Every icon placeholder must reserve its final width/height before load"
    —— 必须先占位固定尺寸，避免 SVG 加载后再撑开导致布局抖动（CLS）
  */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.app-icon.icon--12 { width: var(--icon-size-12); height: var(--icon-size-12); }
.app-icon.icon--14 { width: var(--icon-size-14); height: var(--icon-size-14); }
.app-icon.icon--16 { width: var(--icon-size-16); height: var(--icon-size-16); }
.app-icon.icon--20 { width: var(--icon-size-20); height: var(--icon-size-20); }
.app-icon.icon--24 { width: var(--icon-size-24); height: var(--icon-size-24); }
</style>
