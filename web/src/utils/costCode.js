function digitToCode(digit) {
  const map = {
    0: 'T',
    1: 'E',
    2: 'S',
    3: 'I',
    4: 'N',
    5: 'R',
    6: 'A',
    7: 'M',
    8: 'P',
    9: 'U',
  }
  return map[digit]
}

function codeToDigit(letter) {
  const map = {
    T: 0,
    E: 1,
    S: 2,
    I: 3,
    N: 4,
    R: 5,
    A: 6,
    M: 7,
    P: 8,
    U: 9,
    X: 0,
    O: 0,
  }
  return map[String(letter || '').toUpperCase()] ?? null
}

function toSafeInt(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return null
  }
  const rounded = Math.round(numberValue)
  if (!Number.isFinite(rounded) || rounded < 0) {
    return null
  }
  return rounded
}

export function encodeCostToCode(value) {
  const amount = toSafeInt(value)
  if (amount === null) {
    return ''
  }

  if (amount < 10) {
    return `${digitToCode(amount)}XO`
  }

  if (amount < 100) {
    const tens = Math.floor(amount / 10)
    const ones = amount % 10
    return `${digitToCode(tens)}${digitToCode(ones)}X`
  }

  if (amount < 1000) {
    const hundreds = Math.floor(amount / 100)
    const tens = Math.floor((amount % 100) / 10)
    const ones = amount % 10
    return `${digitToCode(hundreds)}H${digitToCode(tens)}${digitToCode(ones)}X`
  }

  if (amount < 10000) {
    const thousands = Math.floor(amount / 1000)
    const hundreds = Math.floor((amount % 1000) / 100)
    const tens = Math.floor((amount % 100) / 10)
    const ones = amount % 10
    return `${digitToCode(thousands)}Y${digitToCode(hundreds)}H${digitToCode(tens)}${digitToCode(ones)}X`
  }

  return ''
}

export function decodeCodeToCost(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '')

  if (!raw) return null

  if (/^[TESINRAMPU][XO]+$/.test(raw)) {
    return codeToDigit(raw[0])
  }

  const suffix = raw.endsWith('X') || raw.endsWith('O') ? raw[raw.length - 1] : null
  const normalized = suffix ? raw.slice(0, -1) : raw

  if (!normalized) return null

  if (/^[TESINRAMPU][XO]$/.test(normalized) && suffix) {
    return codeToDigit(normalized[0])
  }

  if (normalized.length === 2) {
    const tens = codeToDigit(normalized[0])
    const ones = codeToDigit(normalized[1])
    if (tens === null || ones === null) return null
    return tens * 10 + ones
  }

  if (normalized.length === 4 && normalized[1] === 'H') {
    const hundreds = codeToDigit(normalized[0])
    const tens = codeToDigit(normalized[2])
    const ones = codeToDigit(normalized[3])
    if (hundreds === null || tens === null || ones === null) return null
    return hundreds * 100 + tens * 10 + ones
  }

  if (normalized.length === 6 && normalized[1] === 'Y' && normalized[3] === 'H') {
    const thousands = codeToDigit(normalized[0])
    const hundreds = codeToDigit(normalized[2])
    const tens = codeToDigit(normalized[4])
    const ones = codeToDigit(normalized[5])
    if (thousands === null || hundreds === null || tens === null || ones === null) return null
    return thousands * 1000 + hundreds * 100 + tens * 10 + ones
  }

  return null
}
