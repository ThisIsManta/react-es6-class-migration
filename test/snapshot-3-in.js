import React from 'react'

// Pick up different style of React stateless components
function A() { return <div /> }
const B = function () { return <div /> }
const C = () => <div />
const D = () => (<div />)
const E = () => { return <div /> }

// Pick up non self-closing elements
const F = () => <div />
const G = () => <div></div>
const H = () => (<div />)
const I = () => (<div></div>)

// Does not pick up inner stateless components
const J = () => {
	const K = () => <span></span>
	return <F />
}

// Pick up prop-types
const L = (props) => (
	<div>{props.text}</div>
)
L.propTypes = { text: React.PropTypes.string }
L.defaultProps = { text: '123' }