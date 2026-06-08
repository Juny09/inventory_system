const fs = require('fs')
const axios = require('axios')
const pdfParse = require('pdf-parse')
const Tesseract = require('tesseract.js')
const sharp = require('sharp')

const OLLAMA_BASE = 'http://localhost:11434'

/**
 * 获取本地 Ollama 已安装的模型列表
 */
async function getOllamaModels() {
  try {
    const { data } = await axios.get(`${OLLAMA_BASE}/api/tags`, { timeout: 5000 })
    return data.models?.map(m => m.name) || []
  } catch {
    return []
  }
}

/**
 * 判断是否安装了 vision-capable 模型
 */
function hasVisionModel(models) {
  const visionKeywords = ['llava', 'bakllava', 'moondream', 'cogvlm']
  return models.some(m => visionKeywords.some(k => m.toLowerCase().includes(k)))
}

function getBestVisionModel(models) {
  const visionKeywords = ['llava', 'bakllava', 'moondream', 'cogvlm']
  return models.find(m => visionKeywords.some(k => m.toLowerCase().includes(k)))
}

function getBestTextModel(models) {
  if (models.find(m => m.includes('deepseek-coder'))) return models.find(m => m.includes('deepseek-coder'))
  if (models.find(m => m.includes('llama3'))) return models.find(m => m.includes('llama3'))
  if (models.find(m => m.includes('llama'))) return models.find(m => m.includes('llama'))
  return models[0]
}

/**
 * 调用 Ollama vision model 分析图片
 */
async function callOllamaVision(imagePath, model, prompt) {
  const buffer = fs.readFileSync(imagePath)
  const base64 = buffer.toString('base64')

  const { data } = await axios.post(
    `${OLLAMA_BASE}/api/chat`,
    {
      model,
      messages: [{ role: 'user', content: prompt, images: [base64] }],
      stream: false,
      options: { temperature: 0.1, num_predict: 2048 },
    },
    { timeout: 180000 },
  )

  return data.message?.content || ''
}

/**
 * 调用 Ollama text model 分析文本
 */
async function callOllamaText(text, model, prompt) {
  const fullPrompt = `${prompt}\n\nDocument text:\n${text.slice(0, 6000)}`

  const { data } = await axios.post(
    `${OLLAMA_BASE}/api/chat`,
    {
      model,
      messages: [
        { role: 'system', content: 'You are a document data extraction assistant. Output only valid JSON without markdown fences.' },
        { role: 'user', content: fullPrompt },
      ],
      stream: false,
      options: { temperature: 0.1, num_predict: 2048 },
    },
    { timeout: 120000 },
  )

  return data.message?.content || ''
}

/**
 * 清理 LLM 返回的 markdown JSON 围栏
 */
function cleanLLMJson(raw) {
  let text = raw.trim()
  if (text.startsWith('```json')) text = text.slice(7)
  if (text.startsWith('```')) text = text.slice(3)
  if (text.endsWith('```')) text = text.slice(0, -3)
  return text.trim()
}

function tryParseJson(text) {
  const cleaned = cleanLLMJson(text)
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

const DEFAULT_EXTRACTION_PROMPT = `You are analyzing a business document (Delivery Order or Invoice).
Extract these fields and return ONLY a JSON object with this exact structure:
{
  "documentType": "delivery_order" or "invoice" or "unknown",
  "documentNumber": "the reference number like DO-12345 or INV-67890",
  "date": "YYYY-MM-DD if found",
  "supplierName": "the company/vendor name",
  "items": [{"description": "product name", "quantity": number, "unitPrice": number or null, "amount": number or null}]
}
For invoice items, try your best to extract unitPrice and line amount. Use null for missing fields. Output ONLY JSON, no markdown fences.`

function getDefaultPrompt() {
  return DEFAULT_EXTRACTION_PROMPT
}

/**
 * 优先使用 Ollama 提取结构化数据，失败回退到 null
 * @param {string} filePath
 * @param {string} mimetype
 * @param {object} options - { model?: string, prompt?: string }
 */
async function extractWithOllama(filePath, mimetype, options = {}) {
  const userModel = options.model
  const userPrompt = options.prompt || DEFAULT_EXTRACTION_PROMPT
  const models = await getOllamaModels()
  if (models.length === 0) return null

  // 判断用户指定的是否是 vision model
  const isVisionModel = (name) => ['llava','bakllava','moondream','cogvlm'].some(k => name.toLowerCase().includes(k))

  // 图片：直接发给 vision model
  if (mimetype.startsWith('image/')) {
    const visionModel = userModel && isVisionModel(userModel) ? userModel : getBestVisionModel(models)
    if (!visionModel) return null
    const raw = await callOllamaVision(filePath, visionModel, userPrompt)
    const parsed = tryParseJson(raw)
    if (parsed) {
      console.log('[Ollama vision] Parsed document:', parsed.documentType, parsed.documentNumber)
      return parsed
    }
    console.log('[Ollama vision] Failed to parse JSON, raw:', raw.slice(0, 200))
    return null
  }

  // PDF：先提取文本
  if (mimetype === 'application/pdf') {
    const buffer = fs.readFileSync(filePath)
    const pdfData = await pdfParse(buffer)
    const text = pdfData.text || ''

    // 文本足够时发给 text model
    if (text.length > 50) {
      const textModel = userModel && !isVisionModel(userModel) ? userModel : getBestTextModel(models)
      const raw = await callOllamaText(text, textModel, userPrompt)
      const parsed = tryParseJson(raw)
      if (parsed) {
        console.log('[Ollama text] Parsed PDF document:', parsed.documentType, parsed.documentNumber)
        return parsed
      }
      console.log('[Ollama text] Failed to parse JSON from PDF, raw:', raw.slice(0, 200))
    }

    // 扫描件 PDF（文本极少）：如果装了 vision model，尝试截图第1页发给 vision
    const visionModel = getBestVisionModel(models)
    if (visionModel && text.length < 50) {
      console.log('[Ollama] PDF appears to be image-based. Consider converting to image for vision model.')
    }
  }

  return null
}

/**
 * 从 PDF 文件中提取文本
 */
async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  return data.text || ''
}

function scoreOcrText(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return 0
  const alnumCount = (normalized.match(/[A-Z0-9]/gi) || []).length
  const moneyHints = (normalized.match(/\b(?:RM|INVOICE|DELIVERY|ORDER|QTY|TOTAL)\b/gi) || []).length
  return normalized.length + alnumCount + moneyHints * 25
}

async function buildOcrVariants(filePath) {
  const base = sharp(filePath).rotate()
  const variants = [
    {
      name: 'normalized',
      buffer: await base
        .greyscale()
        .normalise()
        .sharpen({ sigma: 1.2, m1: 1, m2: 2 })
        .resize(2200, 2200, { fit: 'inside', withoutEnlargement: true })
        .toBuffer(),
    },
    {
      name: 'threshold',
      buffer: await sharp(filePath)
        .rotate()
        .greyscale()
        .normalise()
        .sharpen()
        .threshold(170)
        .resize(2200, 2200, { fit: 'inside', withoutEnlargement: true })
        .toBuffer(),
    },
  ]

  return variants
}

async function recognizeBuffer(buffer) {
  const {
    data: { text },
  } = await Tesseract.recognize(buffer, 'eng', {
    logger: () => {},
  })

  return text || ''
}

/**
 * 从图片中提取文本（OCR）
 * 先压缩图片提高 OCR 速度和准确度
 */
async function extractImageText(filePath) {
  const variants = await buildOcrVariants(filePath)
  let bestText = ''
  let bestScore = -1

  for (const variant of variants) {
    const recognized = await recognizeBuffer(variant.buffer)
    const score = scoreOcrText(recognized)
    if (score > bestScore) {
      bestScore = score
      bestText = recognized
    }
  }

  if (bestScore < 120) {
    const rotatedBuffers = await Promise.all([
      sharp(filePath)
        .rotate(-2, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .greyscale()
        .normalise()
        .sharpen()
        .resize(2200, 2200, { fit: 'inside', withoutEnlargement: true })
        .toBuffer(),
      sharp(filePath)
        .rotate(2, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .greyscale()
        .normalise()
        .sharpen()
        .resize(2200, 2200, { fit: 'inside', withoutEnlargement: true })
        .toBuffer(),
    ])

    for (const buffer of rotatedBuffers) {
      const recognized = await recognizeBuffer(buffer)
      const score = scoreOcrText(recognized)
      if (score > bestScore) {
        bestScore = score
        bestText = recognized
      }
    }
  }

  return bestText || ''
}

/**
 * 根据文件类型选择解析方式
 */
async function extractDocumentText(filePath, mimetype) {
  if (mimetype === 'application/pdf') {
    return extractPdfText(filePath)
  }
  if (mimetype.startsWith('image/')) {
    return extractImageText(filePath)
  }
  throw new Error('Unsupported file type. Only PDF and images are supported.')
}

module.exports = {
  extractDocumentText,
  extractPdfText,
  extractImageText,
  extractWithOllama,
  getOllamaModels,
  hasVisionModel,
  tryParseJson,
  getDefaultPrompt,
}
