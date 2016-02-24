'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var before = lab.before
var beforeEach = lab.beforeEach
var Code = require('code')
var expect = Code.expect
var sinon = require('sinon')
var noop = require('101/noop')

var Transformer = require('../../lib/transformer')

describe('Transformer', () => {
  describe('transform', () => {
    it('should execute a run that is committed', (done) => {
      var transformer = new Transformer('/etc', [])
      var _execute = sinon.stub(transformer, '_execute')
      transformer.transform(noop)
      expect(_execute.calledWith(true, noop)).to.be.true()
      done()
    })
  }) // end 'transform'

  describe('dry', () => {
    it('should execute a dry run', (done) => {
      var transformer = new Transformer('/etc', [])
      var _execute = sinon.stub(transformer, '_execute')
      transformer.dry(noop)
      expect(_execute.calledWith(false, noop)).to.be.true()
      done()
    })
  }) // end 'dry'

  describe('_execute', () => {
    var transformer
    var driver

    beforeEach((done) => {
      transformer = new Transformer('/etc', [1, 2, 3])
      sinon.stub(transformer, 'applyRule').yieldsAsync()

      var driverMethods = [
        'createWorkingDirectory',
        'removeWorkingDirectory',
        'diff',
        'move',
        'removeRecursive',
        'workingDiff',
        'hasAllCommands',
        'hasCommand'
      ]

      driverMethods.forEach((method) => {
        sinon.stub(transformer.driver, method).yieldsAsync()
      })

      driver = transformer.driver
      driver.working = '/tmp/working'
      done()
    })

    it('should check for all required commands', (done) => {
      transformer._execute(false, (err) => {
        if (err) { return done(err) }
        expect(driver.hasAllCommands.calledOnce).to.be.true()
        done()
      })
    })

    it('should create a working directory', (done) => {
      transformer._execute(false, (err) => {
        if (err) { return done(err) }
        expect(driver.createWorkingDirectory.calledOnce).to.be.true()
        done()
      })
    })

    it('should apply all given transformer rules', (done) => {
      transformer._execute(false, (err) => {
        if (err) { return done(err) }
        var applyRule = transformer.applyRule
        expect(applyRule.callCount).to.equal(3)
        expect(applyRule.calledWith(1)).to.be.true()
        expect(applyRule.calledWith(2)).to.be.true()
        expect(applyRule.calledWith(3)).to.be.true()
        done()
      })
    })

    it('should get a full diff of the results', (done) => {
      var diff = 'the full diff'
      driver.workingDiff.yieldsAsync(null, diff)
      transformer._execute(false, (err) => {
        if (err) { return done(err) }
        expect(driver.workingDiff.callCount).to.equal(1)
        done()
      })
    })

    it('should handle errors when performing full diff', (done) => {
      var error = new Error('Diff error')
      driver.workingDiff.yieldsAsync(error)
      transformer._execute(false, (err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('should commit changes when instructed to do so', (done) => {
      transformer._execute(true, (err) => {
        if (err) { return done(err) }
        expect(driver.removeWorkingDirectory.callCount).to.equal(0)
        expect(driver.move.callCount).to.equal(2)
        expect(driver.move.calledWith(driver.working, driver.root))
          .to.be.true()
        done()
      })
    })

    it('should remove the working directory in dry mode', (done) => {
      transformer._execute(false, (err) => {
        if (err) { return done(err) }
        expect(driver.move.callCount).to.equal(0)
        expect(driver.removeWorkingDirectory.callCount).to.equal(1)
        done()
      })
    })

    it('should supply the transformer as the second parameter to the callback', (done) => {
      transformer._execute(false, (err, t) => {
        if (err) { return done(err) }
        expect(t).to.equal(transformer)
        done()
      })
    })
  }) // end '_execute'

  describe('applyRule', () => {
    var transformer

    before((done) => {
      transformer = new Transformer('/etc', [])
      transformer.setAction('custom', noop)
      done()
    })

    it('should yield an Error when given a null or undefined rule', (done) => {
      transformer.applyRule(null, (err) => {
        expect(err).to.exist()
        transformer.applyRule(undefined, (err) => {
          expect(err).to.exist()
          done()
        })
      })
    })

    it('should yield an Error when given a rule with an non-string action', (done) => {
      transformer.applyRule({ action: 10 }, (err) => {
        expect(err).to.exist()
        done()
      })
    })

    it('should yield an Error when an action handler could not be found', (done) => {
      transformer.applyRule({ action: 'undefined' }, (err) => {
        expect(err).to.exist()
        done()
      })
    })

    it('should call the `copy` handler given a "copy" rule action', (done) => {
      var rule = { action: 'copy' }
      var stub = sinon.stub(transformer._ruleActions, 'copy').yields()
      transformer.applyRule(rule, (err) => {
        if (err) { return done(err) }
        expect(stub.calledOnce).to.be.true()
        expect(stub.calledWith(rule)).to.be.true()
        transformer._ruleActions.copy.restore()
        done()
      })
    })

    it('should call the `rename` handler given a "rename" rule action', (done) => {
      var rule = { action: 'rename' }
      var spy = sinon.stub(transformer._ruleActions, 'rename').yields()
      transformer.applyRule(rule, (err) => {
        if (err) { return done(err) }
        expect(spy.calledOnce).to.be.true()
        expect(spy.calledWith(rule)).to.be.true()
        transformer._ruleActions.rename.restore()
        done()
      })
    })

    it('should call the `replace` handler given a "replace" rule action', (done) => {
      var rule = { action: 'replace' }
      var spy = sinon.stub(transformer._ruleActions, 'replace').yields()
      transformer.applyRule(rule, (err) => {
        if (err) { return done(err) }
        expect(spy.calledOnce).to.be.true()
        expect(spy.calledWith(rule)).to.be.true()
        transformer._ruleActions.replace.restore()
        done()
      })
    })

    it('should call the `exclude` handler given an "exclude" rule action', (done) => {
      var rule = { action: 'exclude' }
      var stub = sinon.stub(transformer._ruleActions, 'exclude').yields()
      transformer.applyRule(rule, (err) => {
        if (err) { return done(err) }
        expect(stub.calledOnce).to.be.true()
        expect(stub.calledWith(rule)).to.be.true()
        transformer._ruleActions.exclude.restore()
        done()
      })
    })

    it('should call a custom handler when given a custom rule action', (done) => {
      var rule = { action: 'custom' }
      var spy = sinon.stub(transformer._ruleActions, 'custom').yields()
      transformer.applyRule(rule, (err) => {
        if (err) { return done(err) }
        expect(spy.calledOnce).to.be.true()
        expect(spy.calledWith(rule)).to.be.true()
        transformer._ruleActions.custom.restore()
        done()
      })
    })
  }) // end 'applyRule'
})
