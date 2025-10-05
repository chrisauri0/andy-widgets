<template>
    <div class="temp-view">
        <h2 class="title">Apparent Temperature</h2>
        <div class="controls">
            <button @click="showMap = true">Select on map</button>
            <button @click="getCurrentLocation">Use current location</button>
            <span v-if="lat && lon" class="coords">Lat: {{ lat }}, Lon: {{ lon }}</span>
            <label>Start date:
                <input type="date" v-model="startDate" />
            </label>
            <label>Days:
                <input type="number" min="1" max="30" v-model="days"/>
            </label>
            <label>Interval:
                <select v-model="interval">
                    <option value="PT1H">1H</option>
                    <option value="PT3H">3H</option>
                    <option value="PT6H">6H</option>
                    <option value="PT12H">12H</option>
                </select>
            </label>
            <button @click="fetchTemp">Update</button>
        </div>
        <canvas ref="chartRef" width="600" height="300"></canvas>
        <div v-if="showMap" class="modal">
            <div class="modal-content">
                <h3>Select a location on the map</h3>
                <div id="map" style="height: 400px;"></div>
                <button @click="showMap = false">Close</button>
            </div>
        </div>
    </div>
    <div class="text-informative">
        <h2>Apparent Temperature Widget</h2>
        <p>
            Apparent temperature is a measure of human thermal comfort. It is calculated based on air temperature, considering the effects of relative humidity, wind speed, and solar radiation. This widget allows you to visualize the evolution of apparent temperature at a specific point using data from the <code>/api/v1/apparent_temperature</code> endpoint.
            <br><br>
            <strong>Parameters:</strong>
            <ul>
                <li><strong>dateTime</strong>: Initial date in ISO8601 format (e.g., 2025-10-04T00:00:00Z).</li>
                <li><strong>parameters</strong>: Fixed parameter <code>t_apparent:C</code> for apparent temperature in °C.</li>
                <li><strong>lat</strong>: Latitude of the query point.</li>
                <li><strong>lon</strong>: Longitude of the query point.</li>
                <li><strong>daysFromNow</strong>: Range of days to query (e.g., P5D for 5 days).</li>
                <li><strong>interval</strong>: Interval between data points (e.g., PT1H for every hour).</li>
            </ul>
            <br>
            The chart shows how apparent temperature varies over the selected period, helping to identify comfort or thermal stress conditions.
        </p>
    </div>
    <div>
        <div>
  <button @click="downloadJson">Download JSON</button>
  <button @click="downloadCsv">Download CSV</button>
  </div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const chartRef = ref(null)
const chartInstance = ref(null)
const tempList = ref([])
const dates = ref([])
const values = ref([])
const startDate = ref(new Date().toISOString().slice(0,10))
const days = ref(30)
const interval = ref('PT1H')
const lat = ref(20)
const lon = ref(-92)
const showMap = ref(false)

function downloadJson() {
    const blob = new Blob([JSON.stringify(tempList.value, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `temperature${startDate.value}.json`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, 100)
}

function downloadCsv() {
    if (!tempList.value.length) return
    const header = 'date,value\n'
    const rows = tempList.value.map((d) => `${d.date},${d.value}`)
    const csv = header + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `temperature${startDate.value}.csv`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, 100)
}

function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}


function getApiUrl() {
    const dateTime = startDate.value + 'T00:00:00Z'
    const daysFromNow = `P${days.value}D`
    return `http://172.18.0.45:8080/api/v1/apparent_temperature?dateTime=${encodeURIComponent(dateTime)}&parameters=t_apparent%3AC&lat=${lat.value}&lon=${lon.value}&daysFromNow=${daysFromNow}&interval=${interval.value}&format=json`
}

async function fetchTemp() {
    const url = getApiUrl()
    try {
        const res = await fetch(url)
        const dataJson = await res.json()
        const coord = dataJson.data[0].coordinates[0]
        dates.value = []
        values.value = []
        tempList.value = []
        for (const d of coord.dates) {
            dates.value.push(d.date)
            values.value.push(d.value)
            tempList.value.push({ date: d.date, value: d.value })
        }
        renderChart()
    } catch (e) {
        console.error('Error al obtener datos de temperatura', e)
    }
}

function renderChart() {
    if (chartInstance.value) {
        chartInstance.value.destroy()
    }
    if (chartRef.value) {
        const gradient = chartRef.value.getContext('2d').createLinearGradient(0, 0, 600, 0)
        gradient.addColorStop(0, '#fbbf24')
        gradient.addColorStop(0.5, '#ef4444')
        gradient.addColorStop(1, '#f43f5e')
        const maxVal = Math.max(...values.value)
        const sunIcons = values.value.map(v => v === maxVal ? '☀️' : '')
        chartInstance.value = new Chart(chartRef.value, {
            type: 'line',
            data: {
                labels: dates.value.map((d, i) => sunIcons[i] ? sunIcons[i] + ' ' + formatDate(d) : formatDate(d)),
                datasets: [{
                    label: 'Temperatura (°C)',
                    data: values.value,
                    borderColor: gradient,
                    backgroundColor: 'rgba(251,191,36,0.12)',
                    fill: true,
                    tension: 0.5,
                    pointRadius: values.value.map(v => v === maxVal ? 10 : 4),
                    pointBackgroundColor: values.value.map(v => v === maxVal ? '#f43f5e' : '#fbbf24'),
                    pointStyle: values.value.map(v => v === maxVal ? 'rectRot' : 'circle'),
                }],
            },
            options: {
                responsive: true,
                animation: {
                    duration: 1800,
                    easing: 'easeInOutQuart',
                    animateScale: true,
                    animateRotate: true,
                },
                plugins: {
                    legend: { display: true },
                    title: {
                        display: true,
                        text: 'Temperatura aparente',
                        color: '#f43f5e',
                        font: { size: 18 }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `Temperatura: ${ctx.parsed.y} °C` + (ctx.parsed.y === maxVal ? ' ☀️' : '')
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Fecha' }, ticks: { color: '#f43f5e' } },
                    y: { title: { display: true, text: 'Temperatura (°C)' }, ticks: { color: '#f43f5e' } },
                },
                elements: {
                    point: {
                        borderWidth: 2,
                        borderColor: '#fbbf24',
                        hoverRadius: 14,
                        hoverBorderWidth: 4,
                        hoverBackgroundColor: '#ef4444',
                    },
                    line: {
                        borderWidth: 4,
                        borderJoinStyle: 'round',
                    }
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
                fetchTemp()
            },
            err => {
                alert('No se pudo obtener la ubicación actual')
            }
        )
    } else {
        alert('Geolocalización no soportada')
    }
}

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
        fetchTemp()
        showMap.value = false
        setTimeout(() => map.remove(), 500)
    })
    map.on('click', function(e) {
        marker.setLatLng(e.latlng)
        lat.value = e.latlng.lat
        lon.value = e.latlng.lng
        fetchTemp()
        showMap.value = false
        setTimeout(() => map.remove(), 500)
    })
}

onMounted(() => {
    fetchTemp()
})

watch([startDate, days, interval, lat, lon], () => {
    fetchTemp()
})
</script>

<style scoped>
.temp-view {
    max-width: 100%;
    margin: 2rem auto;
    background: #fff;
    border-radius: 1rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    padding: 2rem;
    position: relative;
    overflow: hidden;
}
.title {
    text-align: center;
    margin-bottom: 1rem;
    color: hsl(350, 89%, 60%);
    background: #fbbf24 ;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 700;
    letter-spacing: 1px;
}
.controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
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
    background: #fbbf24;
    color: #fff;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(251,191,36,0.08);
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