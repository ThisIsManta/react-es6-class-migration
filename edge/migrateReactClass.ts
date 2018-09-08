import * as _ from 'lodash'
import * as ts from 'typescript'

const mutablePropType = /^(?:array|object|shape|exact|node|element|instance|any)(?:Of)?$/

export default function (originalCode: string, fileType: 'jsx' | 'tsx') {
	const codeTree = ts.createSourceFile('file.' + fileType, originalCode, ts.ScriptTarget.ESNext, true)
	const components = findStatelessComponents(codeTree)
	const attachments = findAttachments(codeTree)
	const processingNodes: Array<{ start: number, end: number, replacement?: string }> = []

	const propTypeModule = findPropTypeModuleName(codeTree)

	for (const component of components) {
		const propTypes = attachments.find(item => item.componentName === component.componentName && item.fieldName === 'propTypes')
		let propsContainMutableTypes = false
		if (propTypes) {
			processingNodes.push({ start: propTypes.rootNode.getStart(), end: propTypes.rootNode.getEnd() })
			propsContainMutableTypes = findPropTypes(propTypes.rootNode, propTypeModule.name).some(type => mutablePropType.test(type))
		}

		component.bodyText = addThisReference(component.bodyText, component.propNode, fileType)

		const defaultProps = attachments.find(item => item.componentName === component.componentName && item.fieldName === 'defaultProps')
		if (defaultProps) {
			processingNodes.push({ start: defaultProps.rootNode.getStart(), end: defaultProps.rootNode.getEnd() })
		}

		const contextTypes = attachments.find(item => item.componentName === component.componentName && item.fieldName === 'contextTypes')
		if (contextTypes) {
			processingNodes.push({ start: contextTypes.rootNode.getStart(), end: contextTypes.rootNode.getEnd() })
		}

		component.bodyText = addThisReference(component.bodyText, component.contextNode, fileType)

		const newText = [
			// TODO: export
			// TODO: export default
			`class ${component.componentName} extends React.${propsContainMutableTypes ? '' : 'Pure'}Component {`,
			propTypes ? `static propTypes = ${propTypes.text}\n` : null,
			defaultProps ? `static defaultProps = ${defaultProps.text}\n` : null,
			contextTypes ? `static contextTypes = ${contextTypes.text}\n` : null,
			`render() {`,
			component.bodyText,
			`}`,
			`}`,
		].filter(line => line !== null).join('\n')
		processingNodes.push({ start: component.rootNode.getStart(), end: component.rootNode.getEnd(), replacement: newText })
	}

	let codeText = originalCode
	for (const item of _.sortBy(processingNodes, item => -item.start)) {
		codeText = codeText.substring(0, item.start) + (item.replacement || '') + codeText.substring(item.end)
	}
	return codeText
}

function addThisReference(bodyText: string, workNode: ts.ParameterDeclaration, fileType: string) {
	if (!workNode) {
		return bodyText
	}

	if (ts.isIdentifier(workNode.name)) {
		const bodyTree = ts.createSourceFile('file.' + fileType, bodyText, ts.ScriptTarget.ESNext, true)
		const nodeList = _.sortBy(findIdentifiers(bodyTree, workNode.name.text), node => -node.getStart())
		for (const node of nodeList) {
			bodyText = bodyText.substring(0, node.getStart()) + 'this.props' + bodyText.substring(node.getEnd())
		}

	} else if (ts.isObjectBindingPattern(workNode.name)) {
		const bodyTree = ts.createSourceFile('file.' + fileType, bodyText, ts.ScriptTarget.ESNext, true)
		const nodeList = _.chain(workNode.name.elements)
			.map(node => node.dotDotDotToken === undefined && ts.isIdentifier(node.name) ? node.name.text : null)
			.compact()
			.map(name => findIdentifiers(bodyTree, name))
			.flatten()
			.sortBy(node => -node.getStart())
			.value()
		for (const node of nodeList) {
			bodyText = bodyText.substring(0, node.getStart()) + 'this.context.' + node.text + bodyText.substring(node.getEnd())
		}
	}
	return bodyText
}

export const createNodeMatcher = <T>(getInitialResult: () => T, reducer: (node: ts.Node, results: T) => T | undefined) => (node: ts.Node) => {
	const visitedNodes = new Set<ts.Node>()
	let matchingNodes = getInitialResult()
	const matcher = (node: ts.Node) => {
		if (node === null || node === undefined) {
			return matchingNodes
		}

		if (visitedNodes.has(node)) {
			return matchingNodes

		} else {
			visitedNodes.add(node)
		}

		let newResult = reducer(node, matchingNodes)
		if (newResult === undefined) {
			node.forEachChild(stub => {
				matcher(stub)
			})

		} else {
			matchingNodes = newResult
		}

		return matchingNodes
	}
	return matcher(node)
}

interface Component {
	rootNode: ts.Node,
	componentName: string,
	propNode: ts.ParameterDeclaration,
	contextNode: ts.ParameterDeclaration,
	bodyText: string,
}

const findStatelessComponents = createNodeMatcher<Array<Component>>(
	() => [],
	(node, results) => {
		if (ts.isFunctionDeclaration(node) && hasReturnJSX(node.body)) {
			// function f() { return <div> }
			results.push({
				rootNode: node,
				componentName: node.name.text,
				propNode: node.parameters.length >= 1 ? node.parameters[0] : null,
				contextNode: node.parameters.length >= 2 ? node.parameters[1] : null,
				bodyText: node.body.statements.map(stub => stub.getText()).join('\n'),
			})
			return results

		} else if (ts.isVariableDeclarationList(node) && node.declarations.length === 1) {
			const stub = node.declarations[0]
			if (
				ts.isVariableDeclaration(stub) &&
				ts.isIdentifier(stub.name) &&
				stub.initializer &&
				(ts.isFunctionExpression(stub.initializer) || ts.isArrowFunction(stub.initializer)) &&
				hasReturnJSX(stub.initializer.body)
			) {
				// const f = function () { return <div/> }
				// const f = () => <div/>
				// const f = () => (<div/>)
				// const f = () => { return <div/> }
				results.push({
					rootNode: node,
					componentName: stub.name.text,
					propNode: stub.initializer.parameters.length >= 1
						? ts.getMutableClone(stub.initializer.parameters[0])
						: null,
					contextNode: stub.initializer.parameters.length >= 2
						? ts.getMutableClone(stub.initializer.parameters[1])
						: null,
					bodyText: ts.isBlock(stub.initializer.body)
						? stub.initializer.body.statements.map(stub => stub.getText()).join('\n')
						: ('return ' + stub.initializer.body.getText()),
				})
				return results
			}
		}
	}
)

const hasReturnJSX = createNodeMatcher(
	() => false,
	(node, found) => {
		if (
			ts.isArrowFunction(node) ||
			ts.isFunctionDeclaration(node) ||
			ts.isFunctionExpression(node)
		) {
			return found
		}

		if (
			ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) ||
			ts.isParenthesizedExpression(node) && (
				ts.isJsxElement(node.expression) || ts.isJsxSelfClosingElement(node.expression)
			) ||
			ts.isReturnStatement(node) && hasReturnJSX(node.expression)
		) {
			return true
		}
	}
)

interface Attachment {
	rootNode: ts.Node,
	componentName: string,
	fieldName: string,
	text: string,
}

const findAttachments = (node: ts.SourceFile) => createNodeMatcher<Array<Attachment>>(
	() => [],
	(node, results) => {
		if (
			ts.isExpressionStatement(node) &&
			ts.isBinaryExpression(node.expression) &&
			ts.isPropertyAccessExpression(node.expression.left) &&
			ts.isIdentifier(node.expression.left.expression) &&
			ts.isObjectLiteralExpression(node.expression.right)
		) {
			results.push({
				rootNode: node,
				componentName: node.expression.left.expression.text,
				fieldName: node.expression.left.name.text,
				text: node.expression.right.getFullText(),
			})
			return results
		}
	}
)(node)

export const findPropTypeModuleName = createNodeMatcher<{ node?: ts.ImportDeclaration, name: string }>(
	() => ({ name: 'PropTypes' }),
	(node) => {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text === 'prop-types' &&
			node.importClause &&
			ts.isIdentifier(node.importClause.name)
		) {
			return { node, name: node.importClause.name.text }
		}
	}
)

const findPropTypes = (node: ts.Node, moduleName: string) => createNodeMatcher<Array<string>>(
	() => [],
	(node, results) => {
		if (ts.isIdentifier(node) && node.text === moduleName && node.parent) {
			if (ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) {
				results.push(node.parent.name.text)
				return results

			} else if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node && ts.isPropertyAccessExpression(node.parent.parent)) {
				results.push(node.parent.parent.name.text)
				return results
			}
		}
	}
)(node)

const findIdentifiers = (node: ts.Node, name: string) => createNodeMatcher<Array<ts.Identifier>>(
	() => [],
	(node, results) => {
		if (ts.isIdentifier(node) && node.text === name) {
			if (node.parent && ts.isJsxAttribute(node.parent) && node.parent.name === node) {
				return
			}

			results.push(node)
			return results
		}
	}
)(node)
