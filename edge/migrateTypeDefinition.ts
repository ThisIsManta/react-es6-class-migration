import * as _ from 'lodash'
import * as ts from 'typescript'
import { findReactModule, findPropTypeModule, createNamedImport } from './migrateReactClass'
import { createNodeMatcher } from './createNodeMatcher'

export default function (originalCode: string, { lineFeed, indentation }: { lineFeed: string, indentation: string }) {
	const codeTree = ts.createSourceFile('file.tsx', originalCode, ts.ScriptTarget.ESNext, true)
	let modifiedCode = originalCode
	const processingNodes: Array<{ start: number, end: number, replacement: string }> = []

	const reactModule = findReactModule(codeTree)
	const propTypeModule = findPropTypeModule(codeTree)
	const classListWithoutPropDefinitions = findClassListWithoutPropDefinitions(codeTree, reactModule.name)

	_.forEachRight(classListWithoutPropDefinitions, classNode => {
		const staticPropType = findStaticPropType(classNode.members)
		if (!staticPropType) {
			return null
		}

		// Remove the old `static propTypes = { ... }`
		modifiedCode = modifiedCode.substring(0, staticPropType.node.pos) + modifiedCode.substring(staticPropType.node.end)

		const propList = []
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
		const newLineNeeded = propList.some(item => item.startsWith('//'))
		let propText = (
			'{' + (newLineNeeded ? lineFeed + indentation : ' ') +
			propList.join(newLineNeeded ? lineFeed + indentation : '; ') +
			(newLineNeeded ? lineFeed : ' ') + '}'
		)
		if (classNode.heritageClauses[0].types[0].typeArguments === undefined) {
			cursor -= 1
			propText = '<' + propText + '>'
		}
		modifiedCode = modifiedCode.substring(0, cursor) + propText + modifiedCode.substring(cursor)
	})

	// Delete `import PropTypes from 'prop-types'`
	if (propTypeModule.node) {
		processingNodes.push({
			start: propTypeModule.node.pos,
			end: propTypeModule.node.end, // Do not use `getEnd()` because it does not remove the line feed
			replacement: ''
		})
	}

	_.chain(processingNodes)
		.sortBy(item => item.start)
		.forEachRight(item => {
			modifiedCode = modifiedCode.substring(0, item.start) + item.replacement + modifiedCode.substring(item.end)
		})
		.value()

	return modifiedCode

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
