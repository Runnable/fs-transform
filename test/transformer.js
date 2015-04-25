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
var Warning = require('../lib/warning');

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

    it('should keep a list of commands', function (done) {
      var transformer = new Transformer('/etc', []);
      expect(transformer.commands).to.be.an.array();
      done();
    });

    it('should keep a list of name changes', function(done) {
      var transformer = new Transformer('/etc', []);
      expect(transformer.nameChanges).to.be.an.array();
      done();
    });
  }); // end 'constructor'

  describe('pushResult', function() {
    it('should push a new result to the result list', function(done) {
      var transformer = new Transformer('/', []);
      var rule = { action: 'copy', source: 'a', dest: 'b' };
      transformer.pushResult(rule);
      expect(transformer.results).to.not.be.empty();
      var result = transformer.results[0];
      expect(result.rule).to.equal(rule);
      expect(result.commands).to.be.an.array();
      expect(result.commands).to.be.empty();
      expect(result.warnings).to.be.an.array();
      expect(result.warnings).to.be.empty();
      expect(result.nameChanges).to.be.an.array();
      expect(result.nameChanges).to.be.empty();
      expect(result.diffs).to.be.an.object();
      done();
    });

    it('should set the `currentResult` instance variable', function (done) {
      var transformer = new Transformer('/', []);
      var rule = { action: 'copy', source: 'a', dest: 'b' };
      transformer.pushResult(rule);
      expect(transformer.results).to.not.be.empty();
      expect(transformer.currentResult).to.not.be.null();
      expect(transformer.results[0]).to.equal(transformer.currentResult);
      done();
    });
  }); // end 'pushResult'

  describe('addWarning', function() {
    it('should add a warning to master list', function(done) {
      var object = { name: 'woot' };
      var message = 'Very interesting';
      var transformer = new Transformer('/', []);
      transformer.addWarning(object, message);
      expect(transformer.warnings).to.not.be.empty();
      var warning = transformer.warnings[0];
      expect(warning).instanceof(Warning);
      expect(warning.rule).to.equal(object);
      expect(warning.message).to.equal(message);
      done();
    });

    it('should add the warning to the current result', function (done) {
      var transformer = new Transformer('/', []);
      var result = transformer.pushResult({ action: 'copy' });
      transformer.addWarning({ name: 'woot' }, 'Very interesting');
      var warning = transformer.warnings[0];
      expect(result.warnings).to.not.be.empty();
      expect(result.warnings[0]).to.equal(warning);
      done();
    });
  }); // end 'addWarning'

  describe('addNameChange', function() {
    it('should add the name change to the master list', function (done) {
      var from = 'a';
      var to = 'b';
      var transformer = new Transformer('/', []);
      transformer.addNameChange(from, to);
      expect(transformer.nameChanges).to.not.be.empty();
      var change = transformer.nameChanges[0];
      expect(change.from).to.equal(from);
      expect(change.to).to.equal(to);
      done();
    });

    it('should add the name change to the current result', function (done) {
      var transformer = new Transformer('/', []);
      var result = transformer.pushResult({ action: 'rename' });
      transformer.addNameChange('a', 'b');
      expect(transformer.nameChanges).to.not.be.empty();
      var change = transformer.nameChanges[0];
      expect(result.nameChanges).to.not.be.empty();
      expect(result.nameChanges[0]).to.equal(change);
      done();
    });
  }); // end 'addNameChange'

  describe('addDiff', function() {
    it('should add the diff to the current result', function (done) {
      var transformer = new Transformer('/', []);
      var result = transformer.pushResult({ action: 'replace' });
      var filename = '/etc/file1.txt';
      var diff = 'THIS IS SPARTA';
      transformer.addDiff(filename, diff);
      expect(result.diffs[filename]).to.be.an.array();
      expect(result.diffs[filename]).to.not.be.empty();
      expect(result.diffs[filename][0]).to.equal(diff);
      done();
    });

    it('should add multiple diffs to the current result', function (done) {
      var transformer = new Transformer('/', []);
      var result = transformer.pushResult({ action: 'replace' });
      var filename = '/etc/file1.txt';
      var diff = 'THIS IS SPARTA';
      var filename2 = '/etc/file2.txt';
      var diff2 = 'THIS IS ARTASPAY';
      transformer.addDiff(filename, diff);
      transformer.addDiff(filename, diff2);
      transformer.addDiff(filename2, diff2);
      expect(result.diffs[filename]).to.be.an.array();
      expect(result.diffs[filename].length).to.equal(2);
      expect(result.diffs[filename][0]).to.equal(diff);
      expect(result.diffs[filename][1]).to.equal(diff2);
      expect(result.diffs[filename2]).to.be.an.array();
      expect(result.diffs[filename2]).to.not.be.empty();
      expect(result.diffs[filename2][0]).to.equal(diff2);
      done();
    });
  });

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
      expect(spy.calledWith('a', 'b', 'c')).to.be.true();
      expect(spy.calledOn(transformer)).to.be.true();
      done();
    });
  }); // end 'setAction & getAction'

  describe('getScript', function() {
    it('should return a correctly composed shellscript', function(done) {
      var ruleOne = { action: 'copy', source: 'foo', dest: 'bar' };
      var commandOne = 'cp /etc/foo /etc/bar';
      var ruleTwo = { action: 'replace', search: 'a', replace: 'b' };
      var commandTwo = 'sed -i "" "22s/a/b/g" bar';

      var transformer = new Transformer('/etc', []);
      transformer.saveCommand(commandOne, ruleOne);
      transformer.saveCommand(commandTwo, ruleTwo);

      var script = transformer.getScript();

      expect(script).to.be.a.string();
      expect(script.indexOf('#!/bin/sh')).to.equal(0);
      expect(script.indexOf(commandOne)).to.be.above(-1);
      expect(script.indexOf(commandTwo)).to.be.above(-1);
      expect(script.indexOf(JSON.stringify(ruleOne))).to.be.above(-1);
      expect(script.indexOf(JSON.stringify(ruleTwo))).to.be.above(-1);

      done();
    });
  }); // end 'getScript'

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
        expect(warning.message).to.equal('Overwrites destination file.');
        transformer.driver.exists.restore();
        done();
      });
    });

    it('should save the copy command', function(done) {
      var rule = { source: 'foo', dest: 'bar' };
      var spy = sinon.spy(transformer, 'saveCommand');
      sinon.stub(transformer.driver, 'exists').returns(true);
      transformer.copy(rule, function () {
        expect(spy.calledOnce).to.be.true();
        transformer.driver.exists.restore();
        done();
      });
    });

    it('should not save the copy command if an error occurred', function (done) {
      var rule = { source: 'foo', dest: 'bar' };
      var spy = sinon.spy(transformer, 'saveCommand');
      sinon.stub(transformer.driver, 'exists').returns(true);
      transformer.driver.copy.yields(new Error('error'));
      transformer.copy(rule, function (err) {
        expect(spy.callCount).to.equal(0);
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
        expect(warning.message).to.equal('Overwrites destination file.');
        transformer.driver.exists.restore();
        done();
      });
    });

    it('should save the move command', function(done) {
      var rule = { source: 'foo', dest: 'bar' };
      var spy = sinon.spy(transformer, 'saveCommand');
      sinon.stub(transformer.driver, 'exists').returns(true);
      transformer.rename(rule, function () {
        expect(spy.calledOnce).to.be.true();
        transformer.driver.exists.restore();
        done();
      });
    });

    it('should not save the copy command if an error occurred', function (done) {
      var rule = { source: 'foo', dest: 'bar' };
      var spy = sinon.spy(transformer, 'saveCommand');
      sinon.stub(transformer.driver, 'exists').returns(true);
      transformer.driver.move.yields(new Error('error'));
      transformer.rename(rule, function (err) {
        expect(spy.callCount).to.equal(0);
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

    describe('warnings', function() {
      var grepSpy;
      var sedSpy;
      var copySpy;
      var removeSpy;
      var diffSpy;

      beforeEach(function (done) {
        transformer = new Transformer('/etc', []);
        grepSpy = sinon.spy(transformer.driver, 'grep');
        sedSpy = sinon.spy(transformer.driver, 'sed');
        copySpy = sinon.spy(transformer.driver, 'copy');
        removeSpy = sinon.spy(transformer.driver, 'remove');
        diffSpy = sinon.spy(transformer.driver, 'diff');
        done();
      });

      it('should add a warning and do nothing if not given a search pattern', function(done) {
        var rule = {};
        transformer.replace(rule, function (err) {
          expect(grepSpy.callCount).to.equal(0);
          expect(sedSpy.callCount).to.equal(0);
          expect(copySpy.callCount).to.equal(0);
          expect(removeSpy.callCount).to.equal(0);
          expect(diffSpy.callCount).to.equal(0);
          expect(transformer.warnings.length).to.equal(1);
          var warning = transformer.warnings[0];
          expect(warning.rule).to.equal(rule);
          expect(warning.message).to.equal('Search pattern not specified.');
          done();
        });
      });

      it('should add a warning and do nothing if no replacement was given', function(done) {
        var rule = { search: 'a' };
        transformer.replace(rule, function (err) {
          expect(grepSpy.callCount).to.equal(0);
          expect(sedSpy.callCount).to.equal(0);
          expect(copySpy.callCount).to.equal(0);
          expect(removeSpy.callCount).to.equal(0);
          expect(diffSpy.callCount).to.equal(0);
          expect(transformer.warnings.length).to.equal(1);
          var warning = transformer.warnings[0];
          expect(warning.rule).to.equal(rule);
          expect(warning.message).to.equal('Replacement not specified.');
          done();
        });
      });

      it('should add a warning if excludes is not an array', function(done) {
        var rule = { search: 'a', replace: 'b', exclude: 1776 };
        transformer.driver.grep.restore();
        sinon.stub(transformer.driver, 'grep', function() {
          expect(transformer.warnings.length).to.equal(1);
          var warning = transformer.warnings[0];
          expect(warning.rule).to.equal(rule);
          expect(warning.message)
            .to.equal('Excludes not supplied as an array, omitting.');
          done();
        });
        transformer.replace(rule);
      });

      it('should add a warning and do nothing if no files match the pattern', function(done) {
        var rule = { search: 'a', replace: 'b' };
        transformer.driver.grep.restore();
        sinon.stub(transformer.driver, 'grep').yields(null, '');
        transformer.replace(rule, function (err) {
          if (err) { return done(err); }
          expect(transformer.warnings.length).to.equal(1);
          var warning = transformer.warnings[0];
          expect(warning.rule).to.equal(rule);
          expect(warning.message)
            .to.equal('Search did not return any results.');
          expect(copySpy.callCount).to.equal(0);
          done();
        })
      });
    }); // end 'warnings'

    it('should perform a grep for the search and replace', function(done) {
      var rule = { action: 'replace', search: 'a', replace: 'b' };
      var grep = sinon.stub(transformer.driver, 'grep', function() {
        expect(grep.calledOnce).to.be.true();
        expect(grep.calledWith(rule.search)).to.be.true();
        transformer.driver.grep.restore();
        done();
      });
      transformer.replace(rule, noop);
    });

    it('should call sed on each file in the result set', function(done) {
      var sed = sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt:12:---',
        '/etc/file2.txt:293:---'
      ].join('\n'));

      var rule = { action: 'replace', search: 'a', replace: 'b' };
      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        expect(sed.callCount).to.equal(2);
        expect(sed.calledWith('a', 'b', '/etc/file1.txt', 12)).to.be.true();
        expect(sed.calledWith('a', 'b', '/etc/file2.txt', 293)).to.be.true();
        done();
      });
    });

    it('should ignore binary files', function(done) {
      var rule = {
        search: 'a',
        replace: 'b'
      };

      var sed = sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        'Binary file /etc/example.bin matches',
        '/etc/file1.txt:342:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        expect(sed.callCount).to.equal(1);
        expect(sed.calledWith('a', 'b', '/etc/file1.txt', 342)).to.be.true();
        done();
      });
    });

    it('should appropriately apply exclude filters', function(done) {
      var rule = {
        search: 'a',
        replace: 'b',
        exclude: [
          { name: 'file1.txt' },
          { name: 'file2.txt', line: 22 },
          { name: 'not-there.txt' },
          { } // malformed excludes should be ignored
        ]
      };

      var sed = sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt:23:---',
        '/etc/file2.txt:22:---',
        '/etc/file2.txt:78:---',
        '/etc/file3.txt:182:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        expect(sed.callCount).to.equal(2);
        expect(sed.calledWith('a', 'b', '/etc/file2.txt', 78)).to.be.true();
        expect(sed.calledWith('a', 'b', '/etc/file3.txt', 182)).to.be.true();
        done();
      });
    });

    it('should add a warning for every exclude that was not applied', function(done) {
      var rule = {
        search: 'a',
        replace: 'b',
        exclude: [
          { name: 'applied.txt' },
          { name: 'not-applied.txt' },
          { name: 'file1.txt', line: 50 }, // applied
          { name: 'file1.txt', line: 17 }  // not applied
        ]
      };

      var sed = sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/applied.txt:111:---',
        '/etc/okay.txt:2384:---',
        '/etc/file1.txt:50:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        var warnings = transformer.warnings;
        expect(warnings.length).to.equal(2);
        expect(warnings[0].rule).to.equal(rule.exclude[1]);
        expect(warnings[0].message).to.equal('Unused exclude.')
        expect(warnings[1].rule).to.equal(rule.exclude[3]);
        expect(warnings[1].message).to.equal('Unused exclude.')
        done();
      });
    });

    it('should add a warning and skip if all results were excluded', function(done) {
      var rule = {
        search: 'a',
        replace: 'b',
        exclude: [
          { name: 'file1.txt' }
        ]
      };

      var sed = sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt:50:---',
        '/etc/file1.txt:89:---',
        '/etc/file1.txt:123:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        var warnings = transformer.warnings;
        expect(warnings.length).to.equal(1);
        expect(warnings[0].rule).to.equal(rule);
        expect(warnings[0].message).to.equal('All results were excluded.');
        expect(sed.callCount).to.equal(0);
        done();
      });
    });

    it('should save each sed command', function(done) {
      var rule = {
        action: 'replace',
        search: 'alpha',
        replace: 'beta'
      };
      var command = 'sed -i "" "s/alpha/beta/" file.txt';
      var saveCommand = sinon.spy(transformer, 'saveCommand');

      sinon.stub(transformer.driver, 'sed')
        .returns(command)
        .yieldsAsync();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file.txt:10:---',
        '/etc/file.txt:12:---',
        '/etc/file.txt:14:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        expect(saveCommand.callCount).to.equal(3);
        expect(saveCommand.calledWith(command)).to.be.true();
        done();
      });
    });

    it('should not save a command if an error occurred', function(done) {
      var rule = {
        action: 'replace',
        search: 'alpha',
        replace: 'beta'
      };

      var saveCommand = sinon.spy(transformer, 'saveCommand');

      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'sed')
        .returns('command')
        .yieldsAsync(new Error('Error'));
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file.txt:10:---',
        '/etc/file.txt:12:---',
        '/etc/file.txt:14:---'
      ].join('\n'))

      transformer.replace(rule, function () {
        expect(saveCommand.callCount).to.equal(0);
        done();
      });
    });

    it('should make an original copy for each changed file', function (done) {
      var rule = {
        action: 'replace',
        search: 'awesome',
        replace: 'super'
      };

      var copy = sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file.txt:10:---',
        '/etc/file.txt:12:---',
        '/etc/file.txt:14:---',
        '/etc/file2.txt:182:---',
        '/etc/file2.txt:12:---',
        '/etc/file2.txt:16:---',
        '/etc/file3.txt:162:---'
      ].join('\n'))

      var fileNames = [
        '/etc/file.txt',
        '/etc/file2.txt',
        '/etc/file3.txt'
      ];

      transformer.replace(rule, function (err) {
        if (err) { return done(err) }
        expect(copy.callCount).to.equal(3);
        fileNames.forEach(function (name) {
          expect(copy.calledWith(name, name + Transformer.ORIGINAL_POSTFIX))
            .to.be.true();
        });
        done();
      });
    });

    it('should not proceed on original copy error', function (done) {
      var rule = {
        action: 'replace',
        search: 'awesome',
        replace: 'super'
      };
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file.txt:10:---',
        '/etc/file.txt:12:---',
      ].join('\n'));
      var sed = sinon.stub(transformer.driver, 'sed')
        .returns('command')
        .yields();
      sinon.stub(transformer.driver, 'copy').yields(new Error('Copy error'));
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();

      transformer.replace(rule, function (err) {
        expect(sed.callCount).to.equal(0);
        done();
      });
    });

    it('should perform and save a diff for each changed file', function(done) {
      var rule = {
        action: 'replace',
        search: 'alpha',
        replace: 'beta'
      };

      var deltas = 'this is a delta';
      var diff = sinon.stub(transformer.driver, 'diff').yields(null, deltas);
      var addDiff = sinon.spy(transformer, 'addDiff');
      sinon.stub(transformer.driver, 'sed').yieldsAsync();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt:10:---',
        '/etc/file2.txt:12:---',
        '/etc/file2.txt:14:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        expect(diff.callCount).to.equal(2);
        expect(addDiff.callCount).to.equal(2);
        done();
      });
    });

    it('should not yield an error if diff returned code 1', function (done) {
      var rule = {
        action: 'replace',
        search: 'alpha',
        replace: 'beta'
      };

      var deltas = 'this is a delta';
      var error = new Error('Not actually an error');
      error.code = 1;
      var diff = sinon.stub(transformer.driver, 'diff').yields(error, deltas);
      sinon.stub(transformer.driver, 'sed').yieldsAsync();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt:10:---',
        '/etc/file2.txt:12:---',
        '/etc/file2.txt:14:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        expect(err).to.be.undefined();
        expect(diff.callCount).to.equal(2);
        // TODO Track if diffs are actually being saved.
        done();
      });
    });

    it('should yield an error if diff actually failed (code > 1)', function (done) {
      var rule = {
        action: 'replace',
        search: 'alpha',
        replace: 'beta'
      };

      var error = new Error('Totally a real error');
      error.code = 3;
      var diff = sinon.stub(transformer.driver, 'diff').yields(error);
      sinon.stub(transformer.driver, 'sed').yieldsAsync();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt:10:---',
        '/etc/file2.txt:12:---',
        '/etc/file2.txt:14:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        expect(err).to.not.be.null();
        expect(diff.callCount).to.equal(1);
        done();
      });
    });

    it('should remove original copies', function (done) {
      var rule = {
        action: 'replace',
        search: 'alpha',
        replace: 'beta'
      };

      var remove = sinon.stub(transformer.driver, 'remove').yieldsAsync();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'sed').yieldsAsync();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt:10:---',
        '/etc/file2.txt:12:---',
        '/etc/file2.txt:14:---',
        '/etc/file3.txt:293:---'
      ].join('\n'));

      var filenames = [
        '/etc/file1.txt',
        '/etc/file2.txt',
        '/etc/file3.txt'
      ];

      transformer.replace(rule, function () {
        expect(remove.callCount).to.equal(3);
        filenames.forEach(function (name) {
          var originalName = name + Transformer.ORIGINAL_POSTFIX;
          expect(remove.calledWith(originalName)).to.be.true();
        });
        done();
      });
    });
  }); // end 'replace'
}); // end 'Transformer'
