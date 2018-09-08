import React from 'react'

// Pick up different style of React stateless components
class A extends React.Component {
render() {
return <div />
}
}
class B extends React.Component {
render() {
return <div />
}
}
class C extends React.Component {
render() {
return <div />
}
}
class D extends React.Component {
render() {
return (<div />)
}
}
class E extends React.Component {
render() {
return <div />
}
}

// Pick up non self-closing elements
class F extends React.Component {
render() {
return <div />
}
}
class G extends React.Component {
render() {
return <div></div>
}
}
class H extends React.Component {
render() {
return (<div />)
}
}
class I extends React.Component {
render() {
return (<div></div>)
}
}

// Does not pick up inner stateless components
class J extends React.Component {
render() {
const K = () => <span></span>
return <F />
}
}

// Pick up prop-types
class L extends React.Component {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return (
	<div>{this.props.text}</div>
)
}
}