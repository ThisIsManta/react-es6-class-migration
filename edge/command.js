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
		// Note that "_" in "._tsx" is to prevent TypeScript compilation error due to invalid TSX file content
		const fileType = /\._?tsx$/.test(fp.extname(path)) ? 'tsx' : 'jsx'

		const originalCode = fs.readFileSync(path, { encoding: 'utf-8' })
		let modifiedCode = migrateReactClass(originalCode, fileType)

		if (fileType === 'tsx') {
			modifiedCode = migrateTypeDefinition(modifiedCode)
		}

		if (replaceOriginal) {
			fs.writeFileSync(path, modifiedCode)

		} else {
			console.log(modifiedCode)
		}
	})
	.value()
