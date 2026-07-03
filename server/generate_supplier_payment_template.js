const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

// 中文说明：模板文件放在前端 public 目录，这样页面可以直接下载，不需要额外后端接口。
const outputDir = path.resolve(__dirname, '../web/public/templates')
const outputPath = path.join(outputDir, 'supplier-payment-import-template.xlsx')

// 中文说明：第一个工作表只保留表头，避免用户下载后忘记删除示例数据而误导入。
const templateRows = [
  ['CHEQUE NUM', 'DESC', 'REF', 'WITHDRAW DR', 'CR', 'CANCEL', 'Month', 'Year'],
]

// 中文说明：第二个工作表给小白用户看填写规则，避免不知道每一列怎么填。
const instructionRows = [
  ['Field', 'How to fill'],
  ['CHEQUE NUM', 'Cheque number, optional but recommended'],
  ['DESC', 'Must match one active supplier name in the system'],
  ['REF', 'Notes such as rental payment or salary'],
  ['WITHDRAW DR', 'Payment amount to import'],
  ['CR', 'Reference only, will not update supplier payment amount'],
  ['CANCEL', 'If any value exists, that row will be skipped'],
  ['Month', 'Month number from 1 to 12'],
  ['Year', '4-digit year such as 2026'],
  ['Important', 'One row must represent one supplier payment for one month only'],
]

fs.mkdirSync(outputDir, { recursive: true })

const workbook = XLSX.utils.book_new()
const templateSheet = XLSX.utils.aoa_to_sheet(templateRows)
templateSheet['!cols'] = [
  { wch: 18 },
  { wch: 28 },
  { wch: 28 },
  { wch: 16 },
  { wch: 12 },
  { wch: 14 },
  { wch: 10 },
  { wch: 10 },
]
XLSX.utils.book_append_sheet(workbook, templateSheet, 'SupplierPayments')

const instructionSheet = XLSX.utils.aoa_to_sheet(instructionRows)
instructionSheet['!cols'] = [
  { wch: 18 },
  { wch: 68 },
]
XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions')

XLSX.writeFile(workbook, outputPath)
console.log(`Template generated: ${outputPath}`)
