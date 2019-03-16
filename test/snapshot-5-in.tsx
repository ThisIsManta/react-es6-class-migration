import { Component } from 'react'
import PropTypes from 'prop-types'

export default class MyComponent extends Component {
	static propTypes = {
		optionalNode: PropTypes.node,
	}
}
