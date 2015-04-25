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
var sinon = require('sinon');
var childProcess = require('child_process');
var createCount = require('callback-count');
var noop = require('101/noop');
var async = require('async');

var Transformer = require('../../lib/transformer');

describe('Transformer', function() {
  describe('execute', function () {
    it('should apply all given transformer rules', function(done) {
      var transformer = new Transformer('/etc', [1, 2, 3]);
      var stub = sinon.stub(transformer, 'applyRule').yields();
      transformer.execute(function (err) {
        if (err) { return done(err); }
        expect(stub.callCount).to.equal(3);
        expect(stub.calledWith(1)).to.be.true();
        expect(stub.calledWith(2)).to.be.true();
        expect(stub.calledWith(3)).to.be.true();
        transformer.applyRule.restore();
        done();
      })
    });

    it('should supply the transformer as the second parameter to the callback', function (done) {
      var transformer = new Transformer('/etc', []);
      transformer.execute(function (err, t) {
        if (err) { return done(err); }
        expect(t).to.equal(transformer);
        done();
      });
    });
  }); // end 'execute'

  describe('applyRule', function() {
    var transformer;

    before(function (done) {
      transformer = new Transformer('/etc', []);
      transformer.setAction('custom', noop);
      done();
    });

    it('should yield an Error when given a null or undefined rule', function(done) {
      var count = createCount(2, done);
      transformer.applyRule(null, function (err) {
        expect(err).to.exist();
        count.next();
      });
      transformer.applyRule(undefined, function (err) {
        expect(err).to.exist();
        count.next();
      });
    });

    it('should yield an Error when given a rule with an non-string action', function (done) {
      transformer.applyRule({ action: 10 }, function (err) {
        expect(err).to.exist();
        done();
      });
    });

    it('should yield an Error when an action handler could not be found', function(done) {
      transformer.applyRule({ action: 'undefined' }, function (err) {
        expect(err).to.exist();
        done();
      });
    });

    it('should call the `copy` handler given a "copy" rule action', function (done) {
      var rule = { action: 'copy' };
      var stub = sinon.stub(transformer._ruleActions, 'copy').yields();
      transformer.applyRule(rule, function (err) {
        if (err) { return done(err); }
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(rule)).to.be.true();
        transformer._ruleActions.copy.restore();
        done();
      });
    });

    it('should call the `rename` handler given a "rename" rule action', function (done) {
      var rule = { action: 'rename' };
      var spy = sinon.stub(transformer._ruleActions, 'rename').yields();
      transformer.applyRule(rule, function (err) {
        if (err) { return done(err); }
        expect(spy.calledOnce).to.be.true();
        expect(spy.calledWith(rule)).to.be.true();
        transformer._ruleActions.rename.restore();
        done();
      });
    });

    it('should call the `replace` handler given a "replace" rule action', function (done) {
      var rule = { action: 'replace' };
      var spy = sinon.stub(transformer._ruleActions, 'replace').yields();
      transformer.applyRule(rule, function (err) {
        if (err) { return done(err); }
        expect(spy.calledOnce).to.be.true();
        expect(spy.calledWith(rule)).to.be.true();
        transformer._ruleActions.replace.restore();
        done();
      });
    });

    it('should call a custom handler when given a custom rule action', function (done) {
      var rule = { action: 'custom' };
      var spy = sinon.stub(transformer._ruleActions, 'custom').yields();
      transformer.applyRule(rule, function (err) {
        if (err) { return done(err); }
        expect(spy.calledOnce).to.be.true();
        expect(spy.calledWith(rule)).to.be.true();
        transformer._ruleActions.custom.restore();
        done();
      });
    });
  }); // end 'applyRule'
});
