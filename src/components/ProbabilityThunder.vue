<template>
  <div class="thunder-map-view">
    <h2 class="title">Mapa de Probabilidad de Tormenta Eléctrica</h2>
    <div class="controls">
      <label>Fecha y hora:
        <input type="datetime-local" v-model="datetime" />
      </label>
      <span style="margin-left:1rem;">Selecciona área en el mapa:</span>
      <button @click="enableAreaSelect">Seleccionar área</button>
      <span v-if="areaTopLeft && areaBotRight" class="coords">
        Área: {{ areaTopLeft.lat.toFixed(2) }},{{ areaTopLeft.lon.toFixed(2) }} a {{ areaBotRight.lat.toFixed(2) }},{{ areaBotRight.lon.toFixed(2) }}
      </span>
    </div>
    <div id="thunder-map" style="height: 500px; width: 100%; margin-top:1rem;"></div>
    <div class="legend">
      <span><span class="legend-dot" style="background:#f59e42"></span> Muy alta (&gt;70%)</span>
      <span><span class="legend-dot" style="background:#fbbf24"></span> Media (&gt;40%)</span>
      <span><span class="legend-dot" style="background:#60a5fa"></span> Baja (&le;40%)</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const datetime = ref(new Date().toISOString().slice(0,16))
const mapInstance = ref(null)
const markers = ref([])
const areaTopLeft = ref({ lat: 22, lon: -98 })
const areaBotRight = ref({ lat: 18, lon: -90 })
const selectingArea = ref(false)

function getApiUrl() {
  return `http://172.18.0.45:8080/api/v1/thunderstorm_probabilities?parameters=prob_tstorm_12h%3Ap&grid_cords_top_left=${areaTopLeft.value.lat}%2C${areaTopLeft.value.lon}&grid_cords_bot_right=${areaBotRight.value.lat}%2C${areaBotRight.value.lon}&grid=25x25&datetime=${encodeURIComponent(datetime.value)}&format=json`
}

async function fetchThunderMap() {
  const url = getApiUrl()
  try {
    const res = await fetch(url)
    const dataJson = await res.json()
    const coords = dataJson.data[0].coordinates
    renderMap(coords)
  } catch (e) {
    console.error('Error al obtener datos de tormenta', e)
  }
}

function renderMap(coords) {
  if (!window.L) {
    loadLeaflet(() => renderMap(coords))
    return
  }
  if (!mapInstance.value) {
    mapInstance.value = window.L.map('thunder-map').setView([20, -94], 6)
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
    }).addTo(mapInstance.value)
    addAreaSelect()
  }
  // Limpiar marcadores previos
  markers.value.forEach(m => mapInstance.value.removeLayer(m))
  markers.value = []
  // Calcular min/max para escala de color
  const values = coords.map(c => c.dates[0].value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // Agregar círculos
  coords.forEach(c => {
    const val = c.dates[0].value
    const color = getColor(val)
    const icon = val >= 70 ? '⚡' : val >= 40 ? '🌩️' : '🌧️'
    const circle = window.L.circleMarker([c.lat, c.lon], {
      radius: 10,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 1
    }).addTo(mapInstance.value)
    circle.bindTooltip(`${icon} ${val}%`, {permanent: false, direction: 'top'})
    markers.value.push(circle)
  })
  drawAreaBox()
}

function enableAreaSelect() {
  selectingArea.value = true
  if (mapInstance.value) {
    mapInstance.value.once('click', function(e) {
      areaTopLeft.value = { lat: e.latlng.lat, lon: e.latlng.lng }
      mapInstance.value.once('click', function(e2) {
        areaBotRight.value = { lat: e2.latlng.lat, lon: e2.latlng.lng }
        selectingArea.value = false
        fetchThunderMap()
      })
    })
  }
}

function drawAreaBox() {
  if (!mapInstance.value) return
  if (mapInstance.value._areaBox) {
    mapInstance.value.removeLayer(mapInstance.value._areaBox)
  }
  if (areaTopLeft.value && areaBotRight.value) {
    const bounds = [
      [areaTopLeft.value.lat, areaTopLeft.value.lon],
      [areaBotRight.value.lat, areaBotRight.value.lon]
    ]
    mapInstance.value._areaBox = window.L.rectangle(bounds, {
      color: '#f59e42',
      weight: 2,
      fillOpacity: 0.1
    }).addTo(mapInstance.value)
  }
}

function getColor(val) {
  // Muy alta: naranja, Media: amarillo, Baja: azul
  if (val >= 70) return '#f59e42'
  if (val >= 40) return '#fbbf24'
  return '#60a5fa'
}

function loadLeaflet(cb) {
  if (!window.L) {
    const leafletScript = document.createElement('script')
    leafletScript.src = 'https://unpkg.com/leaflet/dist/leaflet.js'
    leafletScript.onload = cb
    document.body.appendChild(leafletScript)
    const leafletCss = document.createElement('link')
    leafletCss.rel = 'stylesheet'
    leafletCss.href = 'https://unpkg.com/leaflet/dist/leaflet.css'
    document.head.appendChild(leafletCss)
  } else {
    cb()
  }
}

function addAreaSelect() {
  // No-op, solo para compatibilidad visual
}

onMounted(() => {
  fetchThunderMap()
})

watch(datetime, () => {
  fetchThunderMap()
})
</script>

<style scoped>
.thunder-map-view {
  max-width: 1200px;
  margin: 2rem auto;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 2rem;
}
.title {
  text-align: center;
  margin-bottom: 1rem;
  color: #f59e42;
}
.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.controls label {
  font-size: 0.95rem;
  color: #444;
}
.controls input[type="datetime-local"] {
  margin-left: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  border: 1px solid #ccc;
}
.controls button {
  background: #f59e42;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.legend {
  margin-top: 1rem;
  display: flex;
  gap: 2rem;
  font-size: 1rem;
  align-items: center;
}
.legend-dot {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-right: 0.5em;
  vertical-align: middle;
  border: 2px solid #fff;
  box-shadow: 0 0 2px #888;
}
.coords {
  font-size: 0.95rem;
  color: #6366f1;
  margin-left: 1rem;
  font-weight: bold;
}
</style>