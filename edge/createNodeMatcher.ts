import * as ts from 'typescript'

export const createNodeMatcher = <T>(getInitialResult: () => T, reducer: (node: ts.Node, results: T) => T | undefined) => (node: ts.Node) => {
	const visitedNodes = new Set<ts.Node>()
	let oldResult = getInitialResult()
	const stopWhenDefined = oldResult === undefined
	const matcher = (node: ts.Node) => {
		if (stopWhenDefined && oldResult !== undefined) {
			return
		}

		if (node === null || node === undefined) {
			return
		}

		if (visitedNodes.has(node)) {
			return

		} else {
			visitedNodes.add(node)
		}

		let newResult = reducer(node, oldResult)
		if (newResult === undefined) {
			node.forEachChild(stub => {
				matcher(stub)
			})

		} else {
			oldResult = newResult
		}
	}
	matcher(node)
	return oldResult
}
