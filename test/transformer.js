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

var Transformer = require('../lib/transformer');
var FsDriver = require('../lib/fs-driver');

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
  }); // end 'constructor'

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

  describe('setAction & getAction', function() {
    it('should set rule action handlers', function (done) {
      var transformer = new Transformer('/etc', []);
      transformer.setAction('foo', noop);
      expect(transformer.getAction('foo')).to.exist();
      done();
    });

    it('should execute the given closure from the context of the transformer', function (done) {
      var transformer = new Transformer('/etc', []);
      var spy = sinon.spy();
      transformer.setAction('foo', spy);
      transformer.getAction('foo')('a', 'b', 'c');
      expect(spy.calledOnce).to.be.true();
      expect(spy.calledWith('a', 'b', 'c'));
      expect(spy.calledOn(transformer));
      done();
    });
  }); // end 'setAction & getAction'

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

  describe('copy', function() {
    var transformer;
    beforeEach(function (done) {
      transformer = new Transformer('/etc', []);
      sinon.stub(transformer.driver, 'copy').yields();
      done();
    });

    afterEach(function (done) {
      transformer.driver.copy.restore();
      done();
    });

    it('should add a warning and skip if the rule was not given with a `source`', function(done) {
      var rule = { action: 'copy', dest: 'bar' };
      transformer.copy(rule, function (err) {
        if (err) { return done(err); }
        expect(transformer.warnings.length).to.equal(1);
        var warning = transformer.warnings[0];
        expect(warning.rule).to.equal(rule);
        expect(warning.message).to.equal('Missing source file.');
        expect(transformer.driver.copy.callCount).to.equal(0);
        done();
      });
    });

    it('should add a warning and skip if the rule was not given with a `dest`', function(done) {
      var rule = { action: 'copy', source: 'foo' };
      transformer.copy(rule, function (err) {
        if (err) { return done(err); }
        expect(transformer.warnings.length).to.equal(1);
        var warning = transformer.warnings[0];
        expect(warning.rule).to.equal(rule);
        expect(warning.message).to.equal('Missing destination file.');
        expect(transformer.driver.copy.callCount).to.equal(0);
        done();
      });
    });

    it('should add a warning and skip if the source file does not exist', function(done) {
      var rule = { action: 'copy', source: 'foo', dest: 'bar'};
      sinon.stub(transformer.driver, 'exists')
        .withArgs('foo').returns(false);

      transformer.copy(rule, function (err) {
        if (err) { return done(err); }
        expect(transformer.warnings.length).to.equal(1);
        var warning = transformer.warnings[0];
        expect(warning.rule).to.equal(rule);
        expect(warning.message).to.equal('Source file does not exist.');
        expect(transformer.driver.copy.callCount).to.equal(0);
        done();
      });
    });

    it('should use the driver copy method', function (done) {
      var rule = { action: 'copy', source: 'foo', dest: 'bar'};

      sinon.stub(transformer.driver, 'exists')
        .withArgs('foo').returns(true)
        .withArgs('bar').returns(false);

      transformer.copy(rule, function (err) {
        if (err) { return done(err); }
        var stub = transformer.driver.copy;
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(rule.source, rule.dest)).to.be.true();
        transformer.driver.exists.restore();
        done();
      });
    });

    it('it should add a warning if overwriting the destination file', function (done) {
      var rule = { action: 'copy', source: 'foo', dest: 'bar'};
      sinon.stub(transformer.driver, 'exists').returns(true);
      transformer.copy(rule, function (err) {
        if (err) { return done(err); }
        var stub = transformer.driver.copy;
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith(rule.source, rule.dest)).to.be.true();
        expect(transformer.warnings.length).to.equal(1);
        var warning = transformer.warnings[0];
        expect(warning.rule).to.equal(rule);
        expect(warning.message).to.equal('Overwriting destination file.');
        transformer.driver.exists.restore();
        done();
      });
    });
  }); // end 'copy'

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
        expect(warning.message).to.equal('Overwriting destination file.');
        transformer.driver.exists.restore();
        done();
      });
    });
  }); // end 'rename'

  describe('replace', function() {
    var transformer;

    beforeEach(function (done) {
      transformer = new Transformer('/etc', []);
      done();
    });

    describe('patterns', function() {
      beforeEach(function (done) {
        sinon.stub(async, 'each').callsArg(2);
        done();
      });

      afterEach(function (done) {
        async.each.restore();
        done();
      });

      it('should use [] for patterns if non were provided', function(done) {
        transformer.replace({}, noop);
        var arg = async.each.firstCall.args[0];
        expect(Array.isArray(arg)).to.be.true();
        expect(arg.length).to.equal(0);
        done();
      });

      it('should perform search and replace for each pattern', function(done) {
        var rule = { patterns: [1, 2, 3] };
        var callback = sinon.spy();
        transformer.replace(rule, callback);
        expect(async.each.calledOnce).to.be.true();
        expect(async.each.calledWith(rule.patterns)).to.be.true();
        expect(callback.calledOnce).to.be.true();
        done();
      });
    }); // end 'sub-rules'

    it('should perform a grep for each search and replace', function(done) {
      var rule = {
        patterns: [
          { search: 'a' },
          { search: 'b' },
          { search: 'c' }
        ]
      };
      var count = createCount(3, function () {
        expect(stub.callCount).to.equal(3);
        rule.patterns.forEach(function (pattern) {
          expect(stub.calledWith(pattern.search)).to.be.true();
        });
        done();
      });
      var stub = sinon.stub(transformer.driver, 'grep', function() {
        count.next();
      });
      transformer.replace(rule);
    });

    it('should call sed on each file in the result set', function(done) {
      var rule = {
        patterns: [
          { search: 'a', replace: 'b' }
        ]
      };
      var grepResult = 'file1.txt:12:---\nfile2.txt:293:---\n';
      sinon.stub(transformer.driver, 'grep').yields(null, grepResult);
      var sed = sinon.stub(transformer.driver, 'sed').callsArg(4);

      transformer.replace(rule, function (err) {
        expect(sed.callCount).to.equal(2);
        expect(sed.calledWith('a', 'b', 'file1.txt', 12));
        expect(sed.calledWith('a', 'b', 'file2.txt', 293));
        done();
      });
    });

    it('should ignore binary files', function(done) {
      var rule = { patterns: [{search: 'a', replace: 'b'}] };
      var grepResult = 'Binary file example.bin matches\nfile1:342:---\n';
      sinon.stub(transformer.driver, 'grep').yields(null, grepResult);
      var sed = sinon.stub(transformer.driver, 'sed').callsArg(4);
      transformer.replace(rule, function (err) {
        expect(sed.callCount).to.equal(1);
        expect(sed.calledWith('a', 'b', 'file1.txt', 342));
        done();
      });
    });

    it('should appropriately apply exclude filters', function(done) {
      var rule = {
        patterns: [
          {
            search: 'a',
            replace: 'b',
            exclude: [
              { name: 'file1.txt' },
              { name: 'file2.txt', line: 22 },
              { name: 'not-there.txt' },
              { } // malformed excludes should be ignored
            ]
          }
        ]
      };
      var grepResult = [
        'file1.txt:23:---',
        'file2.txt:22:---',
        'file2.txt:78:---',
        'file3.txt:182:---'
      ].join('\n');
      sinon.stub(transformer.driver, 'grep').yields(null, grepResult);
      var sed = sinon.stub(transformer.driver, 'sed').callsArg(4);

      transformer.replace(rule, function (err) {
        expect(sed.callCount).to.equal(2);
        expect(sed.calledWith('a', 'b', 'file2.txt', 700));
        expect(sed.calledWith('a', 'b', 'file3.txt', 29));
        done();
      });
    });
  }); // end 'replace'
}); // end 'Transformer'
