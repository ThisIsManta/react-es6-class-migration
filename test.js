
const x = React.createClass({
	onSomething (e = 1) {
		return e + 2
	},

	render () {
		return <Something>{this.onSomething()}</Something>
	}
})

module.exports = x