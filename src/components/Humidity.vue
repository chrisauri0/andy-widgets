
<template>
  <div class="humidity-view">
    <h2 class="title">Relative Humidity Prediction</h2>
    <div class="location-controls">
      <button @click="showMap = true">Select on map</button>
      <button @click="getCurrentLocation">Use current location</button>
      <span v-if="lat && lon" class="coords">Lat: {{ lat }}, Lon: {{ lon }}</span>
      <label style="margin-left:1rem;">Interval:
        <select v-model="interval">
             <option value="1H">1H</option>
             <option value="3H">3H</option>
             <option value="6H">6H</option>
          <option value="12H">12H</option>
          <option value="24H">24H</option>
        </select>
      </label>
      <label style="margin-left:1rem;">End date:
        <input type="date" v-model="endDate" />
      </label>
    </div>
    <canvas ref="chartRef" width="600" height="300"></canvas>
   
    <div v-if="showMap" class="modal">
      <div class="modal-content">
        <div id="map" style="height: 400px;"></div>
        <button @click="showMap = false">Close</button>
      </div>
    </div>
  </div>

  <div class="text-informative" style="margin:2rem 0;">
    <h2>Relative Humidity Widget</h2>
    <p>
      This widget displays the evolution of relative humidity at a specific geographic point, using data from the <code>/api/v1/humidity</code> endpoint. You can select the date range, interval, location, and parameter to analyze changes in ambient humidity.
      <br><br>
      <strong>Parameters:</strong>
      <ul>
        <li><strong>start</strong>: Start date and time in ISO8601 format (e.g., 2025-10-04T00:00:00Z).</li>
        <li><strong>end</strong>: End date and time in ISO8601 format (e.g., 2025-10-07T00:00:00Z).</li>
        <li><strong>interval</strong>: Interval between data points (e.g., 1H for every hour).</li>
        <li><strong>parameters</strong>: Relative humidity parameter (default: <code>humidity_1h:p</code>).</li>
        <li><strong>lat</strong>: Latitude of the query point.</li>
        <li><strong>lon</strong>: Longitude of the query point.</li>
      </ul>
      <br>
      The chart allows you to visualize how relative humidity changes over the selected period, helping to identify environmental conditions.
    </p>
  </div>
  <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
    <button @click="downloadJson">Download JSON</button>
    <button @click="downloadCsv">Download CSV</button>
  </div>

</template>

<script setup>
function downloadJson() {
  const blob = new Blob([JSON.stringify(humidityList.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Humidity_${startDate.value}.json`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

function downloadCsv() {
  if (!humidityList.value.length) return
  const header = 'date,value\n'
  const rows = humidityList.value.map((d) => `${d.date},${d.value}`)
  const csv = header + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Humidity_${startDate.value}.csv`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const chartRef = ref(null)
const chartInstance = ref(null)
const humidityList = ref([])
const dates = ref([])
const values = ref([])
const lat = ref(20)
const lon = ref(-92)
const showMap = ref(false)
const interval = ref('12H')
const endDate = ref(new Date().toISOString().slice(0,10)) // formato yyyy-mm-dd

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

async function fetchHumidity() {
  // Fecha inicio fija, fecha final dinámica
  const start = '2025-10-04T00:00:00Z'
  const end = endDate.value + 'T00:00:00Z'
  const url = `http://172.18.0.45:8080/api/v1/humidity?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&interval=${interval.value}&parameters=relative_humidity_2m%3Ap&lat=${lat.value}&lon=${lon.value}&format=json`
  try {
    const res = await fetch(url)
    const dataJson = await res.json()
    const coord = dataJson.data[0].coordinates[0]
    dates.value = []
    values.value = []
    humidityList.value = []
    for (const d of coord.dates) {
      dates.value.push(d.date)
      values.value.push(d.value)
      humidityList.value.push({ date: d.date, value: d.value })
    }
    renderChart()
  } catch (e) {
    console.error('Error al obtener datos de humedad', e)
  }
}

function renderChart() {
  if (chartInstance.value) {
    chartInstance.value.destroy()
  }
  if (chartRef.value) {
    chartInstance.value = new Chart(chartRef.value, {
      type: 'line',
      data: {
        labels: dates.value.map(formatDate),
        datasets: [{
          label: 'Humidity (%)',
          data: values.value,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
        },
        scales: {
          x: { title: { display: true, text: 'Date' } },
          y: { title: { display: true, text: 'Humidity (%)' }, min: 0, max: 100 },
        },
      },
    })
  }
}

function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        lat.value = pos.coords.latitude
        lon.value = pos.coords.longitude
      },
      err => {
        alert('No se pudo obtener la ubicación actual')
      }
    )
  } else {
    alert('Geolocalización no soportada')
  }
}

onMounted(() => {
  fetchHumidity()
})

watch([lat, lon, interval, endDate], () => {
  fetchHumidity()
})

watch(showMap, (val) => {
  if (val) {
    setTimeout(() => {
      loadMap()
    }, 100)
  }
})

function loadMap() {
  if (!window.L) {
    const leafletScript = document.createElement('script')
    leafletScript.src = 'https://unpkg.com/leaflet/dist/leaflet.js'
    leafletScript.onload = () => initMap()
    document.body.appendChild(leafletScript)
    const leafletCss = document.createElement('link')
    leafletCss.rel = 'stylesheet'
    leafletCss.href = 'https://unpkg.com/leaflet/dist/leaflet.css'
    document.head.appendChild(leafletCss)
  } else {
    initMap()
  }
}

function initMap() {
  const map = window.L.map('map').setView([lat.value, lon.value], 6)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map)
  let marker = window.L.marker([lat.value, lon.value], { draggable: true }).addTo(map)
  marker.on('dragend', function(e) {
    const pos = marker.getLatLng()
    lat.value = pos.lat
    lon.value = pos.lng
    map.setView([pos.lat, pos.lng])
  })
  map.on('click', function(e) {
    marker.setLatLng(e.latlng)
    lat.value = e.latlng.lat
    lon.value = e.latlng.lng
  })
}
</script>

<style scoped>
.humidity-view {
  max-width: 100%;
  margin: 2rem auto;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 2rem;
}
.title {
  text-align: center;
  margin-bottom: 1rem;
  color: #2563eb;
}
.location-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}
.location-controls label {
  font-size: 0.95rem;
  color: #444;
}
.location-controls select, .location-controls input[type="date"] {
  margin-left: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  border: 1px solid #ccc;
}
.location-controls button {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.coords {
  font-size: 0.95rem;
  color: #444;
}
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  min-width: 450px;
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
}
</style>
