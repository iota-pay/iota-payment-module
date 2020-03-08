<template>
  <div>
    <el-button type="primary" @click="openDialog">Create payout</el-button>
    <el-dialog v-el-drag-dialog :visible.sync="dialogTableVisible" title="Create payout">
      <p>Current Balance: {{balance}}</p>
      <el-form :model="form" class="demo-form-inline">
        <el-form-item label="Address">
          <el-input v-model="form.address" placeholder="Your iota address"></el-input>
        </el-form-item>
        <el-form-item label="Value">
          <el-input v-model="form.value" placeholder="Value to send"></el-input>
        </el-form-item>
        <el-form-item label="Message">
          <el-input v-model="form.message" placeholder="Message to send"></el-input>
        </el-form-item>
        <el-form-item label="Tag">
          <el-input v-model="form.tag" placeholder="Tag to send"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSubmit">Send</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script>
import elDragDialog from '@/directive/el-drag-dialog' // base on element-ui
import { getBalance } from '@/api/account'
import { sendPayout } from '@/api/payouts'

export default {
  directives: { elDragDialog },
  data() {
    return {
      dialogTableVisible: false,
      balance: 'Loading...',
      form: {
        address: '',
        value: 0,
        message: '',
        tag: ''
      }
    }
  },
  methods: {
    openDialog() {
      this.dialogTableVisible = true
      getBalance().then(response => {
        console.log('response', response)
        this.balance = response
      })
    },
    onSubmit() {
      console.log('yo', this.form)
      sendPayout(this.form).then(
        response => {
          console.log('response', response)
           this.dialogTableVisible = false
            // TODO: show success notification
        },
        err => {
          console.log('err', err)
          // TODO: show err notification
        }
      )
    }
  }
}
</script>

<style>
</style>