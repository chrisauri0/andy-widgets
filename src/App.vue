<script setup lang="ts">
import { ref } from 'vue'

import Humidity from './components/Humidity.vue';
import Precipitation from './components/Precipitation.vue';
import MapEvaporation from './components/MapEvaporation.vue';
import IntervalesWind from './components/IntervalesWind.vue';
import IntervalCloud from './components/Interval-cloud.vue';
import IndexSoil from './components/Index-soil.vue';
import Temperature from './components/Temperature.vue';
import ProbabilityThunder from './components/ProbabilityThunder.vue';
import AirQuality from './components/AirQuality.vue';


</script>

<template>

  <div class="app-container">
    <AirQuality></AirQuality>
      <ProbabilityThunder></ProbabilityThunder>

    <!-- si sirve  solo quiten los comentario -->

    
    <!-- <Temperature></Temperature>
      <Precipitation></Precipitation>

      <Humidity></Humidity>
      <MapEvaporation></MapEvaporation>
      <IntervalesWind></IntervalesWind>
      <IntervalCloud></IntervalCloud>
      <IndexSoil></IndexSoil> -->
   

  </div>


</template>

<style scoped>
/* GRID: que no estire los items en la misma fila */


</style>
