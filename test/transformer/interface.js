'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var Code = require('code')
var expect = Code.expect
var Transformer = require('../../lib/transformer')

describe('Transformer', () => {
  describe('interface', () => {
    it('should expose the Transformer class', (done) => {
      expect(Transformer).to.exist()
      expect(typeof Transformer).to.equal('function')
      done()
    })

    it('should expose the `.transform` method', (done) => {
      expect(Transformer.transform).to.exist()
      expect(typeof Transformer.transform).to.equal('function')
      done()
    })
  }) // end 'interface'

  describe('transform', () => {
    it('should catch rules errors during instantiation', (done) => {
      Transformer.transform('/tmp', 23, (err) => {
        expect(err).to.exist()
        done()
      })
    })

    it('should catch JSON parse errors during instantiation', (done) => {
      Transformer.transform('/tmp', '{sou[p]', (err) => {
        expect(err).to.exist()
        done()
      })
    })
  }) // end 'transform'

  describe('dry', () => {
    it('should catch rules errors during instantiation', (done) => {
      Transformer.dry('/tmp', 23, (err) => {
        expect(err).to.exist()
        done()
      })
    })

    it('should catch JSON parse errors during instantiation', (done) => {
      Transformer.dry('/tmp', '{sou[p]', (err) => {
        expect(err).to.exist()
        done()
      })
    })
  })
})
