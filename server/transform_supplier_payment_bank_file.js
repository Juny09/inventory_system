const path = require('path')
const XLSX = require('xlsx')

const inputPath = '/Users/junyuan78/Documents/trae_projects/inventory_system/mtc ocbc bank statement.xlsx'
const outputPath = '/Users/junyuan78/Documents/trae_projects/inventory_system/mtc ocbc bank statement - supplier payment import.xlsx'

const monthMap = {
  JAN: 1,
  JANUARY: 1,
  FEB: 2,
  FEBRUARY: 2,
  MAR: 3,
  MARCH: 3,
  APR: 4,
  APRIL: 4,
  MAY: 5,
  JUN: 6,
  JUNE: 6,
  JUL: 7,
  JULY: 7,
  AUG: 8,
  AUGUST: 8,
  SEP: 9,
  SEPT: 9,
  SEPTEMBER: 9,
  OCT: 10,
  OCTOBER: 10,
  NOV: 11,
  NOVEMBER: 11,
  DEC: 12,
  DECEMBER: 12,
}

function hasValue(value) {
  return String(value ?? '').trim() !== ''
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function parseNumber(value) {
  if (!hasValue(value)) return ''
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : ''
}

function parsePeriodFromRef(ref) {
  const normalized = cleanText(ref).toUpperCase()
  if (!normalized) {
    return { month: '', year: '', reason: 'Missing REF' }
  }

  const yearMatches = [...normalized.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]))
  const uniqueYears = [...new Set(yearMatches)]

  const monthMatches = [...normalized.matchAll(/\b(JAN|JANUARY|FEB|FEBRUARY|MAR|MARCH|APR|APRIL|MAY|JUN|JUNE|JUL|JULY|AUG|AUGUST|SEP|SEPT|SEPTEMBER|OCT|OCTOBER|NOV|NOVEMBER|DEC|DECEMBER)\b/g)]
    .map((match) => monthMap[match[1]])
    .filter(Boolean)
  const uniqueMonths = [...new Set(monthMatches)]

  // 中文说明：只有“唯一月份 + 唯一年份”才自动带入，像 SEP & OCT 2025 这种多月份先留给人工确认。
  if (uniqueMonths.length === 1 && uniqueYears.length === 1) {
    return { month: uniqueMonths[0], year: uniqueYears[0], reason: '' }
  }
  if (uniqueMonths.length > 1) {
    return { month: '', year: '', reason: 'Multiple months found in REF' }
  }
  if (uniqueYears.length > 1) {
    return { month: '', year: '', reason: 'Multiple years found in REF' }
  }
  if (!uniqueMonths.length || !uniqueYears.length) {
    return { month: '', year: '', reason: 'Cannot safely detect Month/Year from REF' }
  }

  return { month: '', year: '', reason: 'Unknown REF pattern' }
}

function buildRows() {
  const workbook = XLSX.readFile(inputPath)
  const targetSheets = workbook.SheetNames.filter((sheetName) => /CHEQUE/i.test(sheetName))
  const importRows = []
  const reviewRows = []

  for (const sheetName of targetSheets) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })

    for (const row of rows) {
      const chequeNumber = parseNumber(row['CHEQUE NUM'])
      const supplierName = cleanText(row.DESC)
      const notes = cleanText(row.REF)
      const amount = parseNumber(row['WITHDRAW DR'] || row.DR)
      const credit = parseNumber(row.CR)
      const originalCancel = cleanText(row.CANCEL)

      // 中文说明：只有 cheque number 但完全没有付款内容的空白预留支票，不放进导入文件。
      const hasMeaningfulData = supplierName || notes || amount || credit || originalCancel
      if (!hasMeaningfulData) continue

      const period = parsePeriodFromRef(notes)
      let cancel = originalCancel
      let reviewReason = ''

      if (!supplierName) {
        reviewReason = 'Missing DESC'
      } else if (!amount) {
        reviewReason = 'Missing WITHDRAW DR / DR'
      } else if (!period.month || !period.year) {
        reviewReason = period.reason || 'Missing Month/Year'
      }

      if (!cancel && reviewReason) {
        cancel = 'REVIEW'
      }

      const importRow = {
        'CHEQUE NUM': chequeNumber || '',
        DESC: supplierName,
        REF: notes,
        'WITHDRAW DR': amount,
        CR: credit,
        CANCEL: cancel,
        Month: period.month,
        Year: period.year,
      }
      importRows.push(importRow)

      if (cancel || reviewReason) {
        reviewRows.push({
          ...importRow,
          Reason: originalCancel ? 'Original CANCEL has value, row will be skipped' : reviewReason,
          SourceSheet: sheetName,
        })
      }
    }
  }

  return { importRows, reviewRows }
}

function writeWorkbook(importRows, reviewRows) {
  const workbook = XLSX.utils.book_new()

  const importSheet = XLSX.utils.json_to_sheet(importRows, {
    header: ['CHEQUE NUM', 'DESC', 'REF', 'WITHDRAW DR', 'CR', 'CANCEL', 'Month', 'Year'],
  })
  importSheet['!cols'] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 34 },
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(workbook, importSheet, 'SupplierPaymentImport')

  const reviewSheet = XLSX.utils.json_to_sheet(reviewRows, {
    header: ['CHEQUE NUM', 'DESC', 'REF', 'WITHDRAW DR', 'CR', 'CANCEL', 'Month', 'Year', 'Reason', 'SourceSheet'],
  })
  reviewSheet['!cols'] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 34 },
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 36 },
    { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(workbook, reviewSheet, 'ReviewNeeded')

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Item', 'Count'],
    ['Total rows prepared', importRows.length],
    ['Rows needing skip/review', reviewRows.length],
    ['Input file', path.basename(inputPath)],
    ['Output file', path.basename(outputPath)],
  ])
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

  XLSX.writeFile(workbook, outputPath)
}

const { importRows, reviewRows } = buildRows()
writeWorkbook(importRows, reviewRows)

console.log(`Created: ${outputPath}`)
console.log(`Import rows: ${importRows.length}`)
console.log(`Review rows: ${reviewRows.length}`)
