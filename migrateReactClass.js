const babylon = require('babylon')
const _ = require('lodash')

const methodThatReturnAnObject = {
	type: 'ObjectMethod',
	body: {
		type: 'BlockStatement',
		body: [{
			type: 'ReturnStatement',
			argument: {
				type: 'ObjectExpression'
			}
		}]
	}
}

const functionThatReturnAnObject = {
	type: 'ObjectProperty',
	value: {
		type: 'FunctionExpression',
		body: {
			type: 'BlockStatement',
			body: [{
				type: 'ReturnStatement',
				argument: {
					type: 'ObjectExpression'
				}
			}]
		}
	}
}

const reactCreateClass = {
	type: 'VariableDeclaration',
	declarations: [{
		type: 'VariableDeclarator',
		init: {
			type: 'CallExpression',
			callee: {
				type: 'MemberExpression',
				object: {
					type: 'Identifier',
					name: 'React'
				},
				property: {
					type: 'Identifier',
					name: 'createClass'
				}
			},
			arguments: [{
				type: 'ObjectExpression'
			}]
		}
	}]
}

const reactStatelessFunction = {
	type: 'VariableDeclaration',
	kind: 'const',
	declarations: [{
		type: 'VariableDeclarator',
		init: {
			type: 'ArrowFunctionExpression'
		}
	}]
}

const reactPropTypes = {
	type: 'ExpressionStatement',
	expression: {
		type: 'AssignmentExpression',
		operator: '=',
		left: {
			type: 'MemberExpression',
			object: {
				type: 'Identifier'
			},
			property: {
				type: 'Identifier',
				name: 'propTypes'
			}
		},
		right: {
			type: 'ObjectExpression'
		}
	}
}
const checkIfFunctionThatReturnReactOnly = node => node.declarations[0].init.body.type === 'JSXElement'
const checkIfFunctionThatReturnReactLast = node => node.declarations[0].init.body.type === 'BlockStatement' && _.isMatch(_.last(node.declarations[0].init.body.body), { type: 'ReturnStatement', argument: { type: 'JSXElement' } })

const reactLifeCycleNames = [
	'componentWillMount',
	'render',
	'componentDidMount',
	'componentWillReceiveProps',
	'shouldComponentUpdate',
	'componentWillUpdate',
	'componentDidUpdate',
	'componentWillUnmount',
]

function parseTree(code) {
	return babylon.parse(code, {
		sourceType: 'module',
		plugins: ['jsx', 'flow', 'doExpressions', 'objectRestSpread', 'decorators', 'classProperties', 'exportExtensions', 'asyncGenerators', 'functionBind', 'functionSent', 'dynamicImport']
	})
}

function migrateReactClass(code) {
	let tree = parseTree(code)

	const propTypeNodes = {}
	_.forEachRight(findNodesInCodeTree(tree, node => _.isMatch(node, reactPropTypes)), node => {
		propTypeNodes[node.expression.left.object.name] = code.substring(node.expression.right.start, node.expression.right.end)

		code = code.substring(0, node.start) + code.substring(node.end)
	})

	if (_.isEmpty(propTypeNodes) === false) {
		tree = parseTree(code)
	}

	return findNodesInCodeTree(tree, node =>
		_.isMatch(node, reactCreateClass) ||
		_.isMatch(node, reactStatelessFunction) &&
		(checkIfFunctionThatReturnReactOnly(node) || checkIfFunctionThatReturnReactLast(node))
	).map((node, rank, list) => {
		let body
		if (_.isMatch(node, reactCreateClass)) {
			body = node.declarations[0].init.arguments[0].properties.map(item => {
				if (item.key.name === 'propTypes') {
					return 'static propTypes = ' + code.substring(item.value.start, item.value.end)

				} else if (item.key.name === 'getDefaultProps') {
					let temp
					if (_.isMatch(item, methodThatReturnAnObject)) {
						temp = item.body.body[0].argument

					} else if (_.isMatch(item, functionThatReturnAnObject)) {
						temp = item.value.body.body[0].argument

					} else {
						throw 'getDefaultProps'
					}

					return 'static defaultProps = ' + code.substring(temp.start, temp.end)

				} else if (item.key.name === 'getInitialState') {
					let temp
					if (_.isMatch(item, methodThatReturnAnObject)) {
						temp = item.body.body[0].argument

					} else if (_.isMatch(item, functionThatReturnAnObject)) {
						temp = item.value.body.body[0].argument

					} else {
						throw 'getInitialState'
					}

					return `
				constructor (props) {
				  super(props)

				  this.state = ${code.substring(temp.start, temp.end)}
				}
				`.trim()

				} else if (_.isMatch(item, { type: 'ObjectMethod', body: { type: 'BlockStatement' } })) {
					const methodName = item.key.name
					const methodPara = item.params.map(para => para.name).join(', ')
					const methodBody = code.substring(item.body.start, item.body.end)

					if (reactLifeCycleNames.includes(methodName)) {
						return `${methodName} (${methodPara}) ` + methodBody

					} else {
						return `${methodName} = (${methodPara}) => ` + methodBody
					}

				} else {
					throw item.key.name
				}
			})

		} else if (_.isMatch(node, reactStatelessFunction)) {
			const componentName = node.declarations[0].id.name

			let propTypeCode = propTypeNodes[componentName]
			if (propTypeCode) {
				propTypeCode = 'static propTypes = ' + propTypeCode.trim()
			}

			let renderCode = ''
			const renderNode = node.declarations[0].init.body
			if (checkIfFunctionThatReturnReactOnly(node)) {
				renderCode = 'render () {\nreturn (\n' + code.substring(renderNode.start, renderNode.end) + '\n)\n}\n'

			} else if (checkIfFunctionThatReturnReactLast(node)) {
				renderCode = 'render () ' + code.substring(renderNode.start, renderNode.end)
			}

			body = [
				propTypeCode,
				renderCode,
			]
		}

		return [
			rank === 0 ? '' : code.substring(list[rank - 1].end, node.start).trim(),
			'',
			`class ${node.declarations[0].id.name} extends React.PureComponent {`,
			_.chain(body).compact().flattenDeep().value().join('\n\n'),
			'}',
			'',
			rank === list.length - 1 ? code.substring(node.end).trim() : '',
		].join('\n')
	}).join('')
}

function findNodesInCodeTree(node, condition, parentNodes = []) {
	if (node === null) {
		return []

	} else if (node['type'] === 'File' && node['program']) {
		return findNodesInCodeTree(node['program'], condition)

	} else if (condition(node, parentNodes)) {
		return [node]

	} else if (_.isArrayLike(node['body'])) {
		let output = []
		for (let index = 0; index < node['body'].length; index++) {
			const result = findNodesInCodeTree(node['body'][index], condition, [...parentNodes, node])
			if (result.length > 0) {
				output.push(...result)
			}
		}
		return output

	} else if (_.isObject(node['body'])) {
		return findNodesInCodeTree(node['body'], condition, [...parentNodes, node])

	} else {
		return []
	}
}

module.exports = migrateReactClass