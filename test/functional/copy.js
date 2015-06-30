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

  describe('copy', function() {
    it('should copy a file', function (done) {
      var dest = 'A-copy';
      var rules = [{ action: 'copy', source: 'A', dest: dest }];
      Transformer.transform(fs.path, rules, function (err) {
        if (err) { return done(err); }
        expect(fs.exists(dest)).to.be.true();
        done();
      });
    });

    it('should copy many files', function (done) {
      var rules = [
        { action: 'copy', source: 'A', dest: 'A-copy' },
        { action: 'copy', source: 'B', dest: 'B-copy' },
        { action: 'copy', source: 'sub/C', dest: 'sub/C-copy' }
      ];
      Transformer.transform(fs.path, rules, function (err) {
        if (err) { return done(err); }
        rules.forEach(function (rule) {
          expect(fs.exists(rule.dest)).to.be.true();
        });
        done();
      });
    });

    it('should overwrite destination files with warning', function (done) {
      var source = 'A';
      var dest = 'B';
      var rules = [{ action: 'copy', source: source, dest: dest }];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        expect(transformer.warnings).to.not.be.empty();
        fs.diff(source, dest, function (err, diff) {
          if (err) { return done(err); }
          expect(diff).to.be.empty();
          done();
        });
      });
    });
  });
});
