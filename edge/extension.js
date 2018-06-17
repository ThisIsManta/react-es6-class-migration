const vscode = require('vscode')
const migrateReactClass = require('./migrateReactClass')
const migrateTypeDefinition = require('./migrateTypeDefinition')

function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('migrateToReactClass', async () => {
		const editor = vscode.window.activeTextEditor
		const document = editor.document

		try {
			const originalCode = document.getText()
			let modifiedCode = migrateReactClass(originalCode)

			if (modifiedCode === '') {
				throw new Error('Could not migrate this document.')
			}

			if (document.languageId === 'typescriptreact') {
				modifiedCode = migrateTypeDefinition(modifiedCode)
			}

			if (originalCode !== modifiedCode) {
				await editor.edit(edit => {
					const editingRange = document.validateRange(new vscode.Range(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER))
					edit.replace(editingRange, modifiedCode)
				})
				await vscode.commands.executeCommand('editor.action.formatDocument')
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