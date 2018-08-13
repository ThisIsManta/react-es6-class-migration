import React from 'react'

// Pick up different style of React stateless components
function C() { return <div /> }
const C = function () { return <div /> }
const C = () => <div />
const C = () => (<div />)
const C = () => { return <div /> }

// Pick up non self-closing elements
const C = () => <div />
const C = () => <div></div>
const F = () => (<div />)
const F = () => (<div></div>)

// Does not pick up inner stateless components
const C = () => {
	const F = () => <span></span>
	return <F />
}

// Pick up prop-types
const C = (props) => (
	<div>{props.text}</div>
)
C.propTypes = { text: React.PropTypes.string }
C.defaultProps = { text: '123' }