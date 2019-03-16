#!/usr/bin/env node

const fs = require('fs')
const fp = require('path')
const glob = require('glob')
const _ = require('lodash')
const migrateReactClass = require('../dist/migrateReactClass').default
const migrateTypeDefinition = require('../dist/migrateTypeDefinition').default

const replaceOriginal = process.argv.find(argx => argx === '-r' || argx === '--replace')

_.chain(process.argv)
	.slice(2)
	.reject(para => para.startsWith('-'))
	.map(para => glob.sync(para))
	.flatten()
	.forEach(path => {
		const fileType = /\.(?:test-)?tsx$/.test(fp.extname(path)) ? 'tsx' : 'jsx'

		const originalCode = fs.readFileSync(path, { encoding: 'utf-8' })
		let modifiedCode = migrateReactClass(originalCode, fileType)

		if (fileType === 'tsx') {
			const lineFeed = /\r\n/.test(originalCode) ? '\r\n' : '\n'
			let indentation = '\t'
			if (/^\t/m.test(originalCode) === false) {
				indentation = _.chain(originalCode.split(lineFeed))
					.map(line => line.match(/^\s*/))
					.compact()
					.map(([space]) => space.length)
					.min()
					.value()
			}

			modifiedCode = migrateTypeDefinition(modifiedCode, { lineFeed, indentation })
		}

		if (replaceOriginal) {
			fs.writeFileSync(path, modifiedCode)

		} else {
			console.log(modifiedCode)
		}
	})
	.value()
