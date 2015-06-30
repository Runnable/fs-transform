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
var fs = require('../fixtures/fs-helper');
var Transformer = require('../../index.js');
var async = require('async');
var childProcess = require('child_process');

var debug = require('debug')('fs-transform:test');

describe('functional', function () {
  beforeEach(fs.createTestDir);
  afterEach(fs.removeTestDir);

  describe('rename', function() {
    it('should rename a file', function (done) {
      var source = 'A';
      var dest = 'A-rename';
      var rules = [
        { action: 'rename', source: source, dest: dest }
      ];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        expect(fs.exists(source)).to.be.false();
        expect(fs.exists(dest)).to.be.true();
        done();
      });
    });

    it('should rename many files', function (done) {
      var rules = [
        { action: 'rename', source: 'A', dest: 'A-rename' },
        { action: 'rename', source: 'B', dest: 'B-rename' },
        { action: 'rename', source: 'sub/C', dest: 'sub/C-rename' }
      ];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        rules.forEach(function (rule) {
          expect(fs.exists(rule.source)).to.be.false();
          expect(fs.exists(rule.dest)).to.be.true();
        });
        done();
      });
    });

    it('should overwrite files with a warning', function (done) {
      var source = 'A';
      var dest = 'B';
      var rules = [{ action: 'rename', source: source, dest: dest }];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        expect(transformer.warnings).to.not.be.empty();
        expect(fs.exists(source)).to.be.false();
        expect(fs.exists(dest)).to.be.true();
        fs.mockDiff(dest, source, function (err, diff) {
          if (err) { return done(err); }
          expect(diff).to.be.empty();
          done();
        });
      });
    });
  });
});
