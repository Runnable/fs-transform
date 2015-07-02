var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var Transformer = require('../../../lib/transformer');

describe('Transformer', function() {
  describe('interface', function() {
    it('should expose the Transformer class', function (done) {
      expect(Transformer).to.exist();
      expect(typeof Transformer).to.equal('function');
      done();
    });

    it('should expose the `.transform` method', function(done) {
      expect(Transformer.transform).to.exist();
      expect(typeof Transformer.transform).to.equal('function');
      done();
    });
  }); // end 'interface'

  describe('transform', function() {
    it('should catch rules errors during instantiation', function (done) {
      Transformer.transform('/tmp', 23, function (err) {
        expect(err).to.exist();
        done();
      });
    });

    it('should catch JSON parse errors during instantiation', function (done) {
      Transformer.transform('/tmp', '{sou[p]', function (err) {
        expect(err).to.exist();
        done();
      });
    });
  }); // end 'transform'

  describe('dry', function () {
    it('should catch rules errors during instantiation', function (done) {
      Transformer.dry('/tmp', 23, function (err) {
        expect(err).to.exist();
        done();
      });
    });

    it('should catch JSON parse errors during instantiation', function (done) {
      Transformer.dry('/tmp', '{sou[p]', function (err) {
        expect(err).to.exist();
        done();
      });
    });
  })
});
