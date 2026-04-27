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

