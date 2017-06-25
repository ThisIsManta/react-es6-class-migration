const babylon = require('babylon')
const _ = require('lodash')

const methodThatReturnAnObject = node =>
	_.isMatch(node, { type: 'ObjectMethod', body: { type: 'BlockStatement' } }) &&
	_.isMatch(_.last(node.body.body), { type: 'ReturnStatement' })

const functionThatReturnAnObject = node =>
	_.isMatch(node, { type: 'ObjectProperty', value: { type: 'FunctionExpression', body: { type: 'BlockStatement' } } }) &&
	_.isMatch(_.last(node.value.body.body), { type: 'ReturnStatement' })

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

const checkIfFunctionReturnsReactOnly = node => node.declarations[0].init.body.type === 'JSXElement'

const checkIfFunctionReturnsReactLast = node => node.declarations[0].init.body.type === 'BlockStatement' && _.isMatch(_.last(node.declarations[0].init.body.body), { type: 'ReturnStatement', argument: { type: 'JSXElement' } })

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
	_.forEachRight(findNodes(tree, node => _.isMatch(node, reactPropTypes)), node => {
		propTypeNodes[node.expression.left.object.name] = code.substring(node.expression.right.start, node.expression.right.end)

		code = code.substring(0, node.start) + code.substring(node.end)
	})

	if (_.isEmpty(propTypeNodes) === false) {
		tree = parseTree(code)
	}

	return findNodes(tree, node =>
		_.isMatch(node, reactCreateClass) ||
		_.isMatch(node, reactStatelessFunction) && (checkIfFunctionReturnsReactOnly(node) || checkIfFunctionReturnsReactLast(node))
	).map((node, rank, list) => {
		let classBody
		if (_.isMatch(node, reactCreateClass)) {
			classBody = node.declarations[0].init.arguments[0].properties.map(item => {
				if (item.key.name === 'propTypes') {
					return 'static propTypes = ' + code.substring(item.value.start, item.value.end)

				} else if (item.key.name === 'getDefaultProps') {
					let temp
					if (methodThatReturnAnObject(item)) {
						temp = item.body.body[0].argument

					} else if (functionThatReturnAnObject(item)) {
						temp = item.value.body.body[0].argument

					} else {
						throw 'getDefaultProps'
					}

					return 'static defaultProps = ' + code.substring(temp.start, temp.end)

				} else if (item.key.name === 'getInitialState') {
					let statements
					if (methodThatReturnAnObject(item)) {
						statements = item.body.body

					} else if (functionThatReturnAnObject(item)) {
						statements = item.value.body.body

					} else {
						throw 'getInitialState'
					}

					let initialization = ''
					if (statements.length > 1) {
						initialization = code.substring(statements[0].start, statements[statements.length - 2].end)
					}
					const state = code.substring(_.last(statements).argument.start, _.last(statements).argument.end)

					return [
						'constructor (props) {',
						'super(props)',
						'',
						initialization,
						'this.state = ' + state,
						'}',
					].join('\n').trim()

				} else if (_.isMatch(item, { type: 'ObjectMethod', body: { type: 'BlockStatement' } })) {
					const methodName = item.key.name
					const methodPara = item.params.map(serialize).join(', ')
					const methodBody = code.substring(item.body.start, item.body.end)
					const methodMods = item.async ? 'async' : ''

					if (reactLifeCycleNames.includes(methodName)) {
						return `${methodMods} ${methodName} (${methodPara}) ` + methodBody

					} else {
						return `${methodMods} ${methodName} = (${methodPara}) => ` + methodBody
					}

				} else {
					throw 'Unknown property: ' + item.key.name
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
			if (checkIfFunctionReturnsReactOnly(node)) {
				renderCode = 'render () {\nreturn (\n' + code.substring(renderNode.start, renderNode.end).replace(/(\W)props\./g, '$1this.props.') + '\n)\n}\n'

			} else if (checkIfFunctionReturnsReactLast(node)) {
				renderCode = 'render () ' + code.substring(renderNode.start, renderNode.end).replace(/(\W)props\./g, '$1this.props.')
			}

			classBody = [
				propTypeCode,
				renderCode,
			]
		}

		const className = node.declarations[0].id.name

		const exportDefaultStatement = _.last(findNodes(tree, node => _.isMatch(node, {
			type: 'ExportDefaultDeclaration',
			declaration: {
				type: 'Identifier',
				name: className
			}
		})))

		if (exportDefaultStatement) {
			code = code.substring(0, exportDefaultStatement.start) + (' '.repeat(exportDefaultStatement.end - exportDefaultStatement.start)) + code.substring(exportDefaultStatement.end)
		}

		return [
			code.substring(rank === 0 ? 0 : list[rank - 1].end, node.start).trim(),
			'',
			(exportDefaultStatement ? 'export default ' : '') + `class ${className} extends React.PureComponent {`,
			_.chain(classBody).compact().flattenDeep().value().join('\n\n'),
			'}',
			'',
			rank === list.length - 1 ? code.substring(node.end).trim() : '',
		].join('\n')
	}).join('')
}

function findNodes(node, condition, parentNode) {
	if (!node) {
		return []
	}

	node.parent = parentNode

	if (node['type'] === 'File' && node['program']) {
		return findNodes(node['program'], condition)

	} else if (condition(node)) {
		return [node]

	} else if (_.isArrayLike(node['body'])) {
		let output = []
		for (let index = 0; index < node['body'].length; index++) {
			const result = findNodes(node['body'][index], condition, node)
			if (result.length > 0) {
				output.push(...result)
			}
		}
		return output

	} else if (_.isObject(node['body'])) {
		return findNodes(node['body'], condition, node)

	} else {
		return []
	}
}

function serialize(node) {
	if (node.type === 'Identifier') {
		return node.name

	} else if (node.type === 'ObjectPattern') {
		return '{ ' + node.properties.map(serialize).join(', ') + ' }'

	} else if (node.type === 'ObjectProperty') {
		return serialize(node.value)
	}
}

module.exports = migrateReactClass