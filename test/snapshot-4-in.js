import { PureComponent } from 'react'
import PropTypes from 'prop-types'

const A = () => <div />

const B = (props) => <div>{props.children}</div>
B.propTypes = {
	children: PropTypes.node.isRequired
}

const C = ({ children }) => <div>{children}</div>
C.propTypes = {
	children: PropTypes.node.isRequired
}