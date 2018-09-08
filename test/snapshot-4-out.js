import { PureComponent, Component } from 'react'
import PropTypes from 'prop-types'

class A extends PureComponent {
render() {
return <div />
}
}

class B extends Component {
static propTypes =  {
	children: PropTypes.node.isRequired
}

render() {
return <div>{this.props.children}</div>
}
}