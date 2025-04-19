<template>
  <div>
    <h1>Debugging App</h1>
    <p>This is a simple app to test Vue 3 functionality</p>
  </div>
</template>

<script>
export default {
  name: 'DebugApp',
  setup() {
    console.log('Debug app setup running')
    return {}
  },
  mounted() {
    console.log('Debug app mounted')
  }
}
</script>

<style>
h1 {
  color: white;
}
p {
  color: white;
}
</style>