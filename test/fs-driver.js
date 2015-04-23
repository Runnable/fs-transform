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
var FsDriver = require('../lib/fs-driver');
var fs = require('fs');
var noop = require('101/noop');

describe('fs-driver', function () {
  describe('interface', function() {
    var driver = new FsDriver();

    it('should export the `FsDriver` class', function (done) {
      expect(FsDriver).to.exist();
      expect(typeof FsDriver).to.equal('function');
      done();
    });
  }); // end 'interface'

  describe('constructor', function() {
    it('should construct a new fs driver with a given root', function (done) {
      var root = '/tmp';
      var driver = new FsDriver(root);
      expect(driver.root).to.equal(root);
      done();
    });

    it('should remove trailing slash from given root', function (done) {
      var driver = new FsDriver('/tmp/');
      expect(driver.root).to.equal('/tmp');
      done();
    });

    it('should use the current working directory if no root was given', function (done) {
      var driver = new FsDriver();
      expect(driver.root).to.equal(process.cwd());
      done();
    });
  });

  describe('absolutePath', function () {
    var driver = new FsDriver('/tmp');

    it('should return an absolute path for a relative path', function (done) {
      expect(driver.absolutePath('foo.txt'))
        .to.equal('/tmp/foo.txt');
      expect(driver.absolutePath('./../neat.txt'))
        .to.equal('/tmp/./../neat.txt');
      done();
    });

    it('should return the same path for an absolute path', function (done) {
      expect(driver.absolutePath('/this/path'))
        .to.equal('/this/path');
      expect(driver.absolutePath('/etc/init.d/../foo'))
        .to.equal('/etc/init.d/../foo');
      done();
    });

    it('should return null if given a non string path', function(done) {
      expect(driver.absolutePath()).to.be.null();
      expect(driver.absolutePath(undefined)).to.be.null();
      expect(driver.absolutePath(null)).to.be.null();
      expect(driver.absolutePath({})).to.be.null();
      expect(driver.absolutePath(42)).to.be.null();
      done();
    });
  }); // end 'absolutePath'

  describe('file system', function () {
    var driver = new FsDriver('/tmp');

    beforeEach(function (done) {
      sinon.stub(childProcess, 'exec').yields();
      done();
    });

    afterEach(function (done) {
      childProcess.exec.restore();
      done();
    });

    describe('move', function() {
      it('should return the move command', function(done) {
        var command = "mv /tmp/foo /tmp/bar";
        expect(driver.move('foo', 'bar', noop)).to.equal(command);
        done();
      });

      it('should execute system `mv` when moving a file', function (done) {
        var source = 'a.txt';
        var dest = 'b.txt';
        driver.move(source, dest, function (err) {
          if (err) { return done(err); }
          var command = 'mv /tmp/' + source + ' /tmp/' + dest;
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should yield `exec` errors to the given callback', function (done) {
        childProcess.exec.yields(new Error('Error'));
        driver.move('foo', 'bar', function (err) {
          expect(err).to.exist();
          done();
        });
      });
    }); // end 'move'

    describe('copy', function() {
      it('should return the copy command', function(done) {
        var command = "cp /tmp/foo /tmp/bar";
        expect(driver.copy('foo', 'bar', noop)).to.equal(command);
        done();
      });

      it('should execute system `cp` when copying a file', function (done) {
        var source = 'a.txt';
        var dest = 'b.txt';
        driver.copy(source, dest, function (err) {
          if (err) { return done(err); }
          var command = 'cp /tmp/' + source + ' /tmp/' + dest;
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should yield `exec` errors to the given callback', function (done) {
        childProcess.exec.yields(new Error('Error'));
        driver.copy('foo', 'bar', function (err) {
          expect(err).to.exist();
          done();
        });
      });
    }); // end 'copy'

    describe('grep', function() {
      it('should return the grep command', function(done) {
        var command = 'grep -rn "search" /tmp';
        expect(driver.grep('search', noop)).to.equal(command);
        done();
      });

      it('should execute system `grep`', function (done) {
        driver.grep('foo', function (err) {
          if (err) { return done(err); }
          var command = 'grep -rn "foo" /tmp';
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should properly escape search patterns', function(done) {
        driver.grep('\\lambda"', function (err) {
          if (err) { return done(err); }
          var command = 'grep -rn "\\\\\\\\lambda\\\\"" /tmp';
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should yield `exec` errors to the given callback', function (done) {
        childProcess.exec.yields(new Error('Error'));
        driver.grep('foo', function (err) {
          expect(err).to.exist();
          done();
        });
      });
    }); // end 'grep'

    describe('sed', function() {
      it('should return the correct sed command', function(done) {
        var command = 'sed -i "" "1337s/bar/baz/g" /tmp/file1.txt';
        expect(driver.sed('bar', 'baz', 'file1.txt', 1337, noop))
          .to.equal(command);
        done();
      });

      it('should execute system `sed`', function(done) {
        driver.sed('foo', 'bar', 'example.txt', 20, function (err) {
          if (err) { return done(err); }
          var command = 'sed -i "" "20s/foo/bar/g" /tmp/example.txt';
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should properly escape search and replace', function(done) {
        driver.sed('/foo', '/bar', 'example.txt', 17, function (err) {
          if (err) { return done(err); }
          var command = 'sed -i "" "17s/\\/foo/\\/bar/g" /tmp/example.txt';
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should yield `exec` errors to the given callback', function(done) {
        childProcess.exec.yields(new Error('Error'));
        driver.sed('foo', 'bar', 'awesome.txt', 28, function (err) {
          expect(err).to.exist();
          done();
        });
      });
    }); // end 'sed'

    describe('exists', function() {
      it('should use `fs.existsSync` to perform the check', function(done) {
        var stub = sinon.stub(fs, 'existsSync');
        driver.exists('example');
        expect(stub.calledOnce);
        expect(stub.calledWith('/tmp/example'));
        fs.existsSync.restore();
        done();
      });

      it('should return the result of `fs.existsSync`', function (done) {
        var stub = sinon.stub(fs, 'existsSync')
          .withArgs('/tmp/example').returns(true)
          .withArgs('/full/path').returns(false);
        expect(driver.exists('example')).to.be.true();
        expect(driver.exists('/full/path')).to.be.false();
        fs.existsSync.restore();
        done();
      });
    });
  }); // end 'file system'
}); // end 'fs-driver'
