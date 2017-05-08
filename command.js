#!/usr/bin/env node

const fs = require('fs')
const babylon = require('babylon')
const glob = require('glob')
const _ = require('lodash')
const migrateReactClass = require('./migrateReactClass')

const replaceOriginal = process.argv.find(argx => argx === '-r' || argx === '--replace')

_.chain(process.argv)
	.slice(2)
	.reject(para => para.startsWith('-'))
	.map(para => glob.sync(para))
	.flatten()
	.forEach(path => {
		let originalCode = fs.readFileSync(path, { encoding: 'utf-8' })
		let modifiedCode = null
		do {
			[originalCode, modifiedCode] = [modifiedCode, migrateReactClass(originalCode)]
		} while (originalCode !== modifiedCode);

		if (replaceOriginal) {
			fs.writeFileSync(path, modifiedCode)

		} else {
			console.log(modifiedCode)
		}
	})
	.value()
