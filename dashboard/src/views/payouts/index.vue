<template>
  <div class="app-container">
    <new-payout></new-payout>
    <el-table
      v-loading="listLoading"
      :data="list"
      element-loading-text="Loading"
      border
      fit
      highlight-current-row
    >
      <el-table-column label="Index" width="95">
        <template slot-scope="scope">{{ scope.row.index }}</template>
      </el-table-column>
      <el-table-column align="center" label="ID" width="130">
        <template slot-scope="scope">{{ scope.row.id }}</template>
      </el-table-column>
      <el-table-column align="center" label="Value" width="130">
        <template slot-scope="scope">{{ scope.row.value }}</template>
      </el-table-column>
      <el-table-column class-name="status-col" label="Payed" width="110" align="center">
        <template slot-scope="scope">
          <el-tag :type="scope.row.payed | statusFilter">{{ scope.row.payed }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column align="center" prop="created_at" label="Details" width="200">
        <template slot-scope="scope">
          <router-link :to="{ name: 'PaymentShow', params: {id: scope.row.id} }">
            <svg-icon icon-class="eye-open" />
          </router-link>
          <a target="_blank" :href="`https://devnet.thetangle.org/transaction/${scope.row.txhash}`">
            <svg-icon icon-class="link" />
          </a>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import { getPayouts } from '@/api/payouts'
import newPayout from './new'

export default {
  components: { newPayout },
  filters: {
    statusFilter(status) {
      const statusMap = {
        true: 'success',
        false: 'danger'
      }
      return statusMap[status]
    }
  },
  data() {
    return {
      list: null,
      listLoading: true
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    fetchData() {
      this.listLoading = true
      getPayouts().then(response => {
        console.log(response)
        this.list = response
        this.listLoading = false
      })
    }
  }
}
</script>
