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
var sinon = require('sinon');

var ScriptGenerator = require('../lib/script-generator');
var fs = require('fs');

describe('ScriptGenerator', function() {
  describe('constructor', function () {
    it('should set the given rules', function(done) {
      var rules = [1, 2, 3];
      sinon.stub(ScriptGenerator.prototype, 'setRules');
      var script = new ScriptGenerator(rules);
      expect(ScriptGenerator.prototype.setRules.calledWith(rules)).to.be.true();
      ScriptGenerator.prototype.setRules.restore();
      done();
    });

    it('should set the action handlers', function(done) {
      var script = new ScriptGenerator();
      var handlerNames = ['copy', 'rename', 'replace', 'exclude'];
      expect(script.actionHandlers).to.exist();
      handlerNames.forEach(function (name) {
        expect(script.actionHandlers[name]).to.exist();
      });
      done();
    });
  }); // end 'describe'

  describe('setRules', function() {
    it('should set the rules for the generator', function(done) {
      var rules = [1, 2, 3];
      var script = new ScriptGenerator(rules);
      expect(script.rules).to.equal(rules);
      done();
    });
  }); // end 'setRules'

  describe('generate', function() {
    var script;

    beforeEach(function (done) {
      script = new ScriptGenerator();
      sinon.stub(script, 'preamble').returns('PREAMBLE');
      sinon.stub(script, 'generateRule', function (rule) {
        return "RULE " + rule;
      });
      done();
    });

    it('should generate the preamble', function(done) {
      script.setRules([ 1, 2, 3 ]);
      script.generate();
      expect(script.preamble.calledOnce).to.be.true();
      done();
    });

    it('should generate the rule scripts', function(done) {
      script.setRules([4, 5, 6]);
      script.generate();
      expect(script.generateRule.callCount).to.equal(3);
      expect(script.generateRule.calledWith(4)).to.be.true();
      expect(script.generateRule.calledWith(5)).to.be.true();
      expect(script.generateRule.calledWith(6)).to.be.true();
      done();
    });

    it('should return the fully composed script', function(done) {
      script.setRules(['A', 'B', 'C']);
      var result = script.generate();
      expect(result).to.equal(
        'PREAMBLE\n' +
        'RULE A\n' +
        'RULE B\n' +
        'RULE C'
      );
      done();
    });
  }); // end 'generate'

  describe('preamble', function() {
    it('should generate and return the preamble', function(done) {
      expect(new ScriptGenerator().preamble()).to.equal(
        fs.readFileSync('test/fixtures/script-preamble.sh').toString()
      );
      done();
    });
  }); // end 'preamble'

  describe('generateRule', function() {
    var script = new ScriptGenerator();

    beforeEach(function (done) {
      sinon.stub(script.actionHandlers, 'copy');
      sinon.stub(script.actionHandlers, 'rename');
      sinon.stub(script.actionHandlers, 'replace');
      sinon.stub(script.actionHandlers, 'exclude');
      done();
    });

    afterEach(function (done) {
      script.actionHandlers.copy.restore();
      script.actionHandlers.rename.restore();
      script.actionHandlers.replace.restore();
      script.actionHandlers.exclude.restore();
      done();
    });

    it('should use the copy handler for copy rules', function(done) {
      var rule = { action: 'copy' };
      var index = 1;
      script.generateRule(rule, index);
      expect(script.actionHandlers.copy.calledWith(rule, index))
        .to.be.true();
      done();
    });

    it('should use the rename handler for rename rules', function(done) {
      var rule = { action: 'rename' };
      var index = 341;
      script.generateRule(rule, index);
      expect(script.actionHandlers.rename.calledWith(rule, index))
        .to.be.true();
      done();
    });

    it('should use the replace handler for replace rules', function(done) {
      var rule = { action: 'replace' };
      var index = 8888;
      script.generateRule(rule, index);
      expect(script.actionHandlers.replace.calledWith(rule, index))
        .to.be.true();
      done();
    });

    it('should use the exclude handler for exclude rules', function(done) {
      var rule = { action: 'exclude' };
      var index = 1337;
      script.generateRule(rule, index);
      expect(script.actionHandlers.exclude.calledWith(rule, index))
        .to.be.true();
      done();
    });
  }); // end 'generateRule'

  describe('copy', function() {
    it('should generate the script for a copy', function(done) {
      var script = new ScriptGenerator();
      var rule = {
        action: 'copy',
        source: 'foo.txt',
        dest: 'bar.rtf'
      };
      var index = 102;
      expect(script.copy(rule, index)).to.equal(
        fs.readFileSync('test/fixtures/copy.sh').toString()
      );
      done();
    });
  }); // end 'copy'

  describe('rename', function() {
    it('should generate the script for a rename', function(done) {
      var script = new ScriptGenerator();
      var rule = {
        action: 'rename',
        source: 'foo.txt',
        dest: 'bar.rtf'
      };
      var index = 42;
      expect(script.rename(rule, index)).to.equal(
        fs.readFileSync('test/fixtures/rename.sh').toString()
      );
      done();
    });
  }); // end 'rename'

  describe('replace', function() {
    it('should generate the script for a replace', function(done) {
      var script = new ScriptGenerator();
      var rule = {
        action: 'replace',
        search: 'whut',
        replace: 'wat',
        excludes: ['A.dmg', 'B.tar.gz']
      };
      var index = 55;
      expect(script.replace(rule, index)).to.equal(
        fs.readFileSync('test/fixtures/replace.sh').toString()
      );
      done();
    });

    it('should generate a script for replace without local excludes', function(done) {
      var script = new ScriptGenerator();
      var rule = {
        action: 'replace',
        search: 'absolutely',
        replace: 'probably'
      };
      var index = 9000;
      expect(script.replace(rule, index)).to.equal(
        fs.readFileSync('test/fixtures/replace-no-exclude.sh').toString()
      );
      done();
    });
  }); // end 'replace'

  describe('exclude', function() {
    it('should generate the script for a exclude', function(done) {
      var script = new ScriptGenerator();
      var rule = {
        action: 'exclude',
        files: ['A.dmg', 'B.tar.gz', 'gamma.pajama']
      };
      var index = 1234;
      expect(script.exclude(rule, index)).to.equal(
        fs.readFileSync('test/fixtures/exclude.sh').toString()
      );
      done();
    });
  }); // end 'exclude'

}); // end 'shell-script'
