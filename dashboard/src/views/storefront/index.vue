<template>
  <div>
    <div class="container">
      <h1 class="title">{{ headline }}</h1>
      <iota-payment
        class="iotapay"
        @paymentSuccess="paymentSuccess"
        ref="payButton"
        >{{ btnText }}</iota-payment
      >
    </div>
    <div>
      <router-link to="/dashboard/dashboard">Dashboard</router-link>
    </div>
  </div>
</template>
<script>
export default {
  name: 'app',
  data() {
    return {}
  },
  methods: {
    paymentSuccess() {
      console.log('paymentSuccess')
      //location.reload()
    }
  },
  computed: {
    headline() {
      return process.env.VUE_APP_FRONT_HEADLINE
    },
    btnText() {
      return process.env.VUE_APP_BTN_TEXT
    }
  }
}
</script>

<style lang="scss">

.container {
  position: fixed;
  top: 50%;
  left: 50%;
  /* bring your own prefixes */
  transform: translate(-50%, -50%);
  background: var(--dark-transparent);
  padding: 50px;
  text-align: center;
}
.title {
  font-size: 4em;
  font-weight: bold;
  margin: 20px;
}

.iotapay {
  button {
    --y: 0;
    text-align: center;
    padding: 12px 24px;
    border-radius: 4px;
    color: #efefef;
    background-color: #263445;
    text-decoration: none;
    font-weight: 700;
    font-size: 18px;
    line-height: 23px;
    backface-visibility: hidden;
    box-shadow: 0 4px 12px var(--shadow);
    transform: translateY(var(--y));
    transition: box-shadow 0.3s ease, transform 0.3s ease;
    &:hover {
      cursor: pointer;
      --y: -2px;
      box-shadow: 0 8px 16px var(--shadow);
      background-color: #3d4449;
      color: #409EFF;

    }
    &:active {
      --y: 1px;
      box-shadow: 0 4px 8px var(--shadow);
    }
  }
}
</style>
