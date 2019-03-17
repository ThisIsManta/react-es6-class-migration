import * as _ from 'lodash'
import * as ts from 'typescript'
import { findReactModule, findPropTypeModule, createNamedImport } from './migrateReactClass'
import { createNodeMatcher } from './createNodeMatcher'

export default function (originalCode: string, { lineFeed, indentation }: { lineFeed: string, indentation: string }) {
	const codeTree = ts.createSourceFile('file.tsx', originalCode, ts.ScriptTarget.ESNext, true)
	const processingNodes: Array<{ start: number, end: number, replacement: string }> = []

	// Delete `import PropTypes from 'prop-types'`
	const propTypeModule = findPropTypeModule(codeTree)
	if (propTypeModule.node) {
		processingNodes.push({
			start: propTypeModule.node.pos,
			end: propTypeModule.node.end, // Do not use `getEnd()` because it does not remove the line feed
			replacement: ''
		})
	}

	const reactModule = findReactModule(codeTree)
	const classListWithoutPropDefinitions = findClassListWithoutPropDefinitions(codeTree, reactModule.name)
	_.forEachRight(classListWithoutPropDefinitions, classNode => {
		const staticPropType = findStaticPropType(classNode.members)
		if (!staticPropType) {
			return null
		}

		// Remove the old `static propTypes = { ... }`
		processingNodes.push({
			start: staticPropType.node.pos,
			end: staticPropType.node.end,
			replacement: ''
		})

		const propList: Array<string> = []
		_.forEach(staticPropType.members, workNode => {
			if (ts.isPropertyAssignment(workNode) === false) {
				return null
			}
			const { name, initializer: value } = workNode as ts.PropertyAssignment

			// Preserve single-line comments
			const comments = workNode.getFullText()
				.split('\n')
				.map(line => line.trim())
				.filter(line => line.startsWith('//'))
			if (comments.length > 0 && propList.length > 0) {
				comments.unshift('')
			}
			propList.push(...comments)

			const { type, required } = getCorrespondingTypeDefinition(value)
			propList.push(name.getText() + (required ? '' : '?') + ': ' + type)
		})

		let cursor = classNode.heritageClauses[0].types[0].expression.end + 1
		const newLineNeeded = propList.length > 1 || propList.some(item => item.startsWith('//'))
		let classType = (
			'{' +
			(newLineNeeded ? lineFeed + indentation : ' ') +
			propList.join(newLineNeeded ? lineFeed + indentation : '; ') +
			(newLineNeeded ? lineFeed : ' ') +
			'}'
		)

		const stateNode = findStateInitialization(classNode)
		if (stateNode) {
			// Wrap `state = {}` onto a constructor
			if (ts.isPropertyDeclaration(stateNode)) {
				const stateInitializer = lineFeed +
					indentation + 'constructor(props) {' + lineFeed +
					indentation + indentation + 'super(props)' + lineFeed +
					lineFeed +
					indentation + indentation + 'this.' + stateNode.getText().split(lineFeed).join(lineFeed + indentation) + lineFeed +
					indentation + '}'
				processingNodes.push({
					start: stateNode.pos,
					end: stateNode.end,
					replacement: stateInitializer
				})
			}

			const objectNode = ts.isPropertyDeclaration(stateNode) ? stateNode.initializer : stateNode
			if (ts.isObjectLiteralExpression(objectNode)) {
				const stateList = _.compact(objectNode.properties.map(node => {
					if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
						return node.name.text + ': ' + getLiteralTypeDefinition(node.initializer).join(' | ')
					}
				}))
				const newLineNeeded = stateList.length > 1
				classType += (
					', {' +
					(newLineNeeded ? lineFeed + indentation : ' ') +
					stateList.join(newLineNeeded ? lineFeed + indentation : '; ') +
					(newLineNeeded ? lineFeed : ' ') +
					'}'
				)
			}
		}

		// Add prop-type and also state-type definition
		if (classNode.heritageClauses[0].types[0].typeArguments === undefined) {
			cursor -= 1
			classType = '<' + classType + '>'
		}
		processingNodes.push({
			start: cursor,
			end: cursor,
			replacement: classType
		})
	})

	return _.chain(processingNodes)
		.sortBy(item => item.start)
		.reverse()
		.reduce((modifiedCode, item) => {
			return modifiedCode.substring(0, item.start) + item.replacement + modifiedCode.substring(item.end)
		}, originalCode)
		.value()

	function getCorrespondingTypeDefinition(workNode: ts.Node) {
		const propNode = findPropType(workNode, propTypeModule.name)
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
		} else if (propNode.name.text === 'node') {
			if (reactModule.name.has('ReactNode')) {
				corrType = 'ReactNode'
			} else if (reactModule.name.has('default*')) {
				corrType = reactModule.name.get('default*') + '.ReactNode'
			} else {
				corrType = 'ReactNode'
				reactModule.name.set('ReactNode', 'ReactNode')
				processingNodes.push(createNamedImport(reactModule.node, 'ReactNode'))
			}
		} else if (propNode.name.text === 'element') {
			corrType = 'JSX.Element'
		}

		if (ts.isCallExpression(propNode.parent) && propNode.parent.arguments.length > 0) {
			if (corrType === 'arrayOf') {
				corrType = 'Array<' + getCorrespondingTypeDefinition(propNode.parent.arguments[0]).type + '>'
			} else if (corrType === 'instanceOf') {
				corrType = propNode.parent.arguments[0].getText()
			} else if (corrType === 'objectOf') {
				corrType = '{ [string]: ' + getCorrespondingTypeDefinition(propNode.parent.arguments[0]).type + ' }'
			} else if (propNode.name.text === 'oneOf' && ts.isArrayLiteralExpression(propNode.parent.arguments[0])) {
				const typeNode = propNode.parent.arguments[0] as ts.ArrayLiteralExpression
				corrType = _.chain(typeNode.elements)
					.map(node => {
						if (ts.isStringLiteral(node)) {
							return '"' + node.text + '"'
						} else {
							return node.getText()
						}
					})
					.compact()
					.value()
					.join(' | ')
			} else if (propNode.name.text === 'oneOfType' && ts.isArrayLiteralExpression(propNode.parent.arguments[0])) {
				const typeNode = propNode.parent.arguments[0] as ts.ArrayLiteralExpression
				corrType = _.chain(typeNode.elements)
					.map(node => getCorrespondingTypeDefinition(node))
					.map('type')
					.flatten()
					.compact()
					.value()
					.join(' | ')
			} else if (propNode.name.text === 'shape' && ts.isObjectLiteralExpression(propNode.parent.arguments[0])) {
				const typeNode = propNode.parent.arguments[0] as ts.ObjectLiteralExpression
				corrType = (
					'{ ' +
					typeNode.properties
						.map((node: ts.PropertyAssignment) => node.name.getText() + ': ' + getCorrespondingTypeDefinition(node.initializer).type)
						.join('; ') +
					' }'
				)
			}
		}

		if (!corrType) {
			return null
		}

		const required = _.get(propNode, 'parent.name.text') === 'isRequired'

		return { type: corrType, required }
	}
}

function getLiteralTypeDefinition(workNode: ts.Node): Array<string> {
	if (ts.isStringLiteral(workNode) || ts.isTemplateExpression(workNode) || ts.isNoSubstitutionTemplateLiteral(workNode)) {
		return ['string']

	} else if (ts.isNumericLiteral(workNode) || ts.isIdentifier(workNode) && (workNode.text === 'NaN' || workNode.text === 'Infinity')) {
		return ['number']

	} else if (workNode.kind === ts.SyntaxKind.TrueKeyword || workNode.kind === ts.SyntaxKind.FalseKeyword) {
		return ['boolean']

	} else if (workNode.kind === ts.SyntaxKind.NullKeyword) {
		return ['null']

	} else if (ts.isArrayLiteralExpression(workNode)) {
		if (workNode.elements.length === 0) {
			return ['Array<any>']
		}
		return [
			'Array<' +
			_.chain(workNode.elements)
				.map(node => getLiteralTypeDefinition(node))
				.flatten()
				.compact()
				.uniq()
				.value()
				.join(' | ') +
			'>'
		]

	} else if (ts.isObjectLiteralExpression(workNode)) {
		if (workNode.properties.length === 0) {
			return ['object']
		}

		return [
			'{' +
			_.chain(workNode.properties)
				.map(node => {
					if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
						return node.name.text + ': ' + getLiteralTypeDefinition(node.initializer).join(' | ')
					}
				})
				.compact().value().join('; ') +
			'}'
		]

	} else if (ts.isPrefixUnaryExpression(workNode) && workNode.getFirstToken().kind === ts.SyntaxKind.ExclamationToken) {
		return ['boolean']

	} else if (ts.isBinaryExpression(workNode)) {
		const types = _.without(_.uniq([
			...getLiteralTypeDefinition(workNode.left),
			...getLiteralTypeDefinition(workNode.right),
		]), 'any')
		switch (workNode.operatorToken.kind) {
			case ts.SyntaxKind.BarBarToken:
				if (types.length > 0) {
					return types
				}
			case ts.SyntaxKind.PlusToken:
				if (types.some(dataType => dataType === 'string')) {
					return ['string']
				}
		}
	}

	return ['any']
}

const findClassListWithoutPropDefinitions = (node: ts.Node, reactModuleNames: Map<string, string>) => createNodeMatcher<Array<ts.ClassDeclaration>>(
	() => [],
	(node, results) => {
		if (
			ts.isClassDeclaration(node) &&
			node.heritageClauses &&
			ts.isHeritageClause(node.heritageClauses[0]) &&
			node.heritageClauses[0].types.length > 0 &&
			ts.isExpressionWithTypeArguments(node.heritageClauses[0].types[0]) &&
			node.heritageClauses[0].types[0].typeArguments === undefined
		) {
			const stub = node.heritageClauses[0].types[0]
			if (
				(
					ts.isPropertyAccessExpression(stub.expression) &&
					ts.isIdentifier(stub.expression.expression) &&
					reactModuleNames.has('default*') &&
					stub.expression.expression.text === reactModuleNames.get('default*') &&
					(stub.expression.name.text === 'Component' || stub.expression.name.text === 'PureComponent')
				) ||
				(
					ts.isIdentifier(stub.expression) &&
					(
						stub.expression.text === reactModuleNames.get('Component') ||
						stub.expression.text === reactModuleNames.get('PureComponent')
					)
				)
			) {
				results.push(node)
				return results
			}
		}
	}
)(node)

const findStaticPropType = (nodeList: ts.NodeArray<ts.ClassElement>) => {
	const matcher = createNodeMatcher<{ node: ts.PropertyDeclaration, members: ts.NodeArray<ts.ObjectLiteralElementLike> }>(
		() => undefined,
		(node) => {
			if (
				ts.isPropertyDeclaration(node) &&
				node.modifiers &&
				node.modifiers[0].kind === ts.SyntaxKind.StaticKeyword &&
				ts.isIdentifier(node.name) &&
				node.name.text === 'propTypes' &&
				node.initializer &&
				ts.isObjectLiteralExpression(node.initializer)
			) {
				return { node, members: node.initializer.properties }
			}
		}
	)
	return _.last(_.compact(nodeList.map(node => matcher(node))))
}

const findPropType = (node: ts.Node, moduleName: string) => createNodeMatcher<ts.PropertyAccessExpression>(
	() => undefined,
	(node) => {
		if (
			ts.isPropertyAccessExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === moduleName
		) {
			return node
		}
	}
)(node)

const findStateInitialization = (node: ts.ClassDeclaration) => createNodeMatcher<ts.PropertyDeclaration | ts.ObjectLiteralExpression>(
	() => undefined,
	(node) => {
		if (
			ts.isPropertyDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text === 'state' &&
			ts.isObjectLiteralExpression(node.initializer)
		) {
			return node
		}

		if (ts.isConstructorDeclaration(node)) {
			for (const statement of node.body.statements) {
				if (
					ts.isExpressionStatement(statement) &&
					ts.isBinaryExpression(statement.expression) &&
					ts.isPropertyAccessExpression(statement.expression.left) &&
					statement.expression.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
					statement.expression.left.name.text === 'state' &&
					ts.isObjectLiteralExpression(statement.expression.right)
				) {
					return statement.expression.right
				}
			}
		}
	}
)(node)
