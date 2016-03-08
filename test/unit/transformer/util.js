'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var Code = require('code')
var expect = Code.expect
var sinon = require('sinon')
var noop = require('101/noop')

var Transformer = require('../../../lib/transformer')
var Warning = require('../../../lib/warning')

describe('Transformer', () => {
  describe('pushResult', () => {
    it('should push a new result to the result list', (done) => {
      var transformer = new Transformer('/', [])
      var rule = { action: 'copy', source: 'a', dest: 'b' }
      transformer.pushResult(rule)
      expect(transformer.results).to.not.be.empty()
      var result = transformer.results[0]
      expect(result.rule).to.equal(rule)
      expect(result.warnings).to.be.an.array()
      expect(result.warnings).to.be.empty()
      expect(result.nameChanges).to.be.an.array()
      expect(result.nameChanges).to.be.empty()
      expect(result.diffs).to.be.an.object()
      done()
    })

    it('should set the `currentResult` instance variable', (done) => {
      var transformer = new Transformer('/', [])
      var rule = { action: 'copy', source: 'a', dest: 'b' }
      transformer.pushResult(rule)
      expect(transformer.results).to.not.be.empty()
      expect(transformer.currentResult).to.not.be.null()
      expect(transformer.results[0]).to.equal(transformer.currentResult)
      done()
    })
  }) // end 'pushResult'

  describe('addWarning', () => {
    it('should add a warning to master list', (done) => {
      var object = { name: 'woot' }
      var message = 'Very interesting'
      var transformer = new Transformer('/', [])
      transformer.addWarning(object, message)
      expect(transformer.warnings).to.not.be.empty()
      var warning = transformer.warnings[0]
      expect(warning).instanceof(Warning)
      expect(warning.rule).to.equal(object)
      expect(warning.message).to.equal(message)
      done()
    })

    it('should add the warning to the current result', (done) => {
      var transformer = new Transformer('/', [])
      var result = transformer.pushResult({ action: 'copy' })
      transformer.addWarning({ name: 'woot' }, 'Very interesting')
      var warning = transformer.warnings[0]
      expect(result.warnings).to.not.be.empty()
      expect(result.warnings[0]).to.equal(warning)
      done()
    })
  }) // end 'addWarning'

  describe('addNameChange', () => {
    it('should add the name change to the master list', (done) => {
      var from = 'a'
      var to = 'b'
      var transformer = new Transformer('/', [])
      transformer.addNameChange(from, to)
      expect(transformer.nameChanges).to.not.be.empty()
      var change = transformer.nameChanges[0]
      expect(change.from).to.equal(from)
      expect(change.to).to.equal(to)
      done()
    })

    it('should add the name change to the current result', (done) => {
      var transformer = new Transformer('/', [])
      var result = transformer.pushResult({ action: 'rename' })
      transformer.addNameChange('a', 'b')
      expect(transformer.nameChanges).to.not.be.empty()
      var change = transformer.nameChanges[0]
      expect(result.nameChanges).to.not.be.empty()
      expect(result.nameChanges[0]).to.equal(change)
      done()
    })
  }) // end 'addNameChange'

  describe('setFileDiff', () => {
    it('should set the file diff on the current result', (done) => {
      var transformer = new Transformer('/etc', [])
      var result = transformer.pushResult({ action: 'replace' })
      var filename = '/etc/file1.txt'
      var relativePath = transformer.driver.stripAbsolutePaths(filename)
      var diff = 'THIS IS SPARTA'
      transformer.setFileDiff(filename, diff)
      expect(result.diffs[relativePath]).to.be.a.string()
      expect(result.diffs[relativePath]).to.equal(diff)
      done()
    })

    it('should set multiple diffs to the current result', (done) => {
      var transformer = new Transformer('/etc', [])
      var result = transformer.pushResult({ action: 'replace' })
      var filename = '/etc/file1.txt'
      var relativePath = transformer.driver.stripAbsolutePaths(filename)
      var diff = 'THIS IS SPARTA'
      var filename2 = '/etc/file2.txt'
      var relativePath2 = transformer.driver.stripAbsolutePaths(filename2)
      var diff2 = 'THIS IS ARTASPAY'
      transformer.setFileDiff(filename, diff)
      transformer.setFileDiff(filename2, diff2)
      expect(result.diffs[relativePath]).to.be.a.string()
      expect(result.diffs[relativePath]).to.equal(diff)
      expect(result.diffs[relativePath2]).to.be.a.string()
      expect(result.diffs[relativePath2]).to.equal(diff2)
      done()
    })
  }) // end 'setFileDiff'

  describe('setAction & getAction', () => {
    it('should set rule action handlers', (done) => {
      var transformer = new Transformer('/etc', [])
      transformer.setAction('foo', noop)
      expect(transformer.getAction('foo')).to.exist()
      done()
    })

    it('should execute the given closure from the context of the transformer', (done) => {
      var transformer = new Transformer('/etc', [])
      var spy = sinon.spy()
      transformer.setAction('foo', spy)
      transformer.getAction('foo')('a', 'b', 'c')
      expect(spy.calledOnce).to.be.true()
      expect(spy.calledWith('a', 'b', 'c')).to.be.true()
      expect(spy.calledOn(transformer)).to.be.true()
      done()
    })
  }) // end 'setAction & getAction'

  describe('getScript', () => {
    it('should use the ScriptGenerator class to generate scripts', (done) => {
      var transformer = new Transformer('/etc', [])
      var result = 'anbksnklnsskqlnskal2202'
      sinon.stub(transformer.script, 'generate').returns(result)
      expect(transformer.getScript()).to.equal(result)
      expect(transformer.script.generate.calledOnce).to.be.true()
      done()
    })
  }) // end 'getScript'
})
