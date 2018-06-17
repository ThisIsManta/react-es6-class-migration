import React from 'react'

export default class myComponent extends React.PureComponent {
constructor (props) {
super(props)

this.state = {
			counter: 0
		}}

onClick =  (e) => {
		this.setState({
			counter: this.state.counter + 1
		})
	}

 render () {
		return (
			<div onClick={this.props.onClick}>
				{this.state.counter}
			</div>
		)
	}}
