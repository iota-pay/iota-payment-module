<template>
  <div>
    <h2>payout data</h2>
    <pre>{{payment}}</pre>
  </div>
</template>

<script>
import { getPayout } from '@/api/payouts'
export default {
  name: 'PayoutShow',
  components: {},
  params: ['id'],
  data() {
    return {
      payment: {}
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    fetchData() {
      this.listLoading = true
      getPayout(this.$route.params.id).then(response => {
        this.payout = response
      })
    }
  }
}
</script>

<style lang="scss">
</style>