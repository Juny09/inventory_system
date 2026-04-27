export function formatMoney(value, currency, locale) {
  const numberValue = Number(value || 0)
  if (!Number.isFinite(numberValue)) {
    return ''
  }

  const resolvedCurrency = String(currency || 'MYR').toUpperCase()
  const resolvedLocale =
    resolvedCurrency === 'MYR'
      ? 'ms-MY'
      : locale === 'cn'
        ? 'zh-CN'
        : 'en-US'
  return new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency: resolvedCurrency }).format(numberValue)
}
