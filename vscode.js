const vscode = require('vscode')
const migrate = require('./migrate')

function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('migrate-to-react-es6-class', () => {
		const editor = vscode.window.activeTextEditor
		const document = editor.document

		try {
			const originalCode = document.getText()
			const modifiedCode = migrate(document.getText())

			if (originalCode === modifiedCode) {
				vscode.window.showInformationMessage('Nothing is to be migrated.')

			} else {
				editor.edit(edit => {
					const editingRange = document.validateRange(new vscode.Range(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER))
					edit.replace(editingRange, modifiedCode)
				})

				if (document.isUntitled === false) {
					vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', document.uri, { insertSpaces: true, tabSize: 2 })
				}
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