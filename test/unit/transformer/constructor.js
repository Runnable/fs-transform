'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var Code = require('code')
var expect = Code.expect
var Transformer = require('../../../lib/transformer')
var ScriptGenerator = require('../../../lib/script-generator')

describe('Transformer', () => {
  describe('constructor', () => {
    it('should throw a SyntaxError when given JSON', (done) => {
      expect(() => {
        var t = new Transformer('/tmp', 'Ps-3:44}')
        done(new Error(t))
      }).to.throw(SyntaxError)
      done()
    })

    it('should throw an Error if rules are not an Array', (done) => {
      expect(() => {
        var t = new Transformer('/tmp', 1239)
        done(new Error(t))
      }).to.throw(Error, 'Rules must be an array.')
      done()
    })

    it('should throw an Error if parsed JSON is not an Array', (done) => {
      expect(() => {
        var t = new Transformer('/tmp', '1337')
        done(new Error(t))
      }).to.throw(Error, 'Rules must be an array.')
      done()
    })

    it('should use a driver with the appropriate root directory', (done) => {
      var transformer = new Transformer('/etc', [])
      expect(transformer.driver.root).to.equal('/etc')
      done()
    })

    it('should keep a list of warnings', (done) => {
      var transformer = new Transformer('/etc', [])
      expect(transformer.warnings).to.be.an.array()
      done()
    })

    it('should keep a list of results', (done) => {
      var transformer = new Transformer('/etc', [])
      expect(transformer.results).to.be.an.array()
      done()
    })

    it('should have a shell script generator', (done) => {
      var transformer = new Transformer('/etc', [])
      expect(transformer.script).instanceof(ScriptGenerator)
      done()
    })

    it('should keep a list of name changes', (done) => {
      var transformer = new Transformer('/etc', [])
      expect(transformer.nameChanges).to.be.an.array()
      done()
    })

    it('should keep a list of global file excludes', (done) => {
      var transformer = new Transformer('/etc', [])
      expect(transformer._globalExcludes).to.be.an.array()
      done()
    })
  }) // end 'constructor'
})
