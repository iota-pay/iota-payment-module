<template>
  <div class="dashboard-container">
    <h2>IPM Dashboard</h2>
    <panel-group />
    <div class="dashboard-text">name: {{ name }}</div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import PanelGroup from './components/PanelGroup'

export default {
  name: 'Dashboard',
  components: { PanelGroup },
  computed: {
    ...mapGetters(['name'])
  } 
}
</script>

<style lang="scss" scoped>

.dashboard {
  &-container {
    margin: 30px;
  }
  &-text {
    font-size: 30px;
    line-height: 46px;
  }
}
</style>
