const _ = require('lodash')
const ts = require('typescript')

function migrateTypeDefinition(code) {
	const tree = ts.createSourceFile('file', code, ts.ScriptTarget.ESNext, true)

	const propTypeModuleNode = _.last(findNodes(tree, node =>
		ts.isImportDeclaration(node) &&
		node.moduleSpecifier.text === 'prop-types' &&
		node.importClause &&
		ts.isIdentifier(node.importClause.name)
	))
	if (!propTypeModuleNode) {
		return code
	}

	const propTypeModuleName = propTypeModuleNode.importClause.name.text

	const classListWithoutPropDefinitions = findNodes(tree, node =>
		ts.isClassDeclaration(node) &&
		node.heritageClauses &&
		ts.isHeritageClause(node.heritageClauses[0]) &&
		node.heritageClauses[0].types.length > 0 &&
		ts.isExpressionWithTypeArguments(node.heritageClauses[0].types[0]) &&
		node.heritageClauses[0].types[0].expression.expression.text === 'React' &&
		(node.heritageClauses[0].types[0].expression.name.text === 'Component' || node.heritageClauses[0].types[0].expression.name.text === 'PureComponent') &&
		_.isEmpty(node.heritageClauses[0].types[0].expression.typeArguments)
	)

	_.forEachRight(classListWithoutPropDefinitions, classNode => {
		const propTypeNode = _.first(findNodes(classNode.members, node =>
			ts.isPropertyDeclaration(node) &&
			node.modifiers &&
			node.modifiers[0].kind === ts.SyntaxKind.StaticKeyword &&
			ts.isIdentifier(node.name) &&
			node.name.text === 'propTypes' &&
			node.initializer &&
			ts.isObjectLiteralExpression(node.initializer)
		))
		if (!propTypeNode) {
			return null
		}

		// Remove the old `static propTypes = { ... }`
		code = code.substring(0, propTypeNode.pos) + code.substring(propTypeNode.end)

		const propList = []
		_.forEach(propTypeNode.initializer.properties, workNode => {
			if (ts.isPropertyAssignment(workNode) === false) {
				return null
			}

			// Preserve single-line comments
			const comments = workNode.getFullText()
				.split('\n')
				.map(line => line.trim())
				.filter(line => line.startsWith('//'))
			if (comments.length > 0 && propList.length > 0) {
				comments.unshift('')
			}
			propList.push(...comments)

			const { type, required } = getCorrespondingTypeDefinition(workNode.initializer)
			propList.push(workNode.name.text + (required ? '' : '?') + ': ' + type)
		})

		let cursor = classNode.heritageClauses[0].types[0].expression.end + 1
		const newLine = propList.some(item => item.startsWith('//'))
		let propText = (
			'{' + (newLine ? '\n' : ' ') +
			propList.join(newLine ? '\n' : ', ') +
			(newLine ? '\n' : ' ') + '}'
		)
		if (classNode.heritageClauses[0].types[0].typeArguments === undefined) {
			cursor -= 1
			propText = '<' + propText + '>'
		}
		code = code.substring(0, cursor) + propText + code.substring(cursor)
	})

	code = code.substring(0, propTypeModuleNode.pos) + code.substring(propTypeModuleNode.end)

	return code

	function getCorrespondingTypeDefinition(workNode) {
		const propNode = _.first(findNodes(workNode, node =>
			ts.isPropertyAccessExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === propTypeModuleName
		))

		if (!propNode) {
			return null
		}

		let corrType = propNode.name.text
		if (corrType === 'bool') {
			corrType = 'boolean'
		} else if (corrType === 'func') {
			corrType = '() => void'
		} else if (corrType === 'array') {
			corrType = 'Array<any>'
		} else if (corrType === 'arrayOf') {
			corrType = 'Array<' + getCorrespondingTypeDefinition(propNode.parent.arguments[0]).type + '>'
		} else if (corrType === 'instanceOf') {
			corrType = propNode.parent.arguments[0].text
		} else if (corrType === 'objectOf') {
			corrType = _.capitalize(getCorrespondingTypeDefinition(propNode.parent.arguments[0]).type)
		} else if (propNode.name.text === 'oneOf') {
			corrType = _.chain(propNode.parent.arguments[0].elements)
				.map(node => {
					if (ts.isStringLiteral(node)) {
						return '"' + node.text + '"'
					} else {
						return node.text
					}
				})
				.compact()
				.value()
				.join(' | ')
		} else if (propNode.name.text === 'oneOfType') {
			corrType = _.chain(propNode.parent.arguments[0].elements)
				.map(node => getCorrespondingTypeDefinition(node))
				.map('type')
				.flatten()
				.compact()
				.value()
				.join(' | ')
		} else if (propNode.name.text === 'node') {
			corrType = 'React.ReactNode'
		} else if (propNode.name.text === 'element') {
			corrType = 'JSX.Element'
		} else if (propNode.name.text === 'shape') {
			corrType = (
				'{ ' +
				propNode.parent.arguments[0].properties
					.map(node => node.name.text + ': ' + getCorrespondingTypeDefinition(node.initializer).type)
					.join(', ') +
				' }'
			)
		}

		if (!corrType) {
			return null
		}

		const required = _.get(propNode, 'parent.name.text') === 'isRequired'

		return { type: corrType, required }
	}
}

function findNodes(node, condition, visitedNodes = new Set()) {
	if (node === undefined || node === null || typeof node !== 'object') {
		return []
	}

	if (visitedNodes.has(node)) {
		return []
	}

	if (condition(node)) {
		return [node]
	}

	visitedNodes.add(node)

	const outputs = []
	for (const name in node) {
		if (name === 'parent') {
			continue
		}

		outputs.push(...findNodes(node[name], condition, visitedNodes))
	}

	return outputs
}

module.exports = migrateTypeDefinition