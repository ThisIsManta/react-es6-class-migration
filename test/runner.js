const _ = require('lodash')
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

	const outputLines = output.split(/\r?\n/).map(line => line.replace(/^\s*/g, '·').replace(/\t/g, '¬') + '¶')
	const expectLines = expect.split(/\r?\n/).map(line => line.replace(/^\s*/g, '·').replace(/\t/g, '¬') + '¶')
	const bound = _.min([outputLines.length, expectLines.length])
	for (let index = 0; index < bound - 1; index++) {
		if (outputLines[index] !== expectLines[index]) {
			console.log('The first difference is at line ' + (index + 1) + ':')
			console.log('  ' + outputLines[index])
			console.log('  ' + expectLines[index])
			throw 'Error'
		}
	}
}

process.exitCode = 0