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

    it('should use the empty string if no root was given', function (done) {
      var driver = new FsDriver();
      expect(driver.root).to.equal('');
      done();
    });
  });

  describe('_absolutePath', function () {
    var driver = new FsDriver('/tmp');

    it('should return an absolute path for a relative path', function (done) {
      expect(driver._absolutePath('foo.txt'))
        .to.equal('/tmp/foo.txt');
      expect(driver._absolutePath('./../neat.txt'))
        .to.equal('/tmp/./../neat.txt');
      done();
    });

    it('should return the same path for an absolute path', function (done) {
      expect(driver._absolutePath('/this/path'))
        .to.equal('/this/path');
      expect(driver._absolutePath('/etc/init.d/../foo'))
        .to.equal('/etc/init.d/../foo');
      done();
    });
  }); // end '_absolutePath'

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
      it('should execute system `grep`', function (done) {
        driver.grep('foo', function (err) {
          if (err) { return done(err); }
          var command = 'grep -rn foo /tmp';
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should properly escape search patterns', function(done) {
        driver.grep('\\lambda', function (err) {
          if (err) { return done(err); }
          var command = 'grep -rn \\\\lambda /tmp';
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
  }); // end 'file system'
}); // end 'fs-driver'
