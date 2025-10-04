<script setup lang="ts">
import T2mApiWidget from './components/T2mApiWidget.vue';

</script>

<template>
 <T2mApiWidget
      baseUrl="http://172.18.0.45:8080/api/v1/temperature"
        :lat="20.653315"
        :lon="-100.406736"
        start="2025-10-04T00:00:00Z"
        end="2025-10-07T00:00:00Z"
        interval="5H"
      parameters="t_2m:C"
      format="json"
      :pollInterval="0"
    />  
</template>

<style scoped></style>
