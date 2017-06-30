import React from 'react'

const myComponent = React.createClass({
	getInitialState() {
		return {
			counter: 0
		}
	},

	onClick(e) {
		this.setState({
			counter: this.state.counter + 1
		})
	},

	render() {
		return (
			<div onClick={this.props.onClick}>
				{this.state.counter}
			</div>
		)
	}
})

export default myComponent