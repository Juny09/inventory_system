export function exportToCsv(filename, columns, rows) {
  const csvRows = [
    columns.map((column) => `"${column.label.replaceAll('"', '""')}"`).join(','),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const value = row[column.key] ?? ''
          return `"${String(value).replaceAll('"', '""')}"`
        })
        .join(','),
    ),
  ]

  const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export async function exportToPdf(title, filename, columns, rows) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  })

  doc.setFontSize(16)
  doc.text(title, 40, 36)

  autoTable(doc, {
    startY: 56,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => row[column.key] ?? '')),
    styles: {
      fontSize: 9,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [15, 23, 42],
    },
  })

  doc.save(filename)
}

export function exportToJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function printHtmlDocument(title, content) {
  const printWindow = window.open('', '_blank', 'width=960,height=720')

  if (!printWindow) {
    throw new Error('Print window was blocked by browser.')
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h1 { margin: 0 0 16px; font-size: 24px; }
          p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
