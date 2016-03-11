'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()

const describe = lab.describe
const expect = require('code').expect
const it = lab.it
const path = require('path')

const Replacer = require('../../lib/replacer')

const fixturesPath = path.resolve(__dirname, '..', 'fixtures')
const readPath = path.resolve(fixturesPath, 'root')
const resultsPath = path.resolve(fixturesPath, 'results.tmp')

/**
 * Helper that strips absolute paths from files returned by the replacer.
 * @param {array} files Array of filenames
 * @param {string} pathToStrip The path to strip from the filenames
 * @return {array} The files stripped of the given path
 */
function stripPath (files, pathToStrip) {
  return files.map((file) => {
    return file.replace(pathToStrip, '')
  })
}

describe('functional', () => {
  describe('Replacer', () => {
    describe('getFiles', () => {
      it('should ignore excluded files', (done) => {
        const replacer = new Replacer(readPath, resultsPath, ['A', 'B'])
        replacer.getFiles().asCallback((err, files) => {
          expect(err).to.not.exist()
          expect(stripPath(files, readPath)).to.not.include(['/A', '/B'])
          done()
        })
      })

      it('should not search binary files', (done) => {
        const replacer = new Replacer(readPath, resultsPath, [])
        replacer.getFiles().asCallback((err, files) => {
          expect(err).to.not.exist()
          expect(stripPath(files, readPath)).to.not.include(['/binary.dat'])
          done()
        })
      })
    }) // end 'getFiles'
  }) // end 'Replacer'
}) // end 'functional'
