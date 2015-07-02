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
var fs = require('fs');

var Transformer = require('../../../lib/transformer');
var FsDriver = require('../../../lib/fs-driver');
var Warning = require('../../../lib/warning');

describe('Transformer', function() {
  describe('replace', function() {
    var transformer;
    beforeEach(function (done) {
      transformer = new Transformer('/etc', []);
      sinon.stub(fs, 'readFileSync')
      sinon.stub(fs, 'readFile').yieldsAsync();
      sinon.stub(fs, 'writeFile').yields();
      done();
    });

    afterEach(function (done) {
      fs.readFileSync.restore();
      fs.readFile.restore();
      fs.writeFile.restore();
      done();
    });

    describe('warnings', function() {
      var grepSpy;
      var copySpy;
      var removeSpy;
      var diffSpy;

      beforeEach(function (done) {
        transformer = new Transformer('/etc', []);
        grepSpy = sinon.spy(transformer.driver, 'grep');
        copySpy = sinon.spy(transformer.driver, 'copy');
        removeSpy = sinon.spy(transformer.driver, 'remove');
        diffSpy = sinon.spy(transformer.driver, 'diff');
        done();
      });

      it('should add a warning and do nothing if not given a search pattern', function(done) {
        var rule = {};
        transformer.replace(rule, function (err) {
          expect(grepSpy.callCount).to.equal(0);
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

    it('should check each file for full contents', function(done) {
      var rule = { action: 'replace', search: 'a', replace: 'b' };
      var files =['/etc/file1.txt', '/etc/file2.txt'];

      fs.readFileSync.returns('a');
      fs.readFile.yieldsAsync(null, 'a');

      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, files.join('\n'));

      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        expect(fs.readFileSync.calledWith(files[0])).to.be.true();
        expect(fs.readFileSync.calledWith(files[1])).to.be.true();
        done();
      });
    });

    it('should replace contents on each file', function(done) {
      var rule = { action: 'replace', search: 'a', replace: 'b' };
      var files =['/etc/file1.txt', '/etc/file2.txt'];

      fs.readFileSync.returns('a');
      fs.readFile.yieldsAsync(null, 'a');

      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, files.join('\n'));

      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        expect(fs.writeFile.callCount).to.equal(2);
        expect(fs.writeFile.firstCall.calledWith(
          '/etc/file1.txt', 'b'
        )).to.be.true();
        expect(fs.writeFile.secondCall.calledWith(
          '/etc/file2.txt', 'b'
        )).to.be.true();
        done();
      });
    });

    it('should apply global file excludes', function(done) {
      var rule = { search: 'koopa', replace: 'mario' };
      transformer.exclude({ files: ['file2.txt', 'file4.txt'] }, noop);

      fs.readFileSync.returns('koopa');
      fs.readFile.yieldsAsync(null, 'koopa');

      var sed = sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt',
        '/etc/file2.txt',
        '/etc/file3.txt',
        '/etc/file4.txt',
        '/etc/suhweet/file4.txt'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        expect(fs.writeFile.callCount).to.equal(3);
        expect(fs.writeFile.calledWith('/etc/file1.txt')).to.be.true();
        expect(fs.writeFile.calledWith('/etc/file3.txt')).to.be.true();
        expect(fs.writeFile.calledWith('/etc/suhweet/file4.txt')).to.be.true();
        done();
      });
    });

    it('should always exclude .git files', function(done) {
      var rule = { search: 'metroid', replace: 'samus' };

      fs.readFileSync.returns('metroid');
      fs.readFile.yieldsAsync(null, 'metroid');

      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/.git/file1.txt',
        '/etc/.git/file2.txt',
        '/etc/file3.txt',
        '/etc/file4.txt'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        expect(fs.readFile.callCount).to.equal(2);
        expect(fs.readFile.calledWith('/etc/.git/file1.txt')).to.be.false();
        expect(fs.readFile.calledWith('/etc/.git/file2.txt')).to.be.false();
        expect(fs.readFile.calledWith('/etc/file3.txt')).to.be.true();
        expect(fs.readFile.calledWith('/etc/file4.txt')).to.be.true();
        done();
      });
    });

    it('should appropriately apply exclude filters', function(done) {
      var rule = {
        search: 'a',
        replace: 'b',
        exclude: [
          'file1.txt',
          'file2.txt',
          'not-there.txt'
        ]
      };

      fs.readFileSync.returns('a');
      fs.readFile.yieldsAsync(null, 'a');

      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt',
        '/etc/file2.txt',
        '/etc/file2.txt',
        '/etc/file3.txt'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        expect(fs.writeFile.callCount).to.equal(1);
        expect(fs.writeFile.calledWith('/etc/file3.txt')).to.be.true();
        done();
      });
    });

    it('should add a warning for every exclude that was not applied', function(done) {
      var rule = {
        search: 'a',
        replace: 'b',
        exclude: [
          'applied.txt',
          'not-there',
          'file1.txt'
        ]
      };

      fs.readFileSync.returns('a');
      fs.readFile.yieldsAsync(null, 'a');

      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/applied.txt',
        '/etc/okay.txt',
        '/etc/file1.txt'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        var warnings = transformer.warnings;
        expect(warnings.length).to.equal(1);
        expect(warnings[0].rule).to.equal(rule.exclude[1]);
        expect(warnings[0].message).to.equal('Unused exclude.')
        done();
      });
    });

    it('should add a warning and skip if all results were excluded', function(done) {
      var rule = {
        search: 'a',
        replace: 'b',
        exclude: ['file1.txt']
      };

      fs.readFileSync.returns('a');
      fs.readFile.yieldsAsync(null, 'a');

      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt',
        '/etc/file1.txt',
        '/etc/file1.txt'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        if (err) { return done(err); }
        var warnings = transformer.warnings;
        expect(warnings.length).to.equal(1);
        expect(warnings[0].rule).to.equal(rule);
        expect(warnings[0].message).to.equal('All results were excluded.');
        expect(fs.writeFile.callCount).to.equal(0);
        done();
      });
    });

    it('should make an original copy for each changed file', function (done) {
      var rule = {
        action: 'replace',
        search: 'awesome',
        replace: 'super'
      };

      fs.readFileSync.returns('awesome');
      fs.readFile.yieldsAsync(null, 'awesome');

      var copy = sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file.txt',
        '/etc/file2.txt',
        '/etc/file3.txt'
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

      fs.readFileSync.returns('awesome');
      fs.readFile.yieldsAsync(null, 'awesome');

      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file.txt',
        '/etc/file.txt',
      ].join('\n'));

      sinon.stub(transformer.driver, 'copy').yields(new Error('Copy error'));
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();

      transformer.replace(rule, function (err) {
        expect(fs.writeFile.callCount).to.equal(0);
        done();
      });
    });

    it('should yield an error if diff actually failed (code > 1)', function (done) {
      var rule = {
        action: 'replace',
        search: 'alpha',
        replace: 'beta'
      };

      fs.readFileSync.returns('alpha');
      fs.readFile.yieldsAsync(null, 'alpha');

      var error = new Error('Totally a real error');
      error.code = 3;
      var diff = sinon.stub(transformer.driver, 'diff').yields(error);
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt',
        '/etc/file2.txt',
        '/etc/file2.txt'
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

      fs.readFileSync.returns('alpha');
      fs.readFile.yieldsAsync(null, 'alpha');

      var remove = sinon.stub(transformer.driver, 'remove').yieldsAsync();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt',
        '/etc/file2.txt',
        '/etc/file3.txt'
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

    it('should gracefully handle file read errors', function(done) {
      var error = new Error('sup?');
      var rule = {
        action: 'replace',
        search: 'alpha',
        replace: 'beta'
      };

      fs.readFileSync.returns('alpha');
      fs.readFile.yieldsAsync(error);

      sinon.stub(transformer.driver, 'remove').yieldsAsync();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt',
        '/etc/file2.txt',
        '/etc/file3.txt'
      ].join('\n'));

      var filenames = [
        '/etc/file1.txt',
        '/etc/file2.txt',
        '/etc/file3.txt'
      ];

      transformer.replace(rule, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  }); // end 'replace'
});
