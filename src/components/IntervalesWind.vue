
<template>
	<div class="wind-view">
		<h2 class="title">Ráfagas de Viento (100m)</h2>
		<div class="controls">
			<label>Fecha inicial:
				<input type="date" v-model="startDate" />
			</label>
			<label>Días:
				<input type="number" min="1" max="10" v-model="days" />
			</label>
			<label>Intervalo:
				<select v-model="interval">
					<option value="PT1H">1H</option>
					<option value="PT2H">2H</option>
					<option value="PT3H">3H</option>
				</select>
			</label>
			<label>Latitud:
				<input type="number" step="0.0001" v-model="lat" />
			</label>
			<label>Longitud:
				<input type="number" step="0.0001" v-model="lon" />
			</label>
			<button @click="fetchWind">Actualizar</button>
		</div>
		<canvas ref="chartRef" width="600" height="300"></canvas>
		
	</div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const chartRef = ref(null)
const chartInstance = ref(null)
const windList = ref([])
const dates = ref([])
const values = ref([])
const startDate = ref(new Date().toISOString().slice(0,10))
const days = ref(5)
const interval = ref('PT2H')
const lat = ref(20.5944)
const lon = ref(-100.3901)

function formatDate(dateStr) {
	const d = new Date(dateStr)
	return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function getApiUrl() {
	const dateTime = startDate.value + 'T00:00:00Z'
	const daysFromNow = `P${days.value}D`
	return `http://172.18.0.45:8080/api/v1/interval_wind_gusts?dateTime=${encodeURIComponent(dateTime)}&parameters=wind_gusts_100m_3h%3Ams&lat=${lat.value}&lon=${lon.value}&daysFromNow=${daysFromNow}&interval=${interval.value}&format=json`
}

async function fetchWind() {
	const url = getApiUrl()
	try {
		const res = await fetch(url)
		const dataJson = await res.json()
		const coord = dataJson.data[0].coordinates[0]
		dates.value = []
		values.value = []
		windList.value = []
		for (const d of coord.dates) {
			dates.value.push(d.date)
			values.value.push(d.value)
			windList.value.push({ date: d.date, value: d.value })
		}
		renderChart()
	} catch (e) {
		console.error('Error al obtener datos de viento', e)
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
					label: 'Ráfaga (m/s)',
					data: values.value,
					borderColor: '#6366f1',
					backgroundColor: 'rgba(99,102,241,0.1)',
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
					y: { title: { display: true, text: 'Ráfaga (m/s)' }, min: 0 },
				},
			},
		})
	}
}

onMounted(() => {
	fetchWind()
})

watch([startDate, days, interval, lat, lon], () => {
	fetchWind()
})
</script>

<style scoped>
.wind-view {
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
	color: #6366f1;
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
	background: #6366f1;
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
}
</style>
