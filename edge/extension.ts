import * as vscode from 'vscode'
import migrateReactClass from './migrateReactClass'
import migrateTypeDefinition from './migrateTypeDefinition'

export function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('migrateToReactClass', async () => {
		const editor = vscode.window.activeTextEditor
		if (!editor) {
			return vscode.window.showErrorMessage('No document opened.')
		}

		const document = editor.document
		try {
			const originalCode = document.getText()
			let modifiedCode = migrateReactClass(originalCode, document.languageId === 'typescriptreact' ? 'tsx' : 'jsx')

			if (document.languageId === 'typescriptreact') {
				modifiedCode = migrateTypeDefinition(modifiedCode)
			}

			if (originalCode !== modifiedCode) {
				await editor.edit(edit => edit.replace(
					new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end),
					modifiedCode
				))

				await vscode.commands.executeCommand('editor.action.formatDocument')
			}

		} catch (error) {
			vscode.window.showErrorMessage(error.message)
			console.error(error)
		}
	}))
}

export function deactivate() { }
