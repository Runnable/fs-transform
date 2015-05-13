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
  describe('rename', function() {
    var transformer;
    beforeEach(function (done) {
      transformer = new Transformer('/etc', []);
      sinon.stub(transformer.driver, 'move').yields();
      done();
    });

    afterEach(function (done) {
      transformer.driver.move.restore();
      done();
    });

    it('should add a warning and skip if the rule was not given with a `source`', function(done) {
      var rule = { action: 'rename', dest: 'bar' };
      transformer.rename(rule, function (err) {
        if (err) { return done(err); }
        expect(transformer.warnings.length).to.equal(1);
        var warning = transformer.warnings[0];
        expect(warning.rule).to.equal(rule);
        expect(warning.message).to.equal('Missing source file.');
        expect(transformer.driver.move.callCount).to.equal(0);
        done();
      });
    });

    it('should add a warning and skip if the rule was not given with a `dest`', function(done) {
      var rule = { action: 'rename', source: 'foo' };
      transformer.rename(rule, function (err) {
        if (err) { return done(err); }
        expect(transformer.warnings.length).to.equal(1);
        var warning = transformer.warnings[0];
        expect(warning.rule).to.equal(rule);
        expect(warning.message).to.equal('Missing destination file.');
        expect(transformer.driver.move.callCount).to.equal(0);
        done();
      });
    });

    it('should add a warning and skip if the source file does not exist', function(done) {
      var rule = { action: 'rename', source: 'foo', dest: 'bar'};
      sinon.stub(transformer.driver, 'exists')
        .withArgs('foo').returns(false);

      transformer.rename(rule, function (err) {
        if (err) { return done(err); }
        expect(transformer.warnings.length).to.equal(1);
        var warning = transformer.warnings[0];
        expect(warning.rule).to.equal(rule);
        expect(warning.message).to.equal('Source file does not exist.');
        expect(transformer.driver.move.callCount).to.equal(0);
        done();
      });
    });

    it('should use the driver move method', function (done) {
      var rule = { action: 'rename', source: 'foo', dest: 'bar'};

      sinon.stub(transformer.driver, 'exists')
        .withArgs('foo').returns(true)
        .withArgs('bar').returns(false);

      transformer.rename(rule, function (err) {
        if (err) { return done(err); }
        var stub = transformer.driver.move;
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(rule.source, rule.dest)).to.be.true();
        transformer.driver.exists.restore();
        done();
      });
    });

    it('it should add a warning if overwriting the destination file', function (done) {
      var rule = { action: 'rename', source: 'foo', dest: 'bar'};
      sinon.stub(transformer.driver, 'exists').returns(true);
      transformer.rename(rule, function (err) {
        if (err) { return done(err); }
        var stub = transformer.driver.move;
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(rule.source, rule.dest)).to.be.true();
        expect(transformer.warnings.length).to.equal(1);
        var warning = transformer.warnings[0];
        expect(warning.rule).to.equal(rule);
        expect(warning.message).to.equal('Overwrites destination file.');
        transformer.driver.exists.restore();
        done();
      });
    });

    it('should handle driver move errors', function(done) {
      var error = new Error('Yes? no? maybe so... ugbndkslnbfdklsn');
      transformer.driver.move.yieldsAsync(error);

      sinon.stub(transformer.driver, 'exists')
        .withArgs('foo').returns(true)
        .withArgs('bar').returns(false);

      var rule = { action: 'rename', source: 'foo', dest: 'bar'};
      transformer.rename(rule, function (err) {
        expect(err).to.equal(error);
        transformer.driver.exists.restore();
        done();
      });
    });
  }); // end 'rename'
});
