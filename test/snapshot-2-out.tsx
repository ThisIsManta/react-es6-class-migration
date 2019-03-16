import React from 'react'

export default class MyComponent extends React.Component<{
	// You can declare that a prop is a specific JS primitive. By default, these
	// are all optional.
	optionalArray?: Array<any>
	optionalBool?: boolean
	optionalFunc?: () => void
	optionalNumber?: number
	optionalObject?: object
	optionalString?: string
	optionalSymbol?: symbol
	
	// Anything that can be rendered: numbers, strings, elements or an array
	// (or fragment) containing these types.
	optionalNode?: React.ReactNode
	
	// A React element.
	optionalElement?: JSX.Element
	
	// You can also declare that a prop is an instance of a class. This uses
	// JS's instanceof operator.
	optionalMessage?: Message
	
	// You can ensure that your prop is limited to specific values by treating
	// it as an enum.
	optionalEnum?: "News" | "Photos"
	
	// An object that could be one of many types
	optionalUnion?: string | number | Message
	
	// An array of a certain type
	optionalArrayOf?: Array<number>
	
	// An object with property values of a certain type
	optionalObjectOf?: { [string]: number }
	
	// An object taking on a particular shape
	optionalObjectWithShape?: { color: string; fontSize: number }
	
	// You can chain any of the above with `isRequired` to make sure a warning
	// is shown if the prop isn't provided.
	requiredFunc: () => void
	
	// A value of any data type
	requiredAny: any
}, {
	a: string
	b: string
	c: string
	d: number
	e: number
	f: number
	g: boolean
	h: boolean
	i: null
	j: Array<any>
	k: Array<string | number | boolean | null>
	l: object
	m: {a: string; b: number; c: boolean; d: null}
	n: boolean
	o: string
	p: string
	q: any
}> {

	static defaultProps = {}
	constructor(props) {
		super(props)

		this.state = {
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
}