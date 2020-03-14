class IotapayButton extends HTMLElement {

    // Can define constructor arguments if you wish.
  constructor() {
    // If you define a constructor, always call super() first!
    // This is specific to CE and required by the spec.
    super();
    this.render()
    // Setup a click listener on <app-drawer> itself.
    this.addEventListener('click', e => {
      // Don't toggle the drawer if it's disabled.
      if (this.disabled) {
        return;
      }
      console.log('IotapayButton clicked!')

    });
  }

    render(button) {
        console.log('IotapayButton rendered')
        this.innerHTML = `
        <button>Hello world!</button>
        `
    }
}
console.log('IotapayButton called')

customElements.define('iotapay-button', IotapayButton)