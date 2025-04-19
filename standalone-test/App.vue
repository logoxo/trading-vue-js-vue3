<template>
  <div class="standalone-app">
    <h1>Standalone Test App</h1>
    <p>This is a simple Vue 3 app running with Vite</p>
  </div>
</template>

<script>
export default {
  name: 'StandaloneApp',
  setup() {
    console.log('Standalone app setup running')
    return {}
  },
  mounted() {
    console.log('Standalone app mounted')
  }
}
</script>

<style>
.standalone-app {
  padding: 20px;
  border: 1px solid #42b883;
  border-radius: 8px;
  max-width: 800px;
  margin: 30px auto;
}
h1 {
  color: #42b883;
}
</style>