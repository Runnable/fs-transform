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

  describe('results', function() {
    it('should add a result for each valid rule', function(done) {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'replace', search: '"cool"', replace: '"neat"' },
        { action: 'replace', search: '/some/path/foo', replace: '/path/"bar"'},
        { action: 'copy', source: 'A', dest: 'A-copy' },
        { action: 'copy', source: 'B', dest: 'B-copy' },
        { action: 'copy', source: 'sub/C', dest: 'sub/C-copy' }
      ];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        expect(transformer.results.length).to.equal(rules.length);
        done();
      });
    });

    it('should provide a correct full diff', function(done) {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'replace', search: '"cool"', replace: '"neat"' },
        { action: 'replace', search: '/some/path/foo', replace: '/path/"bar"'}
      ];

      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        var expected = fs.read('../diff').split('\n').filter(function (line) {
          return line.match(/^[+-][^+-]/);
        }).join('\n');
        var diff = transformer.getDiff().split('\n').filter(function (line) {
          return line.match(/^[+-][^+-]/);
        }).join('\n');
        expect(diff).to.equal(expected);
        done();
      });
    });

    it('should use relative paths for full diffs', function(done) {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'replace', search: '"cool"', replace: '"neat"' },
        { action: 'replace', search: '/some/path/foo', replace: '/path/"bar"'}
      ];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        var diff = transformer.getDiff();
        expect(diff.indexOf(transformer.driver.working)).to.equal(-1);
        expect(diff.indexOf(transformer.driver.root)).to.equal(-1);
        done();
      });
    });
  });
});
