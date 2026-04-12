import QRCode from 'qrcode'
import { printHtmlDocument } from './export'

export const markupPresets = [
  { label: '10% 保守', value: 10, hint: '适合低竞争差异品类' },
  { label: '20% 常规', value: 20, hint: '适合常见标准品' },
  { label: '30% 零售', value: 30, hint: '适合门店与陈列成本' },
  { label: '50% 高服务', value: 50, hint: '适合安装、培训、售后场景' },
]

export const pricingRuleTemplates = [
  { ruleName: 'Retail', markupPercentage: 30, description: '门店常规零售价' },
  { ruleName: 'Wholesale', markupPercentage: 18, description: '批发合作价' },
  { ruleName: 'VIP', markupPercentage: 12, description: '会员或老客户价格' },
]

export function generateLocalProductCode() {
  return `PRD-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function calculateSuggestedPrice(costPrice, markupPercentage) {
  const cost = Number(costPrice || 0)
  const markup = Number(markupPercentage || 0)
  return Number((cost * (1 + markup / 100)).toFixed(2))
}

export function buildDefaultPricingRules(costPrice = 0) {
  return pricingRuleTemplates.map((item, index) => ({
    ...item,
    isDefault: index === 0,
    sortOrder: index,
    suggestedPrice: calculateSuggestedPrice(costPrice, item.markupPercentage),
  }))
}

export function syncPricingRules(costPrice, rules) {
  return rules.map((rule, index) => ({
    ...rule,
    isDefault: Boolean(rule.isDefault) || index === 0,
    sortOrder: Number(rule.sortOrder ?? index),
    suggestedPrice: calculateSuggestedPrice(costPrice, rule.markupPercentage),
  }))
}

export async function buildProductQrDataUrl(value) {
  if (!value) {
    return ''
  }

  return QRCode.toDataURL(value, {
    margin: 1,
    width: 220,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  })
}

export function downloadDataUrl(filename, dataUrl) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

export function printProductLabel(product, qrDataUrl) {
  printHtmlDocument(
    `${product.name} Label`,
    `
      <h1>${product.name}</h1>
      <p>SKU: ${product.sku}</p>
      <p>Product Code: ${product.product_code || product.productCode || '—'}</p>
      <p>Barcode: ${product.barcode || '—'}</p>
      <div style="margin-top: 20px; display: flex; align-items: center; gap: 20px;">
        <img src="${qrDataUrl}" alt="QR Code" style="width: 180px; height: 180px; border: 1px solid #e2e8f0; border-radius: 12px;" />
        <div>
          <p>${product.description || ''}</p>
        </div>
      </div>
    `,
  )
}

export function printMultipleProductLabels(items) {
  printHtmlDocument(
    'Product Labels',
    `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;">
        ${items
          .map(
            (item) => `
              <section style="padding:20px;border:1px solid #e2e8f0;border-radius:18px;break-inside:avoid;">
                <h2 style="margin:0 0 8px;font-size:20px;">${item.name}</h2>
                <p style="margin:0 0 4px;">SKU: ${item.sku}</p>
                <p style="margin:0 0 4px;">Product Code: ${item.productCode}</p>
                <p style="margin:0 0 16px;">Barcode: ${item.barcode || '—'}</p>
                <img src="${item.qrDataUrl}" alt="QR Code" style="width:180px;height:180px;border:1px solid #e2e8f0;border-radius:12px;" />
              </section>
            `,
          )
          .join('')}
      </div>
    `,
  )
}

export async function processProductImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const image = await new Promise((resolve, reject) => {
    const nextImage = new Image()
    nextImage.onload = () => resolve(nextImage)
    nextImage.onerror = reject
    nextImage.src = dataUrl
  })

  const outputSize = 960
  const sourceSize = Math.min(image.width, image.height)
  const startX = (image.width - sourceSize) / 2
  const startY = (image.height - sourceSize) / 2
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const context = canvas.getContext('2d')

  context.drawImage(image, startX, startY, sourceSize, sourceSize, 0, 0, outputSize, outputSize)

  return canvas.toDataURL('image/jpeg', 0.82)
}
