
<template>
	<div class="cloud-view">
		<h2 class="title">Cobertura de Nubes</h2>
			<div class="controls">
				<button @click="showMap = true">Seleccionar en mapa</button>
				<button @click="getCurrentLocation">Usar ubicación actual</button>
				<span v-if="lat && lon" class="coords">Lat: {{ lat }}, Lon: {{ lon }}</span>
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
						<option value="PT12H">12H</option>
					</select>
				</label>
				<label>Latitud:
					<input type="number" step="0.0001" v-model="lat" />
				</label>
				<label>Longitud:
					<input type="number" step="0.0001" v-model="lon" />
				</label>
				<button @click="fetchCloud">Actualizar</button>
			</div>
			<div v-if="showMap" class="modal">
				<div class="modal-content">
					<div id="map" style="height: 400px;"></div>
					<button @click="showMap = false">Cerrar</button>
				</div>
			</div>
		<canvas ref="chartRef" width="600" height="300"></canvas>
		
	</div>
</template>

<script setup>
const showMap = ref(false)
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
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const chartRef = ref(null)
const chartInstance = ref(null)
const cloudList = ref([])
const dates = ref([])
const values = ref([])
const startDate = ref(new Date().toISOString().slice(0,10))
const days = ref(3)
const interval = ref('PT1H')
const lat = ref(20)
const lon = ref(-92)

function formatDate(dateStr) {
	const d = new Date(dateStr)
	return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function getApiUrl() {
	const dateTime = startDate.value + 'T00:00:00Z'
	const daysFromNow = `P${days.value}D`
	return `http://172.18.0.45:8080/api/v1/interval_values_of_cloud_cover?dateTime=${encodeURIComponent(dateTime)}&parameters=total_cloud_cover_mean_12h%3Ap&lat=${lat.value}&lon=${lon.value}&daysFromNow=${daysFromNow}&interval=${interval.value}&format=json`
}

async function fetchCloud() {
	const url = getApiUrl()
	try {
		const res = await fetch(url)
		const dataJson = await res.json()
		const coord = dataJson.data[0].coordinates[0]
		dates.value = []
		values.value = []
		cloudList.value = []
		for (const d of coord.dates) {
			dates.value.push(d.date)
			values.value.push(d.value)
			cloudList.value.push({ date: d.date, value: d.value })
		}
		renderChart()
	} catch (e) {
		console.error('Error al obtener datos de nubes', e)
	}
}

function renderChart() {
	if (chartInstance.value) {
		chartInstance.value.destroy()
	}
	if (chartRef.value) {
		// Gradiente para la línea
		const gradient = chartRef.value.getContext('2d').createLinearGradient(0, 0, 600, 0)
		gradient.addColorStop(0, '#a5b4fc')
		gradient.addColorStop(0.5, '#38bdf8')
		gradient.addColorStop(1, '#f3f4f6')

		// Iconos de nube en los máximos
		const maxVal = Math.max(...values.value)
		const cloudIcons = values.value.map(v => v === maxVal ? '☁️' : '')

		chartInstance.value = new Chart(chartRef.value, {
			type: 'line',
			data: {
				labels: dates.value.map((d, i) => cloudIcons[i] ? cloudIcons[i] + ' ' + formatDate(d) : formatDate(d)),
				datasets: [{
					label: 'Cobertura (%)',
					data: values.value,
					borderColor: gradient,
					backgroundColor: 'rgba(168,218,255,0.18)',
					fill: true,
					tension: 0.5,
					pointRadius: values.value.map(v => v === maxVal ? 10 : 4),
					pointBackgroundColor: values.value.map(v => v === maxVal ? '#38bdf8' : '#a5b4fc'),
					pointStyle: values.value.map(v => v === maxVal ? 'rectRot' : 'circle'),
				}],
			},
			options: {
				responsive: false,
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
						text: 'Cobertura de nubes',
						color: '#38bdf8',
						font: { size: 18 }
					},
					tooltip: {
						callbacks: {
							label: ctx => `Cobertura: ${ctx.parsed.y} %` + (ctx.parsed.y === maxVal ? ' ☁️' : '')
						}
					}
				},
				scales: {
					x: { title: { display: true, text: 'Fecha' }, ticks: { color: '#38bdf8' } },
					y: { title: { display: true, text: 'Cobertura (%)' }, min: 0, max: 100, ticks: { color: '#38bdf8' } },
				},
				elements: {
					point: {
						borderWidth: 2,
						borderColor: '#38bdf8',
						hoverRadius: 14,
						hoverBorderWidth: 4,
						hoverBackgroundColor: '#a5b4fc',
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

onMounted(() => {
	fetchCloud()
})

watch([startDate, days, interval, lat, lon], () => {
	fetchCloud()
})
</script>

<style scoped>
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
.cloud-view {
	max-width: 700px;
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
	color: #38bdf8;
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
	background: rgb(41, 173, 210);
	color: #fff;
	border: none;
	border-radius: 0.5rem;
	padding: 0.5rem 1rem;
	cursor: pointer;
	font-weight: 600;
	box-shadow: 0 2px 8px rgba(168,218,255,0.08);
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
/* Fondo animado de nubes */

@keyframes cloudmove {
	0% { left: -50px; }
	100% { left: 0px; }
}
</style>
