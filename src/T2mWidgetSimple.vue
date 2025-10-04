<template>
  <div class="t2m-widget">
    <header class="header">
      <h3>Temperatura (2 m)</h3>
      <small class="unit">°C</small>
    </header>

    <main class="main">
      <div class="left">
        <div class="current" aria-live="polite">{{ displayLastValue }}</div>
        <div class="delta" v-if="delta !== null">{{ deltaLabel }}</div>
        <div class="meta">Última: {{ lastTsDisplay }}</div>
      </div>

      <div class="right">
        <!-- Sparkline SVG simple -->
        <svg v-if="points.length" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="sparkline" role="img" aria-hidden="true">
          <path :d="path" fill="none" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        <div v-else class="placeholder">Cargando...</div>
      </div>
    </main>

    <footer class="footer">
      <button @click="refresh">Refrescar</button>
      <label class="unit-toggle"><input type="checkbox" v-model="useFahrenheit" /> °F</label>
      <div v-if="error" class="error">{{ error }}</div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

/*
  Uso: <T2mWidgetSimple apiUrl="/mock/t2m_series.json" />
  - apiUrl: ruta al JSON (por defecto '/mock/t2m_series.json')
  - pollInterval (segundos) si quieres auto-poll (opcional)
*/

const props = defineProps({
  apiUrl: { type: String, default: '/mock/t2m_series.json' },
  pollInterval: { type: Number, default: 0 } // segundos, 0 = no poll
})

const points = ref([]) // { ts, value }
const lastValue = ref(null)
const lastTs = ref(null)
const error = ref(null)
const useFahrenheit = ref(false)
let timer = null

const WIDTH = 160
const HEIGHT = 48

async function fetchSeries() {
  error.value = null
  try {
    const res = await fetch(props.apiUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    // Asumimos data.series === [{ts, value}, ...] y data.summary
    points.value = (data.series || []).map(p => ({ ts: p.ts, value: Number(p.value) }))
    if (data.summary?.last_value != null) {
      lastValue.value = Number(data.summary.last_value)
      lastTs.value = data.summary.last_ts || (points.value.length ? points.value[points.value.length-1].ts : null)
    } else if (points.value.length) {
      const last = points.value[points.value.length-1]
      lastValue.value = last.value
      lastTs.value = last.ts
    }
  } catch (err) {
    error.value = err.message || String(err)
  }
}

function refresh() {
  fetchSeries()
}

onMounted(() => {
  fetchSeries()
  if (props.pollInterval && props.pollInterval > 0) {
    timer = setInterval(fetchSeries, props.pollInterval * 1000)
  }
})

if (timer) {
  // cleanup on hot-reload / unmount (basic)
  try { clearInterval(timer) } catch {}
}

// -- computed display values --
const displayLastValue = computed(() => {
  if (lastValue.value === null || lastValue.value === undefined) return '—'
  const v = useFahrenheit.value ? (lastValue.value * 9/5 + 32) : lastValue.value
  return `${Number(v).toFixed(1)} ${useFahrenheit.value ? '°F' : '°C'}`
})

const lastTsDisplay = computed(() => {
  if (!lastTs.value) return '—'
  try { return new Date(lastTs.value).toLocaleString() } catch { return lastTs.value }
})

// delta: difference between last and first point (simple)
const delta = computed(() => {
  if (!points.value.length) return null
  const first = points.value[0].value
  const last = points.value[points.value.length - 1].value
  return +(last - first).toFixed(2)
})

const deltaLabel = computed(() => {
  if (delta.value === null) return ''
  const d = useFahrenheit.value ? +(delta.value * 9/5).toFixed(2) : delta.value
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d} ${useFahrenheit.value ? '°F' : '°C'} (desde inicio)`
})

// sparkline path generator (very simple linear scale)
const minVal = computed(() => points.value.length ? Math.min(...points.value.map(p => p.value)) : 0)
const maxVal = computed(() => points.value.length ? Math.max(...points.value.map(p => p.value)) : 1)

const path = computed(() => {
  if (!points.value.length) return ''
  const len = points.value.length
  const xStep = WIDTH / Math.max(len - 1, 1)
  const vMin = minVal.value
  const vMax = maxVal.value === vMin ? vMin + 1 : maxVal.value
  const scaleY = v => {
    // map value to SVG Y (0 top -> HEIGHT bottom)
    const t = (v - vMin) / (vMax - vMin)
    return HEIGHT - t * HEIGHT
  }
  return points.value.map((p, i) => {
    const x = (i * xStep)
    const y = scaleY(p.value)
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
})
</script>

<style scoped>
.t2m-widget {
  width: 320px;
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 6px rgba(0,0,0,.06);
  font-family: Inter, Arial, sans-serif;
  color: #111;
}
.header{display:flex;justify-content:space-between;align-items:center}
.header h3{margin:0;font-size:14px}
.unit{color:#666;font-size:12px}
.main{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.left{flex:1}
.current{font-weight:700;font-size:22px}
.delta{color:#0b7; font-size:12px;margin-top:4px}
.meta{color:#666;font-size:12px;margin-top:6px}
.right{width:170px; display:flex; align-items:center; justify-content:center}
.sparkline{width:160px;height:48px}
.sparkline path{stroke:#1f8ef1; fill:none}
.placeholder{color:#888;font-size:13px}
.footer{display:flex;align-items:center;gap:10px;margin-top:10px}
.footer button{padding:6px 8px;border-radius:6px;border:1px solid #ddd;background:#fafafa;cursor:pointer}
.unit-toggle{margin-left:auto;font-size:13px;color:#444}
.error{color:#b00020;font-size:13px;margin-left:10px}
</style>
