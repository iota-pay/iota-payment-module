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
      <a href="/iotapay/#/dashboard">Dashboard</a>
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
:root {
  --akita-primary: #00b0f0;
  --akita-secondary: #00fb92;
  --akita-dark: #3b3838;
  --akita-light: #f2f2f2;
  --akita-blue: #00b0f0;
  --akita-dark-transparent: rgba(59, 56, 56, 0.5);
}
body {
  height: 100vh;
  width: 100%;
  text-align: center;
  justify-content: center;
}
#app {
  font-family: 'Oswald', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--akita-light);
  background: linear-gradient(
    to bottom right,
    var(--akita-primary) 50%,
    var(--akita-secondary) 85%
  );
}
.container {
  position: fixed;
  top: 50%;
  left: 50%;
  /* bring your own prefixes */
  transform: translate(-50%, -50%);
  background: var(--akita-dark-transparent);
  padding: 50px;
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
    color: #fff;
    background: var(--akita-primary);
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
    }
    &:active {
      --y: 1px;
      box-shadow: 0 4px 8px var(--shadow);
    }
  }
}
</style>
