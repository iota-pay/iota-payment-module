<template>
  <div>
    <h2>payment data</h2>
    <pre>{{payment}}</pre>
  </div>
</template>

<script>
import { getPayment } from '@/api/payments'
export default {
  name: 'PaymentShow',
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
      getPayment(this.$route.params.id).then(response => {
        this.payment = response
      })
    }
  }
}
</script>

<style lang="scss">
</style>