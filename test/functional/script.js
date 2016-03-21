'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var before = lab.before
var beforeEach = lab.beforeEach
var after = lab.after
var afterEach = lab.afterEach
var Code = require('code')
var expect = Code.expect
var fs = require('../fixtures/fs-helper')
var async = require('async')
var childProcess = require('child_process')

var debug = require('debug')('fs-transform:test')

var Transformer = require('../../index')

describe('functional', () => {
  describe('script', () => {
    const scriptPath = fs.mock + '.script'

    before(fs.createDotGit)
    after(fs.removeDotGit)

    beforeEach(fs.createTestDir)
    afterEach(fs.removeTestDir)

    beforeEach((done) => {
      childProcess.execFile('cp', ['-r', fs.mock, scriptPath], done)
    })

    afterEach((done) => {
      var command = 'rm -rf ' + scriptPath
      childProcess.exec(command, {cwd: 'test/fixtures/'}, done)
    })

    function compareScript (rules, done) {
      var script
      async.series([
        function generateScript (next) {
          Transformer.transform(fs.path, rules, (err, transformer) => {
            if (err) { return next(err) }
            script = transformer.getScript()
            debug(script)
            fs.writeFile(scriptPath + '/script.sh', script, next)
          })
        },
        function runScript (next) {
          const opts = { cwd: scriptPath }
          childProcess.exec('bash script.sh', opts, (err, output) => {
            debug(output)
            next(err)
          })
        },
        function removeScript (next) {
          childProcess.exec('rm -f ' + scriptPath + '/script.sh', next)
        },
        function getDiff (next) {
          var command = 'diff -r ' + fs.path + ' ' + scriptPath
          childProcess.exec(command, (err, diff) => {
            if (err && err.code > 1) { return next(err) }
            debug(diff)
            expect(diff).to.be.empty()
            next()
          })
        }
      ], done)
    }

    it('should correctly handle global excludes', (done) => {
      compareScript([
        { action: 'exclude', files: ['sub/C', 'A'] },
        { action: 'replace', search: 'Mew', replace: 'Woof' }
      ], done)
    })

    it('should handle local replace excludes', (done) => {
      compareScript([
        {
          action: 'replace',
          search: 'Mew',
          replace: 'Bark',
          exclude: ['sub/C']
        }
      ], done)
    })

    it('should always exclude .git files', (done) => {
      compareScript([
        { action: 'replace', search: 'only_in_gitfile', replace: 'yus' }
      ], done)
    })

    it('should handle single quotes', (done) => {
      compareScript([
        {
          action: 'replace',
          search: '\'username\' => \'\'',
          replace: '\'username\' => \'wowzers\''
        }
      ], done)
    })

    it('should handle backslashes', (done) => {
      compareScript([
        { action: 'replace', search: '\\sum', replace: '\\prod' }
      ], done)
    })

    it('should handle multiple transforms', (done) => {
      compareScript([
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'copy', source: 'A', dest: 'A-copy' },
        { action: 'copy', source: 'B', dest: 'B-copy' },
        { action: 'rename', source: 'sub/C', dest: 'sub/C-rename' }
      ], done)
    })
  }) // end 'script'
}) // end 'functional'
