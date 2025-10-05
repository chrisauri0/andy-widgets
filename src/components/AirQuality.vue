<template>
  
  <div class="air-quality-view">
    <h2 class="title">Air Quality</h2>
    <div class="controls">
      <label>Start date:
        <input type="date" v-model="startDate" />
      </label>
      <label>Days:
        <input type="number" min="1" max="7" v-model="days" />
      </label>
      <label>Interval:
        <select v-model="interval">
          <option value="PT1H">1H</option>
          <option value="PT3H">3H</option>
          <option value="PT6H">6H</option>
        </select>
      </label>
      <label>Latitude:
        <input type="number" step="0.0001" v-model="lat" />
      </label>
      <label>Longitude:
        <input type="number" step="0.0001" v-model="lon" />
      </label>
      <button @click="fetchAirQuality">Update</button>
      <button @click="showMap = true">Select on map</button>
      <button @click="getCurrentLocation">Use current location</button>
    </div>
    <canvas ref="chartRef" width="600" height="300"></canvas>
    <div v-if="showMap" class="modal">
      <div class="modal-content">
        <h3>Select a location on the map</h3>
        <div id="map" style="height:350px;"></div>
        <button @click="showMap = false">Close</button>
      </div>
    </div>
  </div>


  <div class="text-informative">
    <h2>Air Quality Widget</h2>
    <p>
      This widget visualizes the total air quality index, which considers the concentration of particulate matter and trace gases in the environment. It uses data from the <code>/api/v1/total_air_quality</code> endpoint, allowing you to select date, interval, location, and range of days to analyze air quality trends at a specific point.
      <br><br>
      <strong>Parameters:</strong>
      <ul>
        <li><strong>dateTime</strong>: Initial date in ISO8601 format (e.g., 2025-10-04T00:00:00Z).</li>
        <li><strong>parameters</strong>: Fixed parameter <code>air_quality:idx</code> for the air quality index.</li>
        <li><strong>lat</strong>: Latitude of the query point.</li>
        <li><strong>lon</strong>: Longitude of the query point.</li>
        <li><strong>daysFromNow</strong>: Range of days to query (e.g., P3D for 3 days).</li>
        <li><strong>interval</strong>: Interval between data points (e.g., PT3H for every 3 hours).</li>
      </ul>
      <br>
      The chart shows how the air quality index varies over the selected period, helping to identify trends and pollution episodes.
    </p>
     


  </div>
  <div>
    <button @click="downloadJson">Download JSON</button>
    <button @click="downloadCsv">Download CSV</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const chartRef = ref<HTMLCanvasElement | null>(null)
const chartInstance = ref<Chart | null>(null)
const airList = ref([])
const dates = ref<string[]>([])
const values = ref<number[]>([])
const startDate = ref(new Date().toISOString().slice(0,10))
const days = ref(3)
const interval = ref('PT3H')
const lat = ref(20)
const lon = ref(-92)
const showMap = ref(false)

function downloadJson() {
  const blob = new Blob([JSON.stringify(airList.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AirQuality_ ${startDate.value}.json`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

function downloadCsv() {
  if (!airList.value.length) return
  const header = 'date,value\n'
  const rows = airList.value.map((d: any) => `${d.date},${d.value}`)
  const csv = header + rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AirQuality_${startDate.value}.csv`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
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
    const coord = dataJson?.data?.[0]?.coordinates?.[0]
    if (!coord || !Array.isArray(coord.dates)) {
      console.error('Respuesta inesperada del API:', dataJson)
      dates.value = []
      values.value = []
      airList.value = []
      renderChart() // refresca gráfico vacío
      return
    }

    dates.value = []
    values.value = []
    airList.value = []
    for (const d of coord.dates) {
      dates.value.push(d.date)
      values.value.push(Number(d.value ?? 0))
      airList.value.push({ date: d.date, value: Number(d.value ?? 0) })
    }

    renderChart()
  } catch (e) {
    console.error('Error al obtener datos de calidad del aire', e)
  }
}

function getColor(val: number) {
  if (val <= 50) return '#22c55e' // buena
  if (val <= 100) return '#eab308' // moderada
  if (val <= 150) return '#f59e42' // mala
  return '#ef4444' // muy mala
}
function renderChart() {
  // destruir instancia previa

 
  if (chartInstance.value) {
    try { chartInstance.value.destroy() } catch (err) { console.warn('Destroy chart error', err) }
    chartInstance.value = null
  }

  const canvas = chartRef.value
  if (!canvas) {
    console.warn('Canvas no encontrado (chartRef es null)')
    return
  }

  const labels = dates.value.map(formatDate)
  const dataArr = values.value.map(v => Number(v ?? 0))
  
  const config = {
    type: 'line' as const,
    data: {
      labels,
      datasets: [{
  label: 'Air Quality Index',
        data: dataArr,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.12)',
        pointBackgroundColor: dataArr.map(getColor),
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
      },
      scales: {
  x: { title: { display: true, text: 'Date' } },
  y: { title: { display: true, text: 'Index' }, min: 0 },
      },
    },
    
  }

  try {
    // CREAR usando el elemento canvas (no ctx)
    chartInstance.value = new Chart(canvas as HTMLCanvasElement, config)
  } catch (err) {
    console.error('Error al crear Chart.js — config y estado:', {
      error: err,
      chartRef: !!canvas,
      labelsLength: labels.length,
      dataSample: dataArr.slice(0,5),
      configSummary: {
        plugins: Object.keys(config.options.plugins || {}),
        datasetKeys: Object.keys(config.data.datasets[0])
      }
    })
    throw err
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
function loadLeaflet(cb: () => void) {
  if ((window as any).L) return cb()
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
      const L = (window as any).L
      const map = L.map('map').setView([lat.value, lon.value], 6)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18
      }).addTo(map)
      let marker: any
      map.on('click', (e: any) => {
        lat.value = e.latlng.lat
        lon.value = e.latlng.lng
        if (marker) map.removeLayer(marker)
        marker = L.marker([lat.value, lon.value]).addTo(map)
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
  max-width: 100%;
  margin: 2rem auto;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 2rem;
  position: relative;
}
.title {
  text-align: center;
  margin-bottom: 1rem;
  color: #22c55e;
  font-size: 2rem;
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
  flex: 1 1 120px;
  min-width: 120px;
}
.controls input, .controls select {
  margin-left: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  border: 1px solid #ccc;
  width: 100%;
  max-width: 180px;
  box-sizing: border-box;
}
.controls button {
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  flex: 1 1 120px;
  min-width: 120px;
  margin-top: 0.5rem;
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
  flex-wrap: wrap;
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
  padding: 1rem;
}
.modal-content {
  background: #fff;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  min-width: 280px;
  max-width: 95vw;
}
@media (max-width: 900px) {
  .air-quality-view {
    max-width: 98vw;
    padding: 1rem;
  }
  .controls {
    flex-direction: column;
    gap: 0.7rem;
    align-items: stretch;
  }
  .controls label, .controls button {
    min-width: 0;
    width: 100%;
    max-width: 100%;
  }
  .modal-content {
    padding: 1rem;
    min-width: 0;
  }
}
</style>  