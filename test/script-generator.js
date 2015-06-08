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
    it('should set the action generators', function(done) {
      var script = new ScriptGenerator();
      var generatorNames = ['copy', 'rename', 'replace', 'exclude'];
      expect(script.actionGenerators).to.exist();
      generatorNames.forEach(function (name) {
        expect(script.actionGenerators[name]).to.exist();
      });
      done();
    });
  }); // end 'describe'

  describe('generate', function() {
    var script = new ScriptGenerator();

    beforeEach(function (done) {
      sinon.stub(fs, 'readFileSync').returns('PREAMBLE\n');
      done();
    });

    afterEach(function (done) {
      fs.readFileSync.restore();
      done();
    });

    it('should generate the preamble', function(done) {
      script.generate();
      expect(fs.readFileSync.calledOnce).to.be.true();
      done();
    });

    it('should generate the rule scripts', function(done) {
      script.ruleScripts = [4, 5, 6];
      var result = script.generate();
      expect(result).to.equal('PREAMBLE\n\n4\n5\n6');
      done();
    });
  }); // end 'generate'

  describe('addRule', function() {
    var script;

    beforeEach(function (done) {
      script = new ScriptGenerator();
      sinon.stub(script.actionGenerators, 'copy');
      sinon.stub(script.actionGenerators, 'rename');
      sinon.stub(script.actionGenerators, 'replace');
      sinon.stub(script.actionGenerators, 'exclude');
      done();
    });

    afterEach(function (done) {
      script.actionGenerators.copy.restore();
      script.actionGenerators.rename.restore();
      script.actionGenerators.replace.restore();
      script.actionGenerators.exclude.restore();
      done();
    });

    it('should use the copy handler for copy rules', function(done) {
      var rule = { action: 'copy' };
      script.addRule(rule);
      expect(script.actionGenerators.copy.calledWith(rule, 1)).to.be.true();
      done();
    });

    it('should use the rename handler for rename rules', function(done) {
      var rule = { action: 'rename' };
      script.addRule(rule);
      expect(script.actionGenerators.rename.calledWith(rule, 1)).to.be.true();
      done();
    });

    it('should use the replace handler for replace rules', function(done) {
      var rule = { action: 'replace' };
      script.addRule(rule);
      expect(script.actionGenerators.replace.calledWith(rule, 1)).to.be.true();
      done();
    });

    it('should use the exclude handler for exclude rules', function(done) {
      var rule = { action: 'exclude' };
      script.addRule(rule);
      expect(script.actionGenerators.exclude.calledWith(rule, 1)).to.be.true();
      done();
    });

    it('should correctly index rules', function(done) {
      var rule = { action: 'replace' };
      script.addRule(rule);
      expect(script.actionGenerators.replace.calledWith(rule, 1)).to.be.true();

      var rule2 = { action: 'rename' };
      script.addRule(rule2);
      expect(script.actionGenerators.rename.calledWith(rule2, 2)).to.be.true();

      var rule3 = { action: 'exclude' };
      script.addRule(rule3);
      expect(script.actionGenerators.exclude.calledWith(rule3, 3)).to.be.true();

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
        exclude: ['A.dmg', 'B.tar.gz']
      };
      var index = 55;
      var expected = fs.readFileSync('test/fixtures/replace.sh').toString();
      var generated = script.replace(rule, index);
      expect(generated).to.equal(expected);
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

    it('should ignore leading slashes in file excludes', function(done) {
      var script = new ScriptGenerator();
      var rule = {
        action: 'replace',
        search: 'yes',
        replace: 'no',
        exclude: [
          'file.txt',
          '/somefile.txt',
          './somefile2.txt',
          '././././//yarfile.txt'
        ]
      };
      var index = 5678;
      expect(script.replace(rule, index)).to.equal(
        fs.readFileSync('test/fixtures/replace-slash-exclude.sh').toString()
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
      var expected = fs.readFileSync('test/fixtures/exclude.sh').toString();
      var generated = script.exclude(rule, index);
      expect(generated).to.equal(expected);
      done();
    });

    it('should ignore leanding dots and slashes', function(done) {
      var script = new ScriptGenerator();
      var rule = {
        action: 'exclude',
        files: ['good.txt', '/bad.txt', './...//.///omg.txt']
      };
      var index = 1324;
      var expected = fs.readFileSync('test/fixtures/exclude-slashes.sh').toString();
      var generated = script.exclude(rule, index);
      expect(generated).to.equal(expected);
      done();
    });
  }); // end 'exclude'

}); // end 'shell-script'
