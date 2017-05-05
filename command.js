#!/usr/bin/env node

const fs = require('fs')
const babylon = require('babylon')
const glob = require('glob')
const _ = require('lodash')
const migrate = require('./migrate')

const replaceOriginal = process.argv.find(argx => argx === '-r' || argx === '--replace')

_.chain(process.argv)
	.slice(2)
	.reject(para => para.startsWith('-'))
	.map(para => glob.sync(para))
	.flatten()
	.forEach(path => {
		const originalCode = fs.readFileSync(path, { encoding: 'utf-8' })
		const modifiedCode = migrate(originalCode)

		if (replaceOriginal) {
			fs.writeFileSync(path, modifiedCode)

		} else {
			console.log(modifiedCode)
		}
	})
	.value()