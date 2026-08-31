/**
 * TraeWork 图标 URL 映射表（给 AppIcon.vue 使用）
 *
 * 需求背景（来自 TraeWork SKILL.md "Iconography" 章节）：
 *   1. 只允许使用本地 `assets/icons/` 内的 SVG，不能用外部 CDN/emoji/font-icons/运行时生成包
 *   2. 单色图标必须跟随父元素 `currentColor`，而 <img src="xxx.svg"> 这种方式无法继承父色，
 *      因此需要在 AppIcon.vue 中用 CSS `mask-image: url(xxx.svg)` + `background-color: currentColor`
 *   3. 默认渲染尺寸 16×16，紧凑用 14，大图标用 24；不要随便开其他尺寸
 *
 * 本文件做的事情：
 *   a) 用 Vite 提供的 `import.meta.glob('../assets/traework/icons/*.svg', { eager: true, as: 'url' })`
 *      把 traework/icons 目录下全部 671 个 SVG 都静态 import 进来，转成 Vite 生产构建可识别的 URL
 *      （这样 SVG 会被打包进 dist/assets/traework/icons/ 或内联成 data-uri，nginx 能找到）
 *   b) 提供 `legacyName → traework 文件名` 的兼容映射，旧代码 `<AppIcon name="chevronLeft" />`
 *      不用一个个修改，自动落到正确的 TraeWork SVG
 *   c) 提供 `getIconUrl(name)` 函数：
 *        - 先查 legacy 映射 → 得到 traework 文件名（如 chevronLeft → chevron_left.svg）
 *        - 再查 traeworkIcons URL 映射 → 拿到可用于 mask-image 的 URL
 *        - 如果都找不到 → fallback 到 Doc-Default.svg（符合 SKILL.md "找不到就用一个相近或去掉图标，不要用外部替代"）
 */

// ============== (a) 把 TraeWork 全部 SVG 静态打包进来，返回 { 文件名: ViteURL } ==============
// 注：`eager: true` 表示打包时就全部 import 进来，避免运行时 dynamic import
//     `as: 'url'`      表示不解析 SVG 内容，只要 URL 字符串（配合 mask-image 用）
const traeworkIconModules = import.meta.glob('../assets/traework/icons/*.svg', {
  eager: true,
  as: 'url',
})

// 把 "../assets/traework/icons/Help.svg" 这种 key 归一化成 basename（含扩展名）：Help.svg
const traeworkIcons = Object.fromEntries(
  Object.entries(traeworkIconModules).map(([key, url]) => {
    const basename = key.split('/').pop()
    return [basename, url]
  }),
)

// 为了匹配时更稳，再额外建立一份 "小写（去连字符/下划线/中划线）→ basename" 的索引
//   例如 "chevronleft" → "chevron_left.svg"，这样 legacy name "chevronLeft" 不区分大小写也能命中
const insensitiveIndex = Object.keys(traeworkIcons).reduce((acc, filename) => {
  const key = filename.toLowerCase().replace(/[._\- ]/g, '')
  if (!acc[key]) acc[key] = filename
  return acc
}, {})

// ============== (b) legacy name → TraeWork 文件名的兼容映射表 ==============
// 旧 AppIcon 里写死了一批名字：dashboard / alerts / inventory / ... / bell / x
// 这里一个个对应到语义最接近的 TraeWork 图标
// 注：TraeWork 里不是 100% 有完全同名图标（比如没有专门的 dashboard.svg），
//     因此退而求其次用了 "最语义接近" 的图标，符合 SKILL.md 的要求
const legacyToTraework = {
  // Dashboard / 总览：用一个列表/面板图标
  dashboard: 'Bar-list.svg',
  // Alerts：用 TaskState_alert.svg（有铃铛/提示语义）
  alerts: 'TaskState_alert.svg',
  // Inventory：用 Doc-Default（文档/条目）——TraeWork 没有"库存"图标，就用通用列表占位
  // （以后你如果想换，可以把这里改成 File.svg / Expand_filetree.svg 等）
  inventory: 'Doc-Default.svg',
  // Stock Counts：用 Checklist 语义的 TaskState_alert.svg 先顶一下，或者 File 也行
  counts: 'Expand.svg',
  // Categories：用 Folder.svg 非常贴合
  categories: 'Folder.svg',
  // Warehouses：用 computer-screen？——TraeWork 没"仓库"，用 Disk.svg（存储）
  warehouses: 'Disk.svg',
  // Products：用 File.svg（产品档案）
  products: 'File.svg',
  // Reports：用 DocFile.svg
  reports: 'DocFile.svg',
  // Audit：盾牌没有，用 authentication.svg（审计=鉴权/安全，语义最接近）
  audit: 'authentication.svg',
  // Guide：Help.svg（问号圆圈，语义一致）
  guide: 'Help.svg',
  // Chevron Left：TraeWork 有 chevron_down_large / chevron_unfold / chevron-double-up，
  // 没直接的"左箭头"，用 expand-left.svg（展开左），或者更通用的 Left.svg → 搜一下 icons 目录里的 Left
  chevronLeft: 'Left.svg',
  // Menu：用 bars-menu.svg（三条横杠，经典菜单）
  menu: 'bars-menu.svg',
  // Question：Help.svg 就是问号圆圈，完全一致
  question: 'Help.svg',
  // Bell：TraeWork 没有"铃铛"，用 TaskState_alert 替代（状态提示）
  bell: 'TaskState_alert.svg',
  // Close (x)：Close.svg
  x: 'Close.svg',
  // Suppliers：用 Doc-Default（供应商档案）——TraeWork 没供应商图标
  suppliers: 'Doc-Default.svg',
  // Orders：用 artifacts-content-list-filled（订单=清单）
  orders: 'artifacts-content-list-filled.svg',
  // Mobile Scanner：computer-screen.svg
  scanner: 'computer-screen.svg',
  // Settings：TraeWork 没齿轮，用 SettingIgnoreFiles 先顶，或用 environment-repair
  settings: 'SettingIgnoreFiles.svg',
  // Search：Search.svg（完美命中）
  search: 'Search.svg',
}

// ============== (c) 导出 getIconUrl(name) 给 AppIcon 用 ==============

/**
 * 根据图标名字拿到最终可用于 mask-image 的 URL
 * @param {string} name - 可以是旧名字（chevronLeft/bell/...）或 TraeWork 文件名（Help.svg）或不带扩展名的文件名（Help）
 * @returns {string} Vite 打包后的 SVG URL（生产环境是 /assets/xxx.svg 或 data-uri）
 */
export function getIconUrl(name) {
  if (!name) return traeworkIcons['Doc-Default.svg']

  // 1) 优先走 legacy → traework 映射
  if (legacyToTraework[name]) {
    const target = legacyToTraework[name]
    if (traeworkIcons[target]) return traeworkIcons[target]
  }

  // 2) 允许直接传 "Help.svg" 这种带扩展名的文件名
  if (traeworkIcons[name]) return traeworkIcons[name]

  // 3) 允许传不带扩展名的，先精确试一次 + .svg
  const withSvg = `${name}.svg`
  if (traeworkIcons[withSvg]) return traeworkIcons[withSvg]

  // 4) 不区分大小写 + 去掉 -_. 空格 再查一次（兼容调用方随便写大小写/分隔符）
  const norm = String(name).toLowerCase().replace(/[._\- ]/g, '')
  if (insensitiveIndex[norm]) {
    return traeworkIcons[insensitiveIndex[norm]]
  }

  // 5) 都没命中 → fallback 到 Doc-Default.svg（通用占位，不要报错）
  return traeworkIcons['Doc-Default.svg']
}

/**
 * 调试用：拿到 traework 所有 SVG 文件名列表（需要做名字映射时可以直接看）
 * @returns {string[]}
 */
export function listTraeworkIconFilenames() {
  return Object.keys(traeworkIcons).sort((a, b) => a.localeCompare(b))
}

export { traeworkIcons, legacyToTraework, insensitiveIndex }
