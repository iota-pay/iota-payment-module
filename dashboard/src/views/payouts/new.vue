<template>
  <div>
    <el-button type="primary" @click="openDialog">Create payout</el-button>
    <el-dialog v-el-drag-dialog :visible.sync="dialogTableVisible" title="Create payout">
      <p>Current Balance: {{balance}}</p>
      <el-form :model="form" ref="form" status-icon class="demo-form-inline" :rules="formRules">
        <el-form-item label="Address" prop="address">
          <el-input v-model="form.address" placeholder="Your iota address"></el-input>
        </el-form-item>
        <el-form-item label="Value" prop="value">
          <el-input v-model="form.value" placeholder="Value to send"></el-input>
        </el-form-item>
        <el-form-item label="Message">
          <el-input v-model="form.message" placeholder="Message to send"></el-input>
        </el-form-item>
        <el-form-item label="Tag">
          <el-input v-model="form.tag" placeholder="Tag to send"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSubmit('form')">Send</el-button>
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
    var checkValue = (rule, value, callback) => {
        if (!value) {
          return callback(new Error('Please input a value'));
        }
        setTimeout(() => {
          if (isNaN(value)) {
            callback(new Error('Please input digits'));
          } else {
            if (this.balance <= 0 ) {
              callback(new Error('You dont have enough IOTA'));
            } else {
              callback();
            }
          }
        }, 300);
    }
    return {
      dialogTableVisible: false,
      balance: 'Loading...',
      form: {
        address: '',
        value: 0,
        message: '',
        tag: ''
      },
      formRules: {
          address: [
            { required: true, message: 'Please input iota address', trigger: 'blur' },
            { min: 81, max: 90, message: 'Length should be 81 to 90', trigger: 'blur' }
          ],
          value: [
            { validator: checkValue, trigger: 'blur' }
          ]
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
    onSubmit(formName) {
      console.log('yo', this.form)

      this.$refs[formName].validate((valid) => {
          if (valid) {
            sendPayout(this.form).then(
              response => {
                console.log('response', response)
                this.dialogTableVisible = false
                  this.$message({
                    message: 'Created payout!',
                    type: 'success'
                  })
              },
              err => {
                console.log('err', err)
                this.$message({
                  message: 'Error creating payout!',
                  type: 'error'
                })
              }
            )
          } else {
            console.log('error submit!!');
            this.$message({
                  message: 'Error!',
                  type: 'error'
                })
            return false;
          }
      });

    },
  }
}
</script>

<style>
</style>