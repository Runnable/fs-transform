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
var FsDriver = require('../../lib/fs-driver');
var Warning = require('../../lib/warning');

describe('Transformer', function() {
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

    it('should apply global file excludes', function(done) {
      var rule = { search: 'koopa', replace: 'mario' };
      transformer.exclude({ files: ['file2.txt', 'file4.txt'] }, noop);

      var sed = sinon.stub(transformer.driver, 'sed').yields();
      sinon.stub(transformer.driver, 'copy').yields();
      sinon.stub(transformer.driver, 'remove').yields();
      sinon.stub(transformer.driver, 'diff').yields();
      sinon.stub(transformer.driver, 'grep').yields(null, [
        '/etc/file1.txt:23:---',
        '/etc/file2.txt:78:---',
        '/etc/file3.txt:182:---',
        '/etc/file4.txt:3232:---',
        '/etc/suhweet/file4.txt:7:---'
      ].join('\n'));

      transformer.replace(rule, function (err) {
        expect(sed.callCount).to.equal(3);
        expect(sed.calledWith('koopa', 'mario', '/etc/file1.txt', 23))
          .to.be.true();
        expect(sed.calledWith('koopa', 'mario', '/etc/file3.txt', 182))
          .to.be.true();
        expect(sed.calledWith('koopa', 'mario', '/etc/suhweet/file4.txt', 7))
          .to.be.true();
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
        .yieldsAsync(null, null, command);
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
          var dotLastName = name + '.last';
          expect(remove.calledWith(originalName + ' ' + dotLastName))
            .to.be.true();
        });
        done();
      });
    });
  }); // end 'replace'
});
