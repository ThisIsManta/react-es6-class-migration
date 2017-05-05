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

function migrate(code) {
	const tree = babylon.parse(code, {
		sourceType: 'module',
		plugins: ['classProperties', 'objectRestSpread', 'exportExtensions', 'dynamicImport', 'asyncGenerators', 'functionBind', 'jsx']
	})

	const node = findInCodeTree(tree, reactCreateClass)
	if (node === undefined) {
		return code
	}

	const body = [
		code.substring(0, node.start).trim(),
		'',
		`class ${node.declarations[0].id.name} extends React.Component {`,
		`}`,
		'',
		code.substring(node.end).trim(),
		'',
	]

	const list = node.declarations[0].init.arguments[0].properties.map(item => {
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

	body.splice(3, 0, _.chain(list).compact().flattenDeep().value().join('\n\n'))

	code = body.join('\n')

	return code
}

function findInCodeTree(source, target) {
	if (source === null) {
		return undefined

	} else if (source['type'] === 'File' && source['program']) {
		return findInCodeTree(source['program'], target)

	} else if (_.isMatch(source, target)) {
		return source

	} else if (_.isArrayLike(source['body'])) {
		for (let index = 0; index < source['body'].length; index++) {
			const result = findInCodeTree(source['body'][index], target)
			if (result !== undefined) {
				return result
			}
		}
		return undefined

	} else if (_.isObject(source['body'])) {
		return findInCodeTree(source['body'], target)

	} else {
		return undefined
	}
}

module.exports = migrate