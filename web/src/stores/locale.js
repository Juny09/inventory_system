import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { messages } from '../utils/i18n'

const STORAGE_KEY = 'inventory_locale'

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref(localStorage.getItem(STORAGE_KEY) || 'en')

  const currentLocale = computed(() => (locale.value === 'cn' ? 'cn' : 'en'))

  function setLocale(nextLocale) {
    locale.value = nextLocale === 'cn' ? 'cn' : 'en'
    localStorage.setItem(STORAGE_KEY, locale.value)
  }

  function toggleLocale() {
    setLocale(currentLocale.value === 'en' ? 'cn' : 'en')
  }

  function t(key, fallback = '') {
    const localizedValue = messages[currentLocale.value]?.[key]

    if (localizedValue !== undefined) {
      return localizedValue
    }

    return messages.en?.[key] ?? fallback ?? key
  }

  return {
    locale: currentLocale,
    setLocale,
    toggleLocale,
    t,
  }
})
