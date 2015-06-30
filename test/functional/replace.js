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

  describe('replace', function() {
    it('should replace text in a file', function(done) {
      var search = 'File B is good';
      var replace = 'File B is great'; // stay positive!
      var rules = [{ action: 'replace', search: search, replace: replace }];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        var bData = fs.read('B');
        var dData = fs.read('sub/subsub/D');
        expect(bData.match(search)).to.be.null();
        expect(bData.match(replace)).to.not.be.null();
        expect(dData.match(search)).to.be.null();
        expect(dData.match(replace)).to.not.be.null();
        done();
      });
    });

    it('should replace text with special characters', function(done) {
      var rules = [
        { action: 'replace', search: '\\sum', replace: '\\prod' },
        { action: 'replace', search: '"cool"', replace: '"neat"' },
        { action: 'replace', search: '/some/path/foo', replace: '/path/"bar"'}
      ];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }

        var dataC = fs.read('sub/C');

        //console.log(dataC);

        expect(dataC.match(rules[0].search)).to.be.null();
        expect(dataC.match(rules[0].replace)).to.not.be.null();

        var dataD = fs.read('sub/subsub/D');
        expect(dataD.match(rules[1].search)).to.be.null();
        expect(dataD.match(rules[1].replace)).to.not.be.null();

        var dataA = fs.read('A');
        expect(dataA.match(rules[2].search)).to.be.null();
        expect(dataA.match(rules[2].replace)).to.not.be.null();

        done();
      });
    });

    it('should apply exclusions', function(done) {
      var rules = [{
        action: 'replace',
        search: 'Mew',
        replace: 'Woof',
        exclude: [
          'B',
          'not-there'
        ]
      }];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        var dataB = fs.read('B');
        var linesC = fs.read('sub/C').split('\n');
        expect(linesC[3]).to.equal('Woof');
        expect(linesC[4]).to.equal('Woof');
        expect(linesC[5]).to.equal('Woof');
        expect(linesC[7]).to.equal('Woof');
        expect(dataB.match('Woof')).to.be.null();
        expect(transformer.warnings).to.not.be.empty();
        expect(transformer.warnings[0].message)
          .to.equal('Unused exclude.');
        done();
      });
    });

    it('should warn if excludes all results', function (done) {
      var search = 'File A';
      var replace = 'File X';
      var rules = [{
        action: 'replace',
        search: search,
        replace: replace,
        exclude: ['A']
      }];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { return done(err); }
        var dataA = fs.read('A');
        expect(dataA.match(search)).to.not.be.null();
        expect(dataA.match(replace)).to.be.null();
        expect(transformer.warnings).to.not.be.empty();
        expect(transformer.warnings[0].message)
          .to.equal('All results were excluded.');
        done();
      });
    });

    it('should replace multiple lines at a time', function(done) {
      var search = 'Multiline\nEXAMPLE\nDrool...';
      var replace = '-~- MULTI-LINE REPLACE, DOLLA DOLLA BILLS YALL -~-';
      var rules = [{
        action: 'replace',
        search: search,
        replace: replace
      }];
      Transformer.transform(fs.path, rules, function (err, transformer) {
        if (err) { done(err); }
        var dataA = fs.read('A');
        var dataB = fs.read('B');
        expect(dataA.match(replace)).to.not.be.null();
        expect(dataB.match(replace)).to.be.null();
        done();
      });
    });
  });
});
