const fs = require('fs')
const fp = require('path')
const cp = require('child_process')

const fileList = fs.readdirSync('./test')

const TEST_FILE_PATTERN = /^snapshot-(\d+)-in\./

process.exitCode = -1

for (const fileName of fileList) {
	const filePath = fp.join('./test', fileName)
	if (TEST_FILE_PATTERN.test(fileName) === false) {
		continue
	}

	const caseNumb = fileName.match(TEST_FILE_PATTERN)[1]

	console.log('Testing', fileName)

	const worker = cp.spawnSync('node', ['./edge/command.js', filePath], { encoding: 'utf-8' })
	const output = worker.stdout.toString().trim()

	const expect = fs.readFileSync(`./test/snapshot-${caseNumb}-out${fp.extname(fileName)}`, { encoding: 'utf-8' }).trim()

	if (output !== expect) {
		throw 'Error'
	}
}

process.exitCode = 0