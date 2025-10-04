<template>
  <div class="t2m-table-widget">
    <header class="header">
      <h3>Predicción de temperatura maxima por intervalos</h3>
      <div class="controls-top">
        <label class="small">
          <input type="checkbox" v-model="useFahrenheit" /> Mostrar °F
        </label>
      </div>
    </header>

    <!-- Controls row -->
    <section class="controls">
      <div class="col">
        <div style="">
            <label>Latitud : <input v-model="latInput" inputmode="decimal" disabled /></label>
            <label>Longitud : <input v-model="lonInput" inputmode="decimal" disabled /></label>

        </div>
        <!-- <button @click="applyCoords" :disabled="applying">Aplicar coords</button> -->
        <button @click="useMyLocation" :disabled="geoPending">Usar mi ubicación</button>
        <button @click="showMap = !showMap" style="margin-top:8px">Seleccionar en mapa</button>
        <div v-if="showMap" class="map-modal">
          <div class="map-header">
            <span>Selecciona una ubicación en el mapa</span>
            <button @click="showMap = false">Cerrar</button>
          </div>
          <div id="leaflet-map" class="leaflet-map"></div>
        </div>
      </div>

      <div class="col">
        <label>Desde <input type="datetime-local" v-model="startLocal" /></label>
        <label>Hasta <input type="datetime-local" v-model="endLocal" /></label>
        <label>Intervalo
          <select v-model="intervalSelected">
            <option v-for="o in intervalOptions" :key="o" :value="o">{{ o }}</option>
          </select>
        </label>
        <label>Temperatura Máxima °C
          <input type="number" v-model="TemperaturaMax" />
        </label> 
        <div class="buttons-row">
          <button @click="applyAll" :disabled="applying">Aplicar</button>
          <button @click="refresh">Refrescar</button>
        </div>
      </div>
    </section>

    <section class="status">
      <small v-if="loading">Cargando datos…</small>
      <small v-if="error" class="error">Error: {{ error }}</small>
      <small v-if="!loading && !error">Mostrando {{ windows.length }} intervalos · Última actualización: {{ lastFetchedDisplay }}</small>
    </section>

    <!-- Table -->
    <section class="table-wrap" role="region" aria-labelledby="table-title">
      <h4 id="table-title" class="visually-hidden">Tabla de intervalos</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>Hora de medición</th>
            <th>Min</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
        <tr v-if="loading">
  <td colspan="6" class="empty">Cargando datos...</td>
</tr>
<tr v-else-if="!windows.length">
  <td colspan="6" class="empty">No hay datos para mostrar</td>
</tr>
          <tr v-for="w in windows" :key="w.startIso" :class="{ 'no-data': w.count === 0 }">
            <td>{{ fmtLocal(w.startIso) }}</td>
            <td>{{ formatMaybe(w.min) }}</td>
            <td>{{ formatMaybe(w.max) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

// Leaflet
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/* Props */
const props = defineProps({
  baseUrl: { type: String, required: true }, // ej: "http://172.18.0.45:8080/api/v1/temperature"
  parameters: { type: String, default: 't_2m:C' },
  format: { type: String, default: 'json' },
  apiKey: { type: String, required: false }
})

/* State */
const latInput = ref('')
const lonInput = ref('')
const showMap = ref(false)
let map: L.Map | null = null
let marker: L.Marker | null = null
// Inicializa el mapa cuando se muestra el modal
watch(showMap, (val) => {
  if(val){
    setTimeout(() => {
      if(map){
        map.invalidateSize()
        return
      }
      map = L.map('leaflet-map').setView([19.4326, -99.1332], 5) // CDMX por defecto
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        latInput.value = lat.toFixed(6)
        lonInput.value = lng.toFixed(6)
        if(marker){
          marker.setLatLng([lat, lng])
        }else{
          marker = L.marker([lat, lng]).addTo(map)
        }
      })
    }, 100)
  }
})
const TemperaturaMax = ref(0)
const applying = ref(false)
const geoPending = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const useFahrenheit = ref(false)

const intervalOptions = ['1H','3H','5H','12H','24']
const intervalSelected = ref('5H')

// date inputs local
function pad(n:number){ return n<10? '0'+n : ''+n }
function toLocalDefault(offsetDays:number){
  const d = new Date()
  d.setMinutes(0,0,0)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const startLocal = ref(toLocalDefault(-3))
const endLocal = ref(toLocalDefault(0))

/* fetched points and windows */
type Point = { ts: string; value: number }
const points = ref<Point[]>([])
const windows = ref<Array<{ startIso: string; endIso: string; min: number | null; max:  number | null; count: number }>>([])
const lastFetched = ref<Date | null>(null)

/* helpers */
function localToIsoZ(local:string){
  if(!local) return ''
  const d = new Date(local)
  return d.toISOString()
}
function parseIntervalToMs(interval:string){
  // simple parser: number + unit where unit = H or D
 const m = interval.match(/^(\d+)([HD])$/i)
if(!m || !m[2]) return 5 * 60 * 60 * 1000 // default 5H
  const n = Number(m[1])
  const u = m[2].toUpperCase()
  if(u === 'H') return n * 60 * 60 * 1000
  if(u === 'D') return n * 24 * 60 * 60 * 1000
  return 5 * 60 * 60 * 1000
}

/* build url */
function buildUrl(lat:number, lon:number, startIso:string, endIso:string, interval:string){
  const params = new URLSearchParams({
    start: startIso,
    end: endIso,
    interval,
    parameters: props.parameters,
    lat: String(lat),
    lon: String(lon),
    format: props.format
  })
  return `${props.baseUrl}?${params.toString()}`
}

/* fetch raw data from API and populate points[] */
async function fetchPoints(lat:number, lon:number, startIso:string, endIso:string, interval:string){
  loading.value = true
  error.value = null
  points.value = []
  windows.value = []
  try {
    const url = buildUrl(lat, lon, startIso, endIso, interval)
    const headers: Record<string,string> = {}
    if(props.apiKey) headers['Authorization'] = `Bearer ${props.apiKey}`
    const res = await fetch(url, { headers })
    if(!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if(!json || !Array.isArray(json.data) || json.data.length === 0) {
      points.value = []
      return
    }
    const item = json.data.find((d:any) => d.parameter === props.parameters) ?? json.data[0]
    if(!item.coordinates || !Array.isArray(item.coordinates) || item.coordinates.length === 0) {
      points.value = []
      return
    }
    // choose closest coordinate (exact match preferred)
    const coord = item.coordinates.find((c:any) => Number(c.lat) === Number(lat) && Number(c.lon) === Number(lon)) ?? item.coordinates[0]
    const dates = Array.isArray(coord.dates) ? coord.dates : []
    const mapped = dates.map((p:any) => ({ ts: p.date, value: Number(p.value) }))
      .sort((a,b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    points.value = mapped
    lastFetched.value = new Date()
    computeWindows(startIso, endIso, interval)
  } catch(err:any) {
    error.value = err?.message ?? String(err)
    points.value = []
  } finally {
    loading.value = false
  }
}

/* compute windows based on interval and points[] */
function computeWindows(startIso:string, endIso:string, interval:string){
  windows.value = []
  const startMs = new Date(startIso).getTime()
  const endMs = new Date(endIso).getTime()
  if(isNaN(startMs) || isNaN(endMs) || startMs >= endMs) return
  const step = parseIntervalToMs(interval)
  for(let s = startMs; s < endMs; s += step){
    const e = Math.min(s + step, endMs)
    const sIso = new Date(s).toISOString()
    const eIso = new Date(e).toISOString()
    // select points with ts >= s && ts < e (include start, exclude end to avoid overlap)
    const pts = points.value.filter(p => {
      const t = new Date(p.ts).getTime()
      return t >= s && t < e
    })
    if(!pts.length){
      // Solo agrega ventanas vacías si quieres mostrar los intervalos sin datos
      continue
    }
    const values = pts.map(p => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    if(max > TemperaturaMax.value){
      windows.value.push({ startIso: sIso, endIso: eIso, min, max, count: values.length })
    }
  }
}

/* UI helpers */
function fmtLocal(iso:string){
  try { return new Date(iso).toLocaleString() } catch { return iso }
}
function formatMaybe(v:number | null){
  if(v === null || v === undefined) return '—'
  const val = useFahrenheit.value ? (v * 9/5 + 32) : v
  return `${val.toFixed(1)} ${useFahrenheit.value ? '°F' : '°C'}`
}
const coordsLabel = computed(()=> (latInput.value && lonInput.value) ? `${Number(latInput.value).toFixed(6)}, ${Number(lonInput.value).toFixed(6)}` : '—')
const lastFetchedDisplay = computed(()=> lastFetched.value ? lastFetched.value.toLocaleString() : '—')

/* user actions */
async function applyCoords(){
  coordErrorClear()
  applying.value = true
  // basic validation
  const e1 = validateCoordStr(latInput.value,'lat')
  const e2 = validateCoordStr(lonInput.value,'lon')
  if(e1 || e2){ error.value = e1 ?? e2; applying.value = false; return }
  // fetch using current dates/interval
  const startIso = localToIsoZ(startLocal.value)
  const endIso = localToIsoZ(endLocal.value)
  if(!validateRange(startIso,endIso)){ applying.value = false; return }
  await fetchPoints(Number(latInput.value), Number(lonInput.value), startIso, endIso, intervalSelected.value)
  applying.value = false
}

async function applyAll(){ await applyCoords() }
async function refresh(){
  if(!latInput.value || !lonInput.value){ error.value = 'Coordenadas no definidas.'; return }
  const startIso = localToIsoZ(startLocal.value)
  const endIso = localToIsoZ(endLocal.value)
  if(!validateRange(startIso,endIso)) return
  await fetchPoints(Number(latInput.value), Number(lonInput.value), startIso, endIso, intervalSelected.value)
}

/* geolocation */
function coordErrorClear(){ error.value = null }
function useMyLocation(){
  coordErrorClear()
  if(!('geolocation' in navigator)){ error.value = 'Geolocalización no disponible.'; return }
  geoPending.value = true
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    geoPending.value = false
    latInput.value = String(pos.coords.latitude)
    lonInput.value = String(pos.coords.longitude)
    await applyCoords()
  }, (err)=>{
    geoPending.value = false
    error.value = err.code === 1 ? 'Permiso denegado.' : 'Error al obtener ubicación.'
  }, { timeout:10000 })
}

/* validate helpers */
function validateCoordStr(s:string, kind:'lat'|'lon'){
  if(!s || s.trim()==='') return `${kind.toUpperCase()} vacío`
  const n = Number(s)
  if(Number.isNaN(n)) return `${kind.toUpperCase()} no es un número válido`
  if(kind==='lat' && (n < -90 || n > 90)) return 'Lat fuera de rango (-90..90)'
  if(kind==='lon' && (n < -180 || n > 180)) return 'Lon fuera de rango (-180..180)'
  return null
}

function validateRange(startIso:string, endIso:string){
  error.value = null
  if(!startIso || !endIso){ error.value = 'Fecha inicio/fin inválida.'; return false }
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  if(isNaN(s) || isNaN(e)){ error.value = 'Fecha inválida.'; return false }
  if(s >= e){ error.value = 'Fecha inicio debe ser anterior a fecha fin.'; return false }
  return true
}

/* initial sample if props provide defaults (optional) */
onMounted(()=>{
  // if props had lat/lon, fill inputs
  // (props not used here by default)
  // no auto fetch to avoid CORS issues on dev
})
</script>

<style scoped>
.t2m-table-widget{background:#fff;
    border-radius:8px;
    padding:12px;
    box-shadow:0 1px 8px rgba(0,0,0,.06);
    max-width:20dvh;
    max-width: 35dvh;
    font-family:Inter,Arial,sans-serif}
/* Leaflet map modal styles */
.map-modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.25);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 8px 12px;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}
#leaflet-map {
  width: 400px;
  height: 350px;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.controls{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.controls .col{display:flex;flex-direction:column;gap:6px}
.controls label{font-size:13px;color:#333}
.controls input, .controls select{padding:6px;border-radius:6px;border:1px solid #ddd}
.buttons-row{display:flex;gap:8px;margin-top:6px}
.status{margin-bottom:8px;color:#666;font-size:13px}
.error{color:#b00020}
.table-wrap{border:1px solid #eee;border-radius:6px;overflow:auto;max-height:360px}
.data-table{
    width:100%;
    min-width:35dvh;
}
.data-table thead th{
    position:sticky; width: 1.5rem;
    top:0;background:#fafafa;padding:8px;border-bottom:1px solid #eee;text-align:left;font-size:13px}
.data-table tbody td{padding:8px;border-bottom:1px solid #f4f4f4;font-size:13px}
.data-table tbody tr.no-data td{color:#888;font-style:italic}
.empty {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #888;
  font-size: 1rem;
  padding: 20px;
  text-align: center;
  /* Espaciado interno para dar un respiro al texto */
  background-color: #f9f9f9;
  /* Un fondo sutil para diferenciarlo de las filas de datos */
  border-radius: 8px;
  /* Bordes redondeados para un look más moderno */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  /* Una sombra muy suave para que el contenedor resalte */
}

.footer{margin-top:8px;color:#666;font-size:13px}
.visually-hidden{position:absolute !important;height:1px;width:1px;overflow:hidden;clip:rect(1px,1px,1px,1px);white-space:nowrap}
</style>
