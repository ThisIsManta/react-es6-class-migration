import * as _ from 'lodash'
import * as fp from 'path'
import * as ts from 'typescript'

export default function (originalCode: string, fileType: 'jsx' | 'tsx') {
	const codeTree = ts.createSourceFile('file.' + fileType, originalCode, ts.ScriptTarget.ESNext, true)
	const components = findStatelessComponents(codeTree)
	const attachments = findAttachments(codeTree)
	const processingNodes: Array<{ start: number, end: number, replacement?: string }> = []

	for (const component of components) {
		const propTypes = attachments.find(item => item.componentName === component.componentName && item.fieldName === 'propTypes')
		if (propTypes) {
			processingNodes.push({ start: propTypes.rootNode.getStart(), end: propTypes.rootNode.getEnd() })
		}

		const defaultProps = attachments.find(item => item.componentName === component.componentName && item.fieldName === 'defaultProps')
		if (defaultProps) {
			processingNodes.push({ start: defaultProps.rootNode.getStart(), end: defaultProps.rootNode.getEnd() })
		}

		// Replace "props" with "this.props"
		if (ts.isIdentifier(component.propNode.name)) {
			const bodyTree = ts.createSourceFile('file.' + fileType, component.bodyText, ts.ScriptTarget.ESNext, true)
			const propList = _.sortBy(findPropIdentifiers(bodyTree, component.propNode.name.text), node => -node.getStart())
			for (const propNode of propList) {
				component.bodyText = component.bodyText.substring(0, propNode.getStart()) + 'this.props' + component.bodyText.substring(propNode.getEnd())
			}
		}

		const newText = [
			// TODO: export
			// TODO: export default
			`class ${component.componentName} extends React.Component {`,
			propTypes ? `static propTypes = ${propTypes.text}\n` : null,
			defaultProps ? `static defaultProps = ${defaultProps.text}\n` : null,
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

const createNodeMatcher = <T>(getInitialResult: () => T, reducer: (node: ts.Node, results: T) => T | undefined) => (node: ts.Node) => {
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
			ts.isJsxElement(node) ||
			ts.isParenthesizedExpression(node) && ts.isJsxElement(node.expression) ||
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

const findPropIdentifiers = (node: ts.Node, name: string) => createNodeMatcher<Array<ts.Identifier>>(
	() => [],
	(node, results) => {
		if (ts.isIdentifier(node) && node.text === name) {
			results.push(node)
			return results
		}
	}
)(node)
