<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import MapEvaporation from './components/MapEvaporation.vue';

const route = useRoute()
const showMapEvaporation = computed(() => route.path === '/')
</script>

<template>
  <div class="app-container">
    <header class="nav-bar">
      <h1 class="logo"> <RouterLink to="/" class="nav-link">Andy</RouterLink></h1>
      <nav class="nav-links">
        
        <div class="link-group">
           <RouterLink to="/wind" class="nav-link">Wind</RouterLink>
          <RouterLink to="/rain" class="nav-link">Rain</RouterLink>
          <RouterLink to="/air-quality" class="nav-link">AirQuality</RouterLink>
          <RouterLink to="/soil" class="nav-link">Soil</RouterLink>
          <RouterLink to="/temp" class="nav-link">Temp</RouterLink>
          <RouterLink to="/humidity" class="nav-link">Humidity</RouterLink>
          <RouterLink to="/clouds" class="nav-link">Clouds</RouterLink>
        </div>
      </nav>
    </header>

    <main class="dashboard-grid">
  <MapEvaporation v-if="showMapEvaporation" />
  <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* --------------------- */
/* Layout principal */
/* --------------------- */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  font-family: "Poppins", sans-serif;
  color: #222;
}
.nav-link.router-link-active {
  background-color: #1565c0;
  color: white;
  box-shadow: 0 3px 8px rgba(21, 101, 192, 0.3);
}


/* --------------------- */
/* NAVBAR */
/* --------------------- */
.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 40px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

.logo {
  font-size: 1.8rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: #0d47a1;
}
.logo span {
  color: #1565c0;
}

.nav-links {
  font-size: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.nav-links h2 {
  
  font-weight: 500;
  margin-bottom: 6px;
  color: #0d47a1;
}

.link-group {
  display: flex;
  gap: 20px;
}

.nav-link {
  text-decoration: none;
  font-weight: 500;
  color: #1565c0;
  padding: 6px 14px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.nav-link:hover {
  background-color: #1565c0;
  color: white;
  box-shadow: 0 3px 8px rgba(21, 101, 192, 0.3);
}

/* --------------------- */
/* GRID DE WIDGETS */
/* --------------------- */
.dashboard-grid {
  gap: 24px;
  padding: 30px 40px;
  justify-content: center;
}

/* --------------------- */
/* Widgets generales */
/* --------------------- */
.dashboard-grid > * {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  padding: 20px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dashboard-grid > *:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

/* --------------------- */
/* Responsive */
/* --------------------- */
@media (max-width: 600px) {
  .nav-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .nav-links {
    align-items: flex-start;
  }

  .dashboard-grid {
    padding: 20px;
  }
}
</style>
