'use strict';

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
var Transformer = require('../../lib/transformer');
var ScriptGenerator = require('../../lib/script-generator');

describe('Transformer', function() {
  describe('constructor', function() {
    it('should throw a SyntaxError when given JSON', function (done) {
      expect(function() {
        new Transformer('/tmp', 'Ps-3:44}');
      }).to.throw(SyntaxError);
      done();
    });

    it('should throw an Error if rules are not an Array', function (done) {
      expect(function () {
        new Transformer('/tmp', 1239);
      }).to.throw(Error, 'Rules must be an array.');
      done();
    });

    it('should throw an Error if parsed JSON is not an Array', function (done) {
      expect(function () {
        new Transformer('/tmp', '1337');
      }).to.throw(Error, 'Rules must be an array.');
      done();
    });

    it('should use a driver with the appropriate root directory', function (done) {
      var transformer = new Transformer('/etc', []);
      expect(transformer.driver.root).to.equal('/etc');
      done();
    });

    it('should keep a list of warnings', function(done) {
      var transformer = new Transformer('/etc', []);
      expect(transformer.warnings).to.be.an.array();
      done();
    });

    it('should keep a list of results', function(done) {
      var transformer = new Transformer('/etc', []);
      expect(transformer.results).to.be.an.array();
      done();
    });

    it('should have a shell script generator', function(done) {
      var transformer = new Transformer('/etc', []);
      expect(transformer.scriptGenerator).instanceof(ScriptGenerator);
      done();
    });

    it('should keep a list of name changes', function(done) {
      var transformer = new Transformer('/etc', []);
      expect(transformer.nameChanges).to.be.an.array();
      done();
    });
  }); // end 'constructor'
});
