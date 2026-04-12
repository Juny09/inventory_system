<script setup>
import { BrowserMultiFormatReader } from '@zxing/browser'
import { onBeforeUnmount, ref } from 'vue'

const emit = defineEmits(['detected'])

const videoRef = ref(null)
const errorMessage = ref('')
const scanning = ref(false)
const reader = new BrowserMultiFormatReader()
let controls = null

async function startScanning() {
  errorMessage.value = ''

  try {
    scanning.value = true
    controls = await reader.decodeFromVideoDevice(undefined, videoRef.value, (result, error) => {
      if (result) {
        emit('detected', result.getText())
        stopScanning()
      }

      if (error?.name === 'NotFoundException') {
        return
      }
    })
  } catch (error) {
    errorMessage.value = 'Camera is unavailable or permission is denied.'
    scanning.value = false
  }
}

function stopScanning() {
  controls?.stop()
  controls = null
  scanning.value = false
}

onBeforeUnmount(() => {
  stopScanning()
})
</script>

<template>
  <div class="rounded-2xl border border-dashed border-slate-300 p-4">
    <div class="flex flex-wrap items-center gap-3">
      <button
        class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        @click="startScanning"
      >
        Start Scan
      </button>
      <button
        class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        @click="stopScanning"
      >
        Stop
      </button>
      <span class="text-sm text-slate-500">Use your camera to capture a barcode or QR code.</span>
    </div>

    <video ref="videoRef" class="mt-4 min-h-52 w-full rounded-2xl bg-slate-950 object-cover" />
    <p v-if="scanning" class="mt-3 text-sm text-emerald-600">Scanning...</p>
    <p v-if="errorMessage" class="mt-3 text-sm text-rose-500">{{ errorMessage }}</p>
  </div>
</template>
