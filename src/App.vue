<template>
  <div id="app-container">
    <router-view />
  </div>
</template>

<script setup>
// No manual path tracking needed! 
// Vue Router handles this automatically.
</script>

<style>
/* Global reset styling for your game layout */
body, html, #app {
  margin: 0;
  padding: 0;
  font-family: sans-serif;
  background-color: #f0f4f8;
}
#app-container {
  min-height: 100vh;
}
.not-found {
  padding: 2rem;
  text-align: center;
}
</style>
