<template>
  <div class="dashboard-container">
    <div class="dashboard-text">name: {{ name }}</div>
    <div v-if="balance" class="dashboard-text">balance: {{ balance }}</div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { getBalance } from '@/api/account'

export default {
  name: 'Dashboard',
  data() {
    return {
      balance: undefined
    }
  },
  computed: {
    ...mapGetters(['name'])
  },
  created() {
    this.fetchData()
  },
  methods: {
    fetchData() {
      this.listLoading = true
      getBalance().then(response => {
        this.balance = response
      })
    }
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
