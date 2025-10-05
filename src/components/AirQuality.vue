<template>
  <div class="air-quality-view">
    <h2 class="title">Calidad del Aire</h2>
    <div class="controls">
      <label>Fecha inicial:
        <input type="date" v-model="startDate" />
      </label>
      <label>Días:
        <input type="number" min="1" max="7" v-model="days" />
      </label>
      <label>Intervalo:
        <select v-model="interval">
          <option value="PT1H">1H</option>
          <option value="PT3H">3H</option>
          <option value="PT6H">6H</option>
        </select>
      </label>
      <label>Latitud:
        <input type="number" step="0.0001" v-model="lat" />
      </label>
      <label>Longitud:
        <input type="number" step="0.0001" v-model="lon" />
      </label>
      <button @click="fetchAirQuality">Actualizar</button>
      <button @click="showMap = true">Seleccionar en mapa</button>
      <button @click="getCurrentLocation">Usar ubicación actual</button>
    </div>
    <div v-if="showMap" class="modal">
      <div class="modal-content">
        <h3>Selecciona una ubicación en el mapa</h3>
        <div id="map" style="height:350px;"></div>
        <button @click="showMap = false">Cerrar</button>
      </div>
    </div>
    <canvas ref="chartRef" width="600" height="300"></canvas>
    
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const chartRef = ref(null)
const chartInstance = ref(null)
const airList = ref([])
const dates = ref([])
const values = ref([])
const startDate = ref(new Date().toISOString().slice(0,10))
const days = ref(3)
const interval = ref('PT3H')
const lat = ref(20)
const lon = ref(-92)
const showMap = ref(false)

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function getApiUrl() {
  const dateTime = startDate.value + 'T00:00:00Z'
  const daysFromNow = `P${days.value}D`
  return `http://172.18.0.45:8080/api/v1/total_air_quality?dateTime=${encodeURIComponent(dateTime)}&parameters=air_quality%3Aidx&lat=${lat.value}&lon=${lon.value}&daysFromNow=${daysFromNow}&interval=${interval.value}&format=json`
}

async function fetchAirQuality() {
  const url = getApiUrl()
  try {
    const res = await fetch(url)
    const dataJson = await res.json()
    const coord = dataJson.data[0].coordinates[0]
    dates.value = []
    values.value = []
    airList.value = []
    for (const d of coord.dates) {
      dates.value.push(d.date)
      values.value.push(d.value)
      airList.value.push({ date: d.date, value: d.value })
    }
    renderChart()
  } catch (e) {
    console.error('Error al obtener datos de calidad del aire', e)
  }
}

function getColor(val) {
  if (val <= 50) return '#22c55e' // buena
  if (val <= 100) return '#eab308' // moderada
  if (val <= 150) return '#f59e42' // mala
  return '#ef4444' // muy mala
}

function renderChart() {
  if (chartInstance.value) chartInstance.value.destroy()
  if (chartRef.value) {
    chartInstance.value = new Chart(chartRef.value, {
      type: 'line',
      data: {
        labels: dates.value.map(formatDate),
        datasets: [{
          label: 'Índice de Calidad del Aire',
          data: values.value,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.1)',
          pointBackgroundColor: values.value.map(getColor),
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: true },
        },
        scales: {
          x: { title: { display: true, text: 'Fecha' } },
          y: { title: { display: true, text: 'Índice' }, min: 0 },
        },
      },
    })
  }
}

function getCurrentLocation() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(pos => {
    lat.value = pos.coords.latitude
    lon.value = pos.coords.longitude
    fetchAirQuality()
  })
}

// Leaflet map integration
function loadLeaflet(cb) {
  if (window.L) return cb()
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet/dist/leaflet.css'
  document.head.appendChild(link)
  const script = document.createElement('script')
  script.src = 'https://unpkg.com/leaflet/dist/leaflet.js'
  script.onload = cb
  document.body.appendChild(script)
}

watch(showMap, (val) => {
  if (val) {
    loadLeaflet(() => {
      const map = window.L.map('map').setView([lat.value, lon.value], 6)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18
      }).addTo(map)
      let marker
      map.on('click', e => {
        lat.value = e.latlng.lat
        lon.value = e.latlng.lng
        if (marker) map.removeLayer(marker)
        marker = window.L.marker([lat.value, lon.value]).addTo(map)
        fetchAirQuality()
        showMap.value = false
        setTimeout(() => map.remove(), 500)
      })
    })
  }
})

onMounted(() => {
  fetchAirQuality()
})

watch([startDate, days, interval, lat, lon], () => {
  fetchAirQuality()
})
</script>

<style scoped>
.air-quality-view {
  max-width: 700px;
  margin: 2rem auto;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 2rem;
}
.title {
  text-align: center;
  margin-bottom: 1rem;
  color: #22c55e;
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
.controls input, .controls select {
  margin-left: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  border: 1px solid #ccc;
}
.controls button {
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.list {
  margin-top: 2rem;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.icon {
  font-size: 1.4rem;
}
.modal {
  position: fixed;
  top:0; left:0; right:0; bottom:0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  min-width: 350px;
}
</style>  