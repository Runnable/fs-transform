'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var Code = require('code')
var expect = Code.expect
var sinon = require('sinon')

var Transformer = require('../../../lib/transformer')

describe('Transformer', () => {
  describe('rename', () => {
    var transformer
    beforeEach((done) => {
      transformer = new Transformer('/etc', [])
      sinon.stub(transformer.driver, 'move').yields()
      done()
    })

    afterEach((done) => {
      transformer.driver.move.restore()
      done()
    })

    it('should add a warning and skip if the rule was not given with a `source`', (done) => {
      var rule = { action: 'rename', dest: 'bar' }
      transformer.rename(rule, (err) => {
        if (err) { return done(err) }
        expect(transformer.warnings.length).to.equal(1)
        var warning = transformer.warnings[0]
        expect(warning.rule).to.equal(rule)
        expect(warning.message).to.equal('Missing source file.')
        expect(transformer.driver.move.callCount).to.equal(0)
        done()
      })
    })

    it('should add a warning and skip if the rule was not given with a `dest`', (done) => {
      var rule = { action: 'rename', source: 'foo' }
      transformer.rename(rule, (err) => {
        if (err) { return done(err) }
        expect(transformer.warnings.length).to.equal(1)
        var warning = transformer.warnings[0]
        expect(warning.rule).to.equal(rule)
        expect(warning.message).to.equal('Missing destination file.')
        expect(transformer.driver.move.callCount).to.equal(0)
        done()
      })
    })

    it('should add a warning and skip if the source file does not exist', (done) => {
      var rule = { action: 'rename', source: 'foo', dest: 'bar' }
      sinon.stub(transformer.driver, 'exists')
        .withArgs('foo').returns(false)

      transformer.rename(rule, (err) => {
        if (err) { return done(err) }
        expect(transformer.warnings.length).to.equal(1)
        var warning = transformer.warnings[0]
        expect(warning.rule).to.equal(rule)
        expect(warning.message).to.equal('Source file does not exist.')
        expect(transformer.driver.move.callCount).to.equal(0)
        done()
      })
    })

    it('should use the driver move method', (done) => {
      var rule = { action: 'rename', source: 'foo', dest: 'bar' }

      sinon.stub(transformer.driver, 'exists')
        .withArgs('foo').returns(true)
        .withArgs('bar').returns(false)

      transformer.rename(rule, (err) => {
        if (err) { return done(err) }
        var stub = transformer.driver.move
        expect(stub.calledOnce).to.be.true()
        expect(stub.calledWith(rule.source, rule.dest)).to.be.true()
        transformer.driver.exists.restore()
        done()
      })
    })

    it('it should add a warning if overwriting the destination file', (done) => {
      var rule = { action: 'rename', source: 'foo', dest: 'bar' }
      sinon.stub(transformer.driver, 'exists').returns(true)
      transformer.rename(rule, (err) => {
        if (err) { return done(err) }
        var stub = transformer.driver.move
        expect(stub.calledOnce).to.be.true()
        expect(stub.calledWith(rule.source, rule.dest)).to.be.true()
        expect(transformer.warnings.length).to.equal(1)
        var warning = transformer.warnings[0]
        expect(warning.rule).to.equal(rule)
        expect(warning.message).to.equal('Overwrites destination file.')
        transformer.driver.exists.restore()
        done()
      })
    })

    it('should handle driver move errors', (done) => {
      var error = new Error('Yes? no? maybe so... ugbndkslnbfdklsn')
      transformer.driver.move.yieldsAsync(error)

      sinon.stub(transformer.driver, 'exists')
        .withArgs('foo').returns(true)
        .withArgs('bar').returns(false)

      var rule = { action: 'rename', source: 'foo', dest: 'bar' }
      transformer.rename(rule, (err) => {
        expect(err).to.equal(error)
        transformer.driver.exists.restore()
        done()
      })
    })
  }) // end 'rename'
})
