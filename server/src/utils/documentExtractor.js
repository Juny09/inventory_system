/**
 * 从文档文本中提取结构化字段（Delivery Order / Invoice）
 * 使用正则匹配 + 启发式规则
 */

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // 去除零宽字符
    .trim()
}

/**
 * 判断文档类型
 */
function detectDocumentType(text) {
  const upper = text.toUpperCase()
  const deliveryKeywords = [
    'DELIVERY ORDER',
    'DELIVERY NOTE',
    'D/O',
    'D\\.O\\.',
    'DO NO',
    'DO NUMBER',
    'PICKING LIST',
    'PACKING LIST',
    '出库单',
    '送货单',
  ]
  const invoiceKeywords = [
    'INVOICE',
    'TAX INVOICE',
    'COMMERCIAL INVOICE',
    'PROFORMA INVOICE',
    'BILL',
    'STATEMENT',
    '发票',
    '账单',
  ]

  for (const kw of deliveryKeywords) {
    if (upper.includes(kw.toUpperCase())) return 'delivery_order'
  }
  for (const kw of invoiceKeywords) {
    if (upper.includes(kw.toUpperCase())) return 'invoice'
  }

  // 如果包含 DO 单号格式但没找到 Invoice 关键词
  if (/\bDO\s*[#:]?\s*\d+/i.test(text)) return 'delivery_order'
  if (/\bINV\s*[#:]?\s*\d+/i.test(text)) return 'invoice'

  return 'unknown'
}

/**
 * 提取单号
 */
function extractDocumentNumber(text, docType) {
  const patterns = {
    delivery_order: [
      /(?:DO|D\.O\.?|Delivery\s*Order)\s*[#:]?\s*([A-Z0-9\-]{3,20})/i,
      /(?:DO\s*NO\.?|Delivery\s*Order\s*No\.?)\s*[#:]?\s*([A-Z0-9\-]{3,20})/i,
      /单号\s*[#:]?\s*([A-Z0-9\-]{3,20})/i,
      /Ref(?:erence)?\s*[#:]?\s*([A-Z0-9\-]{3,20})/i,
    ],
    invoice: [
      /(?:Invoice|INV)\s*[#:]?\s*([A-Z0-9\-]{3,20})/i,
      /(?:Invoice\s*No\.?|Invoice\s*Number)\s*[#:]?\s*([A-Z0-9\-]{3,20})/i,
      /发票号码?\s*[#:]?\s*([A-Z0-9\-]{3,20})/i,
      /Ref(?:erence)?\s*[#:]?\s*([A-Z0-9\-]{3,20})/i,
    ],
  }

  const candidates = patterns[docType] || [...patterns.delivery_order, ...patterns.invoice]
  for (const re of candidates) {
    const m = text.match(re)
    if (m) return m[1].trim()
  }

  // fallback: 找看起来像单号的字符串
  const fallback = text.match(/\b([A-Z]{1,3}\d{4,10})\b/)
  return fallback ? fallback[1] : null
}

/**
 * 提取日期（多种格式）
 */
function extractDate(text) {
  // DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD.MM.YYYY, Month DD, YYYY 等
  const patterns = [
    /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/,
    /(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i,
  ]

  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const raw = m[1]
      // 尝试标准化为 YYYY-MM-DD
      const parsed = parseDate(raw)
      if (parsed) return parsed
    }
  }
  return null
}

function parseDate(raw) {
  // 尝试多种格式解析
  const separators = /[\/\-.]/
  const parts = raw.split(separators).map((p) => p.trim())

  if (parts.length === 3) {
    let [a, b, c] = parts
    let y, m, d

    if (a.length === 4) {
      // YYYY-MM-DD
      y = a
      m = b.padStart(2, '0')
      d = c.padStart(2, '0')
    } else if (c.length === 4 || c.length === 2) {
      // DD/MM/YYYY or DD-MM-YY
      d = a.padStart(2, '0')
      m = b.padStart(2, '0')
      y = c.length === 2 ? '20' + c : c
    } else {
      return null
    }

    const mm = Number(m)
    const dd = Number(d)
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${y}-${m}-${d}`
    }
  }

  // 英文月份格式
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const monthMatch = raw.match(/(\d{1,2})\s+([a-z]{3,})\s+(\d{4})/i)
  if (monthMatch) {
    const d = monthMatch[1].padStart(2, '0')
    const mAbbr = monthMatch[2].toLowerCase().slice(0, 3)
    const y = monthMatch[3]
    const m = monthMap[mAbbr]
    if (m) return `${y}-${m}-${d}`
  }

  return null
}

/**
 * 从文本中提取供应商名称（第一行附近的大写公司名或包含 Pte Ltd / Sdn Bhd 等）
 */
function extractSupplierName(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // 优先找包含公司后缀的行
  const companySuffixes = /(Pte\.?\s*Ltd|Sdn\.?\s*Bhd|Limited|Ltd\.?|Inc\.?|Corp\.?|Company|Enterprise|Trading)/i
  for (const line of lines.slice(0, 20)) {
    if (companySuffixes.test(line) && line.length > 5 && line.length < 80) {
      return line.replace(/\s+/g, ' ').trim()
    }
  }

  // fallback: 前几行中最长的看起来是名称的
  for (const line of lines.slice(0, 10)) {
    if (line.length > 10 && line.length < 60 && !/\d{3,}/.test(line) && !/\$|RM|USD|EUR/.test(line)) {
      return line.replace(/\s+/g, ' ').trim()
    }
  }

  return null
}

/**
 * 提取产品列表行
 * 简单启发式：找包含数量+描述/金额的行
 */
function extractItemLines(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const items = []

  for (const line of lines) {
    // 匹配模式：数量 x 产品描述，或 产品描述 ... 数量 ... 金额
    // 尝试匹配简单的 "数字 空格 描述" 或 "描述 空格 数字"
    const qtyMatch = line.match(/\b(\d+(?:\.\d+)?)\s*(?:pcs?|units?|sets?|boxes?|cartons?|packs?|kg|g|ml|l)?\b/i)
    const hasAmount = /\$|RM|USD|EUR|\.\d{2}/.test(line)
    const hasDescription = line.length > 10 && /[a-zA-Z]{3,}/.test(line)

    if (qtyMatch && hasDescription && (hasAmount || line.length > 20)) {
      const qty = parseFloat(qtyMatch[1])
      if (qty > 0 && qty < 100000) {
        // 尝试提取产品描述（去掉数字和价格部分）
        let description = line
          .replace(/\$[\d,.]+/g, '')
          .replace(/RM[\d,.]+/g, '')
          .replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, '')
          .replace(/\b\d+(?:\.\d+)?\s*(?:pcs?|units?|sets?|boxes?|cartons?|packs?|kg|g|ml|l)?\b/gi, '')
          .replace(/\d+\.\d{2}/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        if (description.length > 3) {
          items.push({
            quantity: qty,
            description: description,
            raw: line,
          })
        }
      }
    }
  }

  return items.slice(0, 30) // 最多取30行
}

/**
 * 主解析函数
 */
function parseDocument(text, ollamaResult = null) {
  // 优先使用 Ollama 提取的结构化数据
  if (ollamaResult) {
    return {
      documentType: ollamaResult.documentType || 'unknown',
      documentNumber: ollamaResult.documentNumber || null,
      date: ollamaResult.date || null,
      supplierName: ollamaResult.supplierName || null,
      items: (ollamaResult.items || []).map(it => ({
        quantity: Number(it.quantity) || 1,
        description: it.description || '',
        raw: `${it.description || ''} x${it.quantity || 1}`,
      })),
      rawText: text ? text.slice(0, 5000) : '',
      source: 'ollama',
    }
  }

  const normalized = normalizeText(text)
  const docType = detectDocumentType(normalized)
  const docNumber = extractDocumentNumber(normalized, docType)
  const date = extractDate(normalized)
  const supplierName = extractSupplierName(normalized)
  const items = extractItemLines(normalized)

  return {
    documentType: docType,
    documentNumber: docNumber,
    date: date,
    supplierName: supplierName,
    items: items,
    rawText: normalized.slice(0, 5000), // 返回前5000字符用于调试
    source: 'regex',
  }
}

module.exports = {
  parseDocument,
  detectDocumentType,
  extractDocumentNumber,
  extractDate,
  extractSupplierName,
  extractItemLines,
}
