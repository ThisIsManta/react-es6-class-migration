import React from 'react'
import PropTypes from 'prop-types'

export default class MyComponent extends React.Component {
	static propTypes = {
		// You can declare that a prop is a specific JS primitive. By default, these
		// are all optional.
		optionalArray: PropTypes.array,
		optionalBool: PropTypes.bool,
		optionalFunc: PropTypes.func,
		optionalNumber: PropTypes.number,
		optionalObject: PropTypes.object,
		optionalString: PropTypes.string,
		optionalSymbol: PropTypes.symbol,

		// Anything that can be rendered: numbers, strings, elements or an array
		// (or fragment) containing these types.
		optionalNode: PropTypes.node,

		// A React element.
		optionalElement: PropTypes.element,

		// You can also declare that a prop is an instance of a class. This uses
		// JS's instanceof operator.
		optionalMessage: PropTypes.instanceOf(Message),

		// You can ensure that your prop is limited to specific values by treating
		// it as an enum.
		optionalEnum: PropTypes.oneOf(['News', 'Photos']),

		// An object that could be one of many types
		optionalUnion: PropTypes.oneOfType([
			PropTypes.string,
			PropTypes.number,
			PropTypes.instanceOf(Message)
		]),

		// An array of a certain type
		optionalArrayOf: PropTypes.arrayOf(PropTypes.number),

		// An object with property values of a certain type
		optionalObjectOf: PropTypes.objectOf(PropTypes.number),

		// An object taking on a particular shape
		optionalObjectWithShape: PropTypes.shape({
			color: PropTypes.string,
			fontSize: PropTypes.number
		}),

		// You can chain any of the above with `isRequired` to make sure a warning
		// is shown if the prop isn't provided.
		requiredFunc: PropTypes.func.isRequired,

		// A value of any data type
		requiredAny: PropTypes.any.isRequired,
	}

	static defaultProps = {}

	state = {
		a: '',
		b: ``,
		c: `+${this.props.a}`,
		d: 1,
		e: NaN,
		f: Infinity,
		g: true,
		h: false,
		i: null,
		j: [],
		k: ['', 0, false, null],
		l: {},
		m: { a: '', b: 0, c: false, d: null },
		n: !this.props.a,
		o: this.props.a || '',
		p: this.props.a + '',
		q: this.props.a,
	}
}
