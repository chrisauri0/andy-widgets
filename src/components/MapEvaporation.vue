

<template>
		<div class="evap-map-view">
			<h2 class="title">Evapotranspiration Map</h2>
				<div class="controls">
					<label>Date:
						<input type="date" v-model="date" />
					</label>
					<button @click="fetchEvaporation">Update</button>
					<span style="margin-left:1rem;">Select area on map:</span>
					<button @click="enableAreaSelect">Select area</button>
					<span v-if="areaTopLeft && areaBotRight" class="coords">Area: {{ areaTopLeft.lat }},{{ areaTopLeft.lon }} to {{ areaBotRight.lat }},{{ areaBotRight.lon }}</span>
				</div>
			<div id="evap-map" style="height: 500px; width: 100%; margin-top:1rem;"></div>
		</div>
		<div class="text-informative" style="margin:2rem 0;">
			<h2>Evapotranspiration Map Widget</h2>
			<p>
				This widget shows the estimated evaporation at different geographic points, allowing you to visualize areas with higher or lower water loss due to evaporation. It uses data from the <code>/api/v1/evapotranspiration</code> endpoint and lets you select the area and date range for analysis.
				<br><br>
				<strong>Parameters:</strong>
				<ul>
					<li><strong>start</strong>: Start date and time in ISO8601 format.</li>
					<li><strong>end</strong>: End date and time in ISO8601 format.</li>
					<li><strong>interval</strong>: Interval between data points.</li>
					<li><strong>parameters</strong>: Evapotranspiration parameter.</li>
					<li><strong>lat/lon</strong>: Coordinates of the query area.</li>
				</ul>
				<br>
				The map helps identify zones of higher evaporation and analyze spatial and temporal trends.
			</p>
		</div>
<div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
	<button @click="downloadJson">Download JSON</button>
	<button @click="downloadCsv">Download CSV</button>
</div>

</template>

<script setup>
function downloadJson() {
	const blob = new Blob([JSON.stringify(evapList.value, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `evaporacion_${startDate.value}.json`
	document.body.appendChild(a)
	a.click()
	setTimeout(() => {
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}, 100)
}

function downloadCsv() {
	if (!evapList.value.length) return
	const header = 'date,value\n'
	const rows = evapList.value.map((d) => `${d.date},${d.value}`)
	const csv = header + rows.join('\n')
	const blob = new Blob([csv], { type: 'text/csv' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `evaporation_${date.value}.csv`
	document.body.appendChild(a)
	a.click()
	setTimeout(() => {
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}, 100)
}
import { ref, onMounted, watch } from 'vue'

const date = ref(new Date().toISOString().slice(0,10))
const mapInstance = ref(null)
const markers = ref([])
const areaTopLeft = ref({ lat: 25, lon: -110 })
const areaBotRight = ref({ lat: 15, lon: -90 })
const selectingArea = ref(false)

function getApiUrl() {
	const dateTime = date.value + 'T00:00:00Z'
	return `http://172.18.0.45:8080/api/v1/evapotranspiration?dateTime=${encodeURIComponent(dateTime)}&parameters=evapotranspiration_1h%3Amm&grid_cords_top_left=${areaTopLeft.value.lat}%2C${areaTopLeft.value.lon}&grid_cords_bot_right=${areaBotRight.value.lat}%2C${areaBotRight.value.lon}&grid=25x25&format=json`
}

async function fetchEvaporation() {
	const url = getApiUrl()
	try {
		const res = await fetch(url)
		const dataJson = await res.json()
		const coords = dataJson.data[0].coordinates
		renderMap(coords)
	} catch (e) {
		console.error('Error al obtener datos de evapotranspiración', e)
	}
}

function renderMap(coords) {
		if (!window.L) {
			loadLeaflet(() => renderMap(coords))
			return
		}
		if (!mapInstance.value) {
			mapInstance.value = window.L.map('evap-map').setView([20, -100], 5)
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
			const color = getColor(val, min, max)
			const circle = window.L.circleMarker([c.lat, c.lon], {
				radius: 7,
				color,
				fillColor: color,
				fillOpacity: 0.7,
				weight: 1
			}).addTo(mapInstance.value)
			circle.bindPopup(`Lat: ${c.lat}<br>Lon: ${c.lon}<br>Evapotranspiración: ${val} mm`)
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
					fetchEvaporation()
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


function getColor(val, min, max) {
	// Escala simple: azul (min) -> rojo (max)
	const percent = (val - min) / (max - min || 1)
	const r = Math.round(255 * percent)
	const g = Math.round(100 * (1-percent))
	const b = Math.round(255 * (1-percent))
	return `rgb(${r},${g},${b})`
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

onMounted(() => {
	fetchEvaporation()
})

watch(date, () => {
	fetchEvaporation()
})
</script>

<style scoped>
.evap-map-view {
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
}
.controls label {
	font-size: 0.95rem;
	color: #444;
}
.controls input[type="date"] {
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
</style>
