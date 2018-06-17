const vscode = require('vscode')
const migrateReactClass = require('./migrateReactClass')

function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('migrateToReactClass', () => {
		const editor = vscode.window.activeTextEditor
		const document = editor.document

		try {
			const originalCode = document.getText()
			const modifiedCode = migrateReactClass(originalCode)

			if (originalCode !== modifiedCode) {
				editor.edit(edit => {
					const editingRange = document.validateRange(new vscode.Range(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER))
					edit.replace(editingRange, modifiedCode)
				})
			}

		} catch (error) {
			vscode.window.showErrorMessage(error.message)
			console.error(error)
		}
	}))
}

function deactivate() { }

module.exports.activate = activate
module.exports.deactivate = deactivate