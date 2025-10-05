import { createRouter, createWebHistory } from 'vue-router'
import Wind from '@/components/IntervalesWind.vue'
import Rain from '@/components/Precipitation.vue'
import AirQuality from '@/components/AirQuality.vue'
import Soil from '@/components/Index-soil.vue'
import Temp from '@/components/Temperature.vue'
import Humidity from '@/components/Humidity.vue'
import Clouds from '@/components/Interval-cloud.vue'
import Thunder from '@/components/ProbabilityThunder.vue'


const routes = [
  { path: '/wind', name: 'Wind', component: Wind },
  { path: '/rain', name: 'Rain', component: Rain },
  { path: '/air-quality', name: 'AirQuality', component: AirQuality },
  { path: '/soil', name: 'Soil', component: Soil },
  { path: '/temp', name: 'Temp', component: Temp },
  { path: '/humidity', name: 'Humidity', component: Humidity },
  { path: '/clouds', name: 'Clouds', component: Clouds },
  { path: '/thunder', name: 'Thunder', component: Thunder },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
