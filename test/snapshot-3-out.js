import React from 'react'

// Pick up different style of React stateless components
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return <div />
}
}
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return <div />
}
}
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return <div />
}
}
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return (<div />)
}
}
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return <div />
}
}

// Pick up non self-closing elements
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return <div />
}
}
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return <div></div>
}
}
class F extends React.PureComponent {
render() {
return (<div />)
}
}
class F extends React.PureComponent {
render() {
return (<div></div>)
}
}

// Does not pick up inner stateless components
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
const F = () => <span></span>
return <F />
}
}

// Pick up prop-types
class C extends React.PureComponent {
static propTypes =  { text: React.PropTypes.string }

static defaultProps =  { text: '123' }

render() {
return (
        <div>{this.props.text}</div>
)
}
}