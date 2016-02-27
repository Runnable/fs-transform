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
var fs = require('./fixtures/fs-helper')
var Transformer = require('../index.js')
var async = require('async')
var childProcess = require('child_process')

var debug = require('debug')('fs-transform:test')

describe('functional', () => {
  beforeEach(fs.createTestDir)
  afterEach(fs.removeTestDir)

  describe('copy', () => {
    it('should copy a file', (done) => {
      var dest = 'A-copy'
      var rules = [{ action: 'copy', source: 'A', dest: dest }]
      Transformer.transform(fs.path, rules, (err) => {
        if (err) { return done(err) }
        expect(fs.exists(dest)).to.be.true()
        done()
      })
    })

    it('should copy many files', (done) => {
      var rules = [
        { action: 'copy', source: 'A', dest: 'A-copy' },
        { action: 'copy', source: 'B', dest: 'B-copy' },
        { action: 'copy', source: 'sub/C', dest: 'sub/C-copy' }
      ]
      Transformer.transform(fs.path, rules, (err) => {
        if (err) { return done(err) }
        rules.forEach((rule) => {
          expect(fs.exists(rule.dest)).to.be.true()
        })
        done()
      })
    })

    it('should overwrite destination files with warning', (done) => {
      var source = 'A'
      var dest = 'B'
      var rules = [{ action: 'copy', source: source, dest: dest }]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        expect(transformer.warnings).to.not.be.empty()
        fs.diff(source, dest, (err, diff) => {
          if (err) { return done(err) }
          expect(diff).to.be.empty()
          done()
        })
      })
    })
  }) // end 'copy'

  describe('rename', () => {
    it('should rename a file', (done) => {
      var source = 'A'
      var dest = 'A-rename'
      var rules = [
        { action: 'rename', source: source, dest: dest }
      ]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        expect(fs.exists(source)).to.be.false()
        expect(fs.exists(dest)).to.be.true()
        done()
      })
    })

    it('should rename many files', (done) => {
      var rules = [
        { action: 'rename', source: 'A', dest: 'A-rename' },
        { action: 'rename', source: 'B', dest: 'B-rename' },
        { action: 'rename', source: 'sub/C', dest: 'sub/C-rename' }
      ]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        rules.forEach((rule) => {
          expect(fs.exists(rule.source)).to.be.false()
          expect(fs.exists(rule.dest)).to.be.true()
        })
        done()
      })
    })

    it('should overwrite files with a warning', (done) => {
      var source = 'A'
      var dest = 'B'
      var rules = [{ action: 'rename', source: source, dest: dest }]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        expect(transformer.warnings).to.not.be.empty()
        expect(fs.exists(source)).to.be.false()
        expect(fs.exists(dest)).to.be.true()
        fs.mockDiff(dest, source, (err, diff) => {
          if (err) { return done(err) }
          expect(diff).to.be.empty()
          done()
        })
      })
    })
  }) // end 'rename'

  describe('replace', () => {
    it('should replace text in a file', (done) => {
      var search = 'File B is good'
      var replace = 'File B is great' // stay positive!
      var rules = [{ action: 'replace', search: search, replace: replace }]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        var bData = fs.read('B')
        var dData = fs.read('sub/subsub/D')
        expect(bData.match(search)).to.be.null()
        expect(bData.match(replace)).to.not.be.null()
        expect(dData.match(search)).to.be.null()
        expect(dData.match(replace)).to.not.be.null()
        done()
      })
    })

    it('should replace text with special characters', (done) => {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'replace', search: '"cool"', replace: '"neat"' },
        { action: 'replace', search: '/some/path/foo', replace: '/path/"bar"' }
      ]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }

        var dataC = fs.read('sub/C')
        expect(dataC.match(rules[0].search)).to.be.null()
        expect(dataC.match(rules[0].replace)).to.not.be.null()

        var dataD = fs.read('sub/subsub/D')
        expect(dataD.match(rules[1].search)).to.be.null()
        expect(dataD.match(rules[1].replace)).to.not.be.null()

        var dataA = fs.read('A')
        expect(dataA.match(rules[2].search)).to.be.null()
        expect(dataA.match(rules[2].replace)).to.not.be.null()

        done()
      })
    })

    it('should apply exclusions', (done) => {
      var rules = [{
        action: 'replace',
        search: 'Mew',
        replace: 'Woof',
        exclude: [
          'B',
          'not-there'
        ]
      }]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        var dataB = fs.read('B')
        var linesC = fs.read('sub/C').split('\n')
        expect(linesC[3]).to.equal('Woof')
        expect(linesC[4]).to.equal('Woof')
        expect(linesC[5]).to.equal('Woof')
        expect(linesC[7]).to.equal('Woof')
        expect(dataB.match('Woof')).to.be.null()
        done()
      })
    })

    it('should correctly set diffs by filename', (done) => {
      var rules = [
        { action: 'replace', search: 'Exampel', replace: 'Shamp' }
      ]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        let result = transformer.results[0]
        expect(result.diffs['/A'].startsWith('--- /A')).to.be.true()
        expect(result.diffs['/B'].startsWith('--- /B')).to.be.true()
        done()
      })
    })
  }) // end 'replace'

  describe('results', () => {
    it('should add a result for each valid rule', (done) => {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'replace', search: '"cool"', replace: '"neat"' },
        { action: 'replace', search: '/some/path/foo', replace: '/path/"bar"' },
        { action: 'copy', source: 'A', dest: 'A-copy' },
        { action: 'copy', source: 'B', dest: 'B-copy' },
        { action: 'copy', source: 'sub/C', dest: 'sub/C-copy' }
      ]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        expect(transformer.results.length).to.equal(rules.length)
        done()
      })
    })

    it('should provide the correct shell script', (done) => {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'copy', source: 'A', dest: 'A-copy' },
        { action: 'copy', source: 'B', dest: 'B-copy' },
        { action: 'rename', source: 'sub/C', dest: 'sub/C-rename' }
      ]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        var generatedScript = transformer.getScript()
        var script = fs.read('../script.sh')
        expect(generatedScript).to.equal(script)
        done()
      })
    })

    it('should provide a correct full diff', (done) => {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'replace', search: '"cool"', replace: '"neat"' },
        { action: 'replace', search: '/some/path/foo', replace: '/path/"bar"' }
      ]

      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        var expected = fs.read('../diff').split('\n').filter((line) => {
          return line.match(/^[+-][^+-]/)
        }).join('\n')
        var diff = transformer.getDiff().split('\n').filter((line) => {
          return line.match(/^[+-][^+-]/)
        }).join('\n')
        expect(diff).to.equal(expected)
        done()
      })
    })

    it('should use relative paths for full diffs', (done) => {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'replace', search: '"cool"', replace: '"neat"' },
        { action: 'replace', search: '/some/path/foo', replace: '/path/"bar"' }
      ]
      Transformer.transform(fs.path, rules, (err, transformer) => {
        if (err) { return done(err) }
        var diff = transformer.getDiff()
        expect(diff.indexOf(transformer.driver.working)).to.equal(-1)
        expect(diff.indexOf(transformer.driver.root)).to.equal(-1)
        done()
      })
    })
  }) // end 'results'

  describe('scripts', () => {
    const scriptPath = fs.mock + '.script'

    before(fs.createDotGit)
    after(fs.removeDotGit)

    beforeEach((done) => {
      childProcess.exec('cp -r ' + fs.mock + ' ' + scriptPath, done)
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
          childProcess.exec('bash script.sh', { cwd: scriptPath }, (err, output) => {
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

    it('should provide a shell script correctly transforms', (done) => {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'copy', source: 'A', dest: 'A-copy' },
        { action: 'copy', source: 'B', dest: 'B-copy' },
        { action: 'rename', source: 'sub/C', dest: 'sub/C-rename' }
      ]
      async.series([
        function runScript (next) {
          var command = 'bash ../script.sh'
          childProcess.exec(command, {cwd: scriptPath}, (err, data) => {
            next(err)
          })
        },

        function runTransforms (next) {
          Transformer.transform(fs.path, rules, next)
        },

        function getDiff (next) {
          var command = 'diff -r ' + fs.path + ' ' + scriptPath
          childProcess.exec(command, (err, diff) => {
            if (err && err.code > 1) { return next(err) }
            expect(diff).to.be.empty()
            next()
          })
        }
      ], done)
    })

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
  }) // end 'scripts'
}) // end 'functional'
