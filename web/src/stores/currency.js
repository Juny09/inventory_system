import { ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'inventory_currency'
const ALLOWED = new Set(['MYR', 'USD'])

export const useCurrencyStore = defineStore('currency', () => {
  const currency = ref(ALLOWED.has(localStorage.getItem(STORAGE_KEY) || '') ? localStorage.getItem(STORAGE_KEY) : 'MYR')

  function setCurrency(value) {
    const next = String(value || '').toUpperCase()
    currency.value = ALLOWED.has(next) ? next : 'MYR'
    localStorage.setItem(STORAGE_KEY, currency.value)
  }

  return {
    currency,
    setCurrency,
  }
})
