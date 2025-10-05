

<template>
		<div class="wind-view">
			<h2 class="title">Wind Gusts (100m)</h2>
			<div class="controls">
				<label>Start date:
					<input type="date" v-model="startDate" />
				</label>
				<label>Days:
					<input type="number" min="1" max="10" v-model="days" />
				</label>
				<label>Interval:
					<select v-model="interval">
						<option value="PT1H">1H</option>
						<option value="PT2H">2H</option>
						<option value="PT3H">3H</option>
					</select>
				</label>
				<label>Latitude:
					<input type="number" step="0.0001" v-model="lat" />
				</label>
				<label>Longitude:
					<input type="number" step="0.0001" v-model="lon" />
				</label>
				<button @click="fetchWind">Update</button>
			</div>
			<canvas ref="chartRef" width="600" height="300"></canvas>
		</div>

		<div class="text-informative" style="margin:2rem 0;">
			<h2>Wind Gusts Widget</h2>
			<p>
				This widget shows the evolution of wind gusts at a specific geographic point, using data from the <code>/api/v1/wind_gust</code> endpoint. You can select the date range, interval, location, and parameter to analyze the intensity and frequency of wind gusts.
				<br><br>
				<strong>Parameters:</strong>
				<ul>
					<li><strong>start</strong>: Start date and time in ISO8601 format (e.g., 2025-10-04T00:00:00Z).</li>
					<li><strong>end</strong>: End date and time in ISO8601 format (e.g., 2025-10-07T00:00:00Z).</li>
					<li><strong>interval</strong>: Interval between data points (e.g., 1H for every hour).</li>
					<li><strong>parameters</strong>: Wind gust parameter (default: <code>wind_gust_1h:ms</code>).</li>
					<li><strong>lat</strong>: Latitude of the query point.</li>
					<li><strong>lon</strong>: Longitude of the query point.</li>
				</ul>
				<br>
				The chart helps visualize how wind gust intensity changes during the selected period, making it easier to identify extreme events.
			</p>
		</div>
<div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
	<button @click="downloadJson">Download JSON</button>
	<button @click="downloadCsv">Download CSV</button>
</div>
</template>

<script setup>
function downloadJson() {
	const blob = new Blob([JSON.stringify(windList.value, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `Intervale_wind${startDate.value}.json`
	document.body.appendChild(a)
	a.click()
	setTimeout(() => {
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}, 100)
}

function downloadCsv() {
	if (!windList.value.length) return
	const header = 'date,value\n'
	const rows = windList.value.map((d) => `${d.date},${d.value}`)
	const csv = header + rows.join('\n')
	const blob = new Blob([csv], { type: 'text/csv' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `Intervale_wind${startDate.value}.csv`
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
	return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
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
				label: 'Gust (m/s)',
					data: values.value,
					borderColor: '#6366f1',
					backgroundColor: 'rgba(99,102,241,0.1)',
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
				y: { title: { display: true, text: 'Gust (m/s)' }, min: 0 },
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
