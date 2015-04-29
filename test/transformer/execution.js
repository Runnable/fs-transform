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
  describe('transform', function() {
    it('should execute a run that is committed', function(done) {
      var transformer = new Transformer('/etc', []);
      var _execute = sinon.stub(transformer, '_execute');
      transformer.transform(noop);
      expect(_execute.calledWith(true, noop)).to.be.true();
      done();
    });
  }); // end 'transform'

  describe('dry', function() {
    it('should execute a dry run', function(done) {
      var transformer = new Transformer('/etc', []);
      var _execute = sinon.stub(transformer, '_execute');
      transformer.dry(noop);
      expect(_execute.calledWith(false, noop)).to.be.true();
      done();
    });
  }); // end 'dry'

  describe('_execute', function () {
    var transformer;
    var driver;

    beforeEach(function (done) {
      transformer = new Transformer('/etc', [1, 2, 3]);
      sinon.stub(transformer, 'applyRule').yieldsAsync();

      var driverMethods = [
        'createWorkingDirectory',
        'removeWorkingDirectory',
        'diff',
        'move',
        'removeRecursive',
        'workingDiff',
        'hasAllCommands',
        'hasCommand'
      ];

      driverMethods.forEach(function (method) {
        sinon.stub(transformer.driver, method).yieldsAsync();
      });

      driver = transformer.driver;
      driver.working = '/tmp/working';
      done();
    });

    it('should check for all required commands', function (done) {
      transformer._execute(false, function (err) {
        if (err) { return done(err); }
        expect(driver.hasAllCommands.calledOnce).to.be.true();
        done();
      });
    });

    it('should create a working directory', function(done) {
      transformer._execute(false, function (err) {
        if (err) { return done(err); }
        expect(driver.createWorkingDirectory.calledOnce).to.be.true();
        done();
      });
    });

    it('should apply all given transformer rules', function(done) {
      transformer._execute(false, function (err) {
        if (err) { return done(err); }
        var applyRule = transformer.applyRule;
        expect(applyRule.callCount).to.equal(3);
        expect(applyRule.calledWith(1)).to.be.true();
        expect(applyRule.calledWith(2)).to.be.true();
        expect(applyRule.calledWith(3)).to.be.true();
        done();
      });
    });

    it('should get a full diff of the results', function(done) {
      var diff = 'the full diff';
      driver.workingDiff.yieldsAsync(null, diff);
      transformer._execute(false, function (err) {
        if (err) { return done(err); }
        expect(driver.workingDiff.callCount).to.equal(1);
        done();
      });
    });

    it('should handle errors when performing full diff', function (done) {
      var error = new Error('Diff error');
      driver.workingDiff.yieldsAsync(error);
      transformer._execute(false, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });

    it('should commit changes when instructed to do so', function(done) {
      transformer._execute(true, function (err) {
        if (err) { return done(err); }
        expect(driver.removeWorkingDirectory.callCount).to.equal(0);
        expect(driver.move.callCount).to.equal(2);
        expect(driver.move.calledWith(driver.working, driver.root))
          .to.be.true();
        done();
      });
    });

    it('should remove the working directory in dry mode', function(done) {
      transformer._execute(false, function (err) {
        if (err) { return done(err); }
        expect(driver.move.callCount).to.equal(0);
        expect(driver.removeWorkingDirectory.callCount).to.equal(1);
        done();
      });
    });

    it('should supply the transformer as the second parameter to the callback', function (done) {
      transformer._execute(false, function (err, t) {
        if (err) { return done(err); }
        expect(t).to.equal(transformer);
        done();
      });
    });
  }); // end '_execute'

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
