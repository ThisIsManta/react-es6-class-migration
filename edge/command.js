#!/usr/bin/env node

const fs = require('fs')
const glob = require('glob')
const _ = require('lodash')
const migrateReactClass = require('./migrateReactClass')
const migrateTypeDefinition = require('./migrateTypeDefinition')

const replaceOriginal = process.argv.find(argx => argx === '-r' || argx === '--replace')

_.chain(process.argv)
	.slice(2)
	.reject(para => para.startsWith('-'))
	.map(para => glob.sync(para))
	.flatten()
	.forEach(path => {
		const originalCode = fs.readFileSync(path, { encoding: 'utf-8' })
		let modifiedCode = migrateReactClass(originalCode)

		if (/\.tsx$/.test(path)) {
			modifiedCode = migrateTypeDefinition(modifiedCode)
		}

		if (replaceOriginal) {
			fs.writeFileSync(path, modifiedCode)

		} else {
			console.log(modifiedCode)
		}
	})
	.value()
