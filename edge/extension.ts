import * as fs from 'fs'
import * as fp from 'path'
import * as _ from 'lodash'
import * as vscode from 'vscode'
import migrateReactClass from './migrateReactClass'
import migrateTypeDefinition from './migrateTypeDefinition'

export function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('migrateToReactClass', async () => {
		const editor = vscode.window.activeTextEditor
		if (!editor) {
			return vscode.window.showErrorMessage('No document opened.')
		}

		const { document } = editor
		try {
			const originalCode = document.getText()
			let modifiedCode = migrateReactClass(originalCode, document.languageId === 'typescriptreact' ? 'tsx' : 'jsx')

			const currentFileIsTypeScript = document.languageId === 'typescriptreact'
			const currentFileWilBeRenamedToTypeScript = !currentFileIsTypeScript && await checkIfUserWantsToConvertToTypeScript()
			if (currentFileIsTypeScript || currentFileWilBeRenamedToTypeScript) {
				modifiedCode = migrateTypeDefinition(modifiedCode)
			}

			if (originalCode !== modifiedCode) {
				await editor.edit(edit => edit.replace(
					new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end),
					modifiedCode
				))

				await vscode.commands.executeCommand('editor.action.formatDocument')
			}

			if (currentFileWilBeRenamedToTypeScript) {
				vscode.window.withProgress({ title: 'Converting to TypeScript React', location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, cancellationToken) => {
					await document.save()
					
					if (cancellationToken.isCancellationRequested) {
						return
					}

					const newFilePath = document.fileName.replace(new RegExp(_.escapeRegExp(fp.extname(document.fileName)) + '$'), '.tsx')
					fs.renameSync(document.fileName, newFilePath)

					if (cancellationToken.isCancellationRequested) {
						fs.renameSync(newFilePath, document.fileName)
						return
					}

					await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
					await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(newFilePath), editor.viewColumn)
				})
			}

		} catch (error) {
			vscode.window.showErrorMessage(error.message)
			console.error(error)
		}
	}))
}

async function checkIfUserWantsToConvertToTypeScript() {
	const typeScriptReactFile = await vscode.workspace.findFiles('**/*.tsx', null, 1)
	if (typeScriptReactFile.length === 0) {
		return false
	}

	const select = await vscode.window.showInformationMessage('The current workspace contains a TypeScript React (*.tsx) file.', { modal: true }, 'Convert this file to TypeScript React')
	return !!select
}

export function deactivate() { }
