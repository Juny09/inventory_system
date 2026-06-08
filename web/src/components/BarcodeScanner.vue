<script setup>
import { BrowserMultiFormatReader } from '@zxing/browser'
import { onBeforeUnmount, nextTick, ref, watch } from 'vue'

const props = defineProps({
  autoStart: { type: Boolean, default: false },
  stopAfterDetect: { type: Boolean, default: true },
  showControls: { type: Boolean, default: true },
  startLabel: { type: String, default: 'Start Scan' },
  stopLabel: { type: String, default: 'Stop' },
  hintText: { type: String, default: 'Use your camera to capture a barcode or QR code.' },
  preferredFacingMode: { type: String, default: 'environment' },
  panelClass: { type: String, default: 'rounded-2xl border border-dashed border-slate-300 p-3' },
  videoClass: { type: String, default: 'mt-3 min-h-40 w-full rounded-2xl bg-slate-950 object-cover' },
})

const emit = defineEmits(['detected'])

const videoRef = ref(null)
const errorMessage = ref('')
const scanning = ref(false)
const reader = new BrowserMultiFormatReader()
let controls = null

function handleDecode(result, error) {
  if (result) {
    emit('detected', result.getText())
    if (props.stopAfterDetect) {
      stopScanning()
    }
    return
  }

  if (error?.name === 'NotFoundException') {
    return
  }
}

async function startScanning() {
  if (scanning.value) return
  errorMessage.value = ''

  try {
    scanning.value = true
    await nextTick()
    if (!videoRef.value) return

    // 中文注释：优先请求手机后置摄像头，移动端扫码会更稳定；不支持时再回退到默认设备。
    if (typeof reader.decodeFromConstraints === 'function') {
      controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: props.preferredFacingMode },
          },
        },
        videoRef.value,
        handleDecode,
      )
      return
    }

    controls = await reader.decodeFromVideoDevice(undefined, videoRef.value, handleDecode)
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

watch(
  () => props.autoStart,
  async (enabled) => {
    if (enabled) {
      await startScanning()
      return
    }
    stopScanning()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopScanning()
})
</script>

<template>
  <div :class="panelClass">
    <div v-if="showControls" class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        @click="startScanning"
      >
        {{ startLabel }}
      </button>
      <button
        type="button"
        class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        @click="stopScanning"
      >
        {{ stopLabel }}
      </button>
      <span class="text-sm text-slate-500">{{ hintText }}</span>
    </div>

    <video ref="videoRef" :class="videoClass" />
    <p v-if="scanning" class="mt-3 text-sm text-emerald-600">Scanning...</p>
    <p v-if="errorMessage" class="mt-3 text-sm text-rose-500">{{ errorMessage }}</p>
  </div>
</template>
