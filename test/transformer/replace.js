'use strict'

const Lab = require('lab')
const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const beforeEach = lab.beforeEach
const afterEach = lab.afterEach
const Code = require('code')
const expect = Code.expect
const sinon = require('sinon')

const Transformer = require('../../lib/transformer')
const Replacer = require('../../lib/replacer')

describe('Transformer', () => {
  describe('replace', () => {
    var transformer

    beforeEach((done) => {
      transformer = new Transformer('/etc', [])
      sinon.stub(Replacer, 'findAndReplace').returns(Promise.resolve())
      sinon.stub(transformer.driver, 'resultsDiff').yieldsAsync(null, [
        'diff -u -r /foo /foo',
        'some diff info',
        'diff -u -r /bar /bar',
        'some more',
        'diff info'
      ].join('\n'))
      done()
    })

    afterEach((done) => {
      Replacer.findAndReplace.restore()
      done()
    })

    describe('warnings', () => {
      it('should add a warning and do nothing if not given a search pattern', (done) => {
        var rule = {}
        transformer.replace(rule, (err) => {
          if (err) { return done(err) }
          expect(transformer.warnings.length).to.equal(1)
          var warning = transformer.warnings[0]
          expect(warning.rule).to.equal(rule)
          expect(warning.message).to.equal('Search pattern not specified.')
          done()
        })
      })

      it('should add a warning and do nothing if no replacement was given', (done) => {
        var rule = { search: 'a' }
        transformer.replace(rule, (err) => {
          if (err) { return done(err) }
          expect(transformer.warnings.length).to.equal(1)
          var warning = transformer.warnings[0]
          expect(warning.rule).to.equal(rule)
          expect(warning.message).to.equal('Replacement not specified.')
          done()
        })
      })

      it('should add a warning if excludes is not an array', (done) => {
        var rule = { search: 'a', replace: 'b', exclude: 1776 }
        transformer.replace(rule, (err) => {
          expect(err).to.not.exist()
          expect(transformer.warnings.length).to.equal(1)
          var warning = transformer.warnings[0]
          expect(warning.rule).to.equal(rule)
          expect(warning.message)
            .to.equal('Excludes not supplied as an array, omitting.')
          done()
        })
      })
    }) // end 'warnings'

    describe('Replacer', () => {
      const workingPath = '/tmp/working/path'
      const resultsPath = '/tmp/results/path'
      const globalExcludes = ['.some.file', '.some.other.file']
      const rule = {
        search: 'search string yo',
        replace: 'replace string bro',
        exclude: ['one.txt', 'two.txt']
      }

      beforeEach((done) => {
        transformer.driver.workingPath = workingPath
        transformer.driver.resultsPath = resultsPath
        transformer._globalExcludes = globalExcludes
        sinon.stub(transformer.script, 'addRule')
        sinon.stub(transformer, 'setFileDiff')
        transformer.replace(rule, done)
      })

      it('should call the findAndReplace method', (done) => {
        expect(Replacer.findAndReplace.calledOnce).to.be.true()
        expect(Replacer.findAndReplace.firstCall.args).to.deep.equal([
          transformer.driver.workingPath,
          transformer.driver.resultsPath,
          globalExcludes.concat(rule.exclude),
          rule.search,
          rule.replace
        ])
        done()
      })

      it('should add the rule to the results', (done) => {
        expect(transformer.script.addRule.calledOnce).to.be.true()
        expect(transformer.script.addRule.calledWith(rule)).to.be.true()
        done()
      })

      it('should construct the results diff', (done) => {
        expect(transformer.setFileDiff.calledWith('/foo'), [
          'some diff info'
        ].join('\n')).to.be.true()
        expect(transformer.setFileDiff.calledWith('/foo'), [
          'some more',
          'diff info'
        ].join('\n')).to.be.true()
        done()
      })

      it('should yield an error if the results diff yields and error', (done) => {
        const error = new Error('no diffs woooooo')
        transformer.driver.resultsDiff.yields(error)
        transformer.replace(rule, (err) => {
          expect(err).to.equal(error)
          done()
        })
      })
    }) // end 'Replacer'
  }) // end 'replace'
}) // end 'Transformer'
