import React from 'react'

class MyComponent extends React.Component {
constructor(props) {
super(props)

this.state = {
			counter: 0
		}
}

 onClick = (e) => {
		this.setState({
			counter: this.state.counter + 1
		})
	}

 render() {
		return (
			<div onClick={this.props.onClick}>
				{this.state.counter}
			</div>
		)
	}
 }

export default MyComponent