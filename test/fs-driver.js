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

    it('should use the working directory if one is present', function (done) {
      expect(driver.absolutePath('foo')).to.equal('/tmp/foo');
      driver.working = '/etc';
      expect(driver.absolutePath('foo')).to.equal('/etc/foo');
      done();
    })
  }); // end 'absolutePath'

  describe('exec', function () {
    var driver = new FsDriver('/root/dir');

    beforeEach(function (done) {
      sinon.stub(childProcess, 'exec').yieldsAsync();
      done();
    });

    afterEach(function (done) {
      childProcess.exec.restore();
      done();
    });

    it('should execute the given command', function(done) {
      var command = 'cp wow neat';
      driver.exec(command, function (err) {
        expect(childProcess.exec.calledWith(command)).to.be.true();
        done();
      });
    });

    it('should provide the command in the callback', function(done) {
      var expected = 'cp gnarly brah';
      driver.exec(expected, function (err, output, command) {
        expect(command).to.equal(expected);
        done();
      });
    });

    it('should replace working paths with root in returned commands', function(done) {
      var expected = 'command /root/dir/a /root/dir/b /root/dir/c';
      var execute = 'command /work/dir/a /work/dir/b /work/dir/c'
      driver.working = '/work/dir';
      driver.exec(execute, function (err, output, command) {
        expect(command).to.equal(expected);
        delete driver.working;
        done();
      });
    });

    it('should yield childProcess.exec errors to the callback', function(done) {
      var error = new Error('Some error');
      childProcess.exec.yieldsAsync(error);
      driver.exec('whatever', function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  }); // end 'exec'

  describe('file system', function () {
    var driver;

    beforeEach(function (done) {
      driver = new FsDriver('/tmp');
      sinon.stub(driver, 'exec').yieldsAsync();
      done();
    });

    it('should use driver.exec to perform file moves', function (done) {
      var command = "mv /tmp/foo /tmp/bar";
      driver.move('foo', 'bar', function () {
        expect(driver.exec.calledOnce).to.be.true();
        expect(driver.exec.calledWith(command)).to.be.true();
        done();
      });
    });

    it('should use driver.exec to perform file copies', function(done) {
      var command = "cp /tmp/foo /tmp/bar";
      driver.copy('foo', 'bar', function () {
        expect(driver.exec.calledOnce).to.be.true();
        expect(driver.exec.calledWith(command)).to.be.true();
        done();
      });
    });

    describe('grep', function() {
      it('should use driver.exec to perform the grep', function(done) {
        var command = 'grep -rn \'search\' /tmp';
        driver.grep('search', function () {
          expect(driver.exec.calledOnce).to.be.true();
          expect(driver.exec.calledWith(command)).to.be.true();
          done();
        });
      });

      it('should properly escape search patterns', function(done) {
        driver.grep('\\lambda\'', function (err) {
          if (err) { return done(err); }
          var command = 'grep -rn \'\\\\lambda\\\'\' /tmp';
          expect(driver.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should use the working directory when one is supplied', function(done) {
        var command = 'grep -rn \'search\' /working';
        driver.working = '/working';
        driver.grep('search', function (err) {
          if (err) { return done(err); }
          expect(driver.exec.calledWith(command)).to.be.true();
          driver.exec.restore();
        });
        done();
      });
    }); // end 'grep'

    describe('sed', function() {
      it('should use driver.exec to perform the sed', function(done) {
        var command = 'sed -i.last \'1337s/bar/baz/g\' /tmp/file1.txt';
        driver.sed('bar', 'baz', 'file1.txt', 1337, function () {
          expect(driver.exec.calledOnce).to.be.true();
          expect(driver.exec.calledWith(command)).to.be.true();
          done();
        });
      });

      it('should properly escape search and replace', function(done) {
        driver.sed('/foo', '/bar', 'example.txt', 17, function (err) {
          if (err) { return done(err); }
          var command = 'sed -i.last \'17s/\\/foo/\\/bar/g\' /tmp/example.txt';
          expect(driver.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });
    }); // end 'sed'

    describe('exists', function() {
      it('should use `fs.existsSync` to perform the check', function(done) {
        var stub = sinon.stub(fs, 'existsSync');
        driver.exists('example');
        expect(stub.calledOnce).to.be.true();
        expect(stub.calledWith('/tmp/example')).to.be.true();
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
    }); // end 'exists'

    describe('diff', function() {
      it('should use driver.exec to perform the diff', function(done) {
        var command = 'diff -u -r /tmp/a /tmp/b';
        driver.diff('/tmp/a', '/tmp/b', function (err) {
          expect(driver.exec.calledOnce).to.be.true();
          expect(driver.exec.calledWith(command)).to.be.true();
          done();
        });
      });

      it('should ignore errors with code 1 (indicated differences)', function (done) {
        var error = new Error('diff error');
        error.code = 1;
        driver.exec.yields(error);
        driver.diff('a', 'b', function (err) {
          expect(err).to.be.null();
          done();
        });
      });

      it('should yield errors with code > 1 to the given callback', function (done) {
        var error = new Error('diff error');
        error.code = 2;
        driver.exec.yields(error);
        driver.diff('a', 'b', function (err) {
          expect(err).to.equal(error);
          done();
        });
      });
    }); // end 'diff'

    it('should use driver.exec to remove files', function(done) {
      var command = 'rm /tmp/file1.txt';
      driver.remove('file1.txt', function () {
        expect(driver.exec.calledOnce).to.be.true();
        expect(driver.exec.calledWith(command)).to.be.true();
        done();
      });
    });

    it('should use driver.exec to recursively remove files', function(done) {
      var command = 'rm -rf /tmp/dir/';
      driver.removeRecursive('dir/', function () {
        expect(driver.exec.calledOnce).to.be.true();
        expect(driver.exec.calledWith(command)).to.be.true();
        done();
      });
    });

    describe('findWorkingDirectory', function() {
      beforeEach(function (done) {
        driver.root = '/etc/init.d';
        sinon.stub(driver, 'exists');
        sinon.stub(Math, 'random')
          .onFirstCall().returns(0)
          .onSecondCall().returns(1)
          .onThirdCall().returns(2);
        done();
      });

      afterEach(function (done) {
        Math.random.restore();
        done();
      });

      it('should find a new working directory', function(done) {
        driver.exists.returns(false);
        var working = driver.findWorkingDirectory();
        expect(Math.random.calledOnce).to.be.true();
        expect(working).to.equal('/tmp/.init.d.fs-work.0');
        done();
      });

      it('should not attempt to use a working directory that already exists', function(done) {
        driver.exists
          .onFirstCall().returns(true)
          .onSecondCall().returns(true)
          .onThirdCall().returns(false);
        expect(driver.findWorkingDirectory())
          .to.equal('/tmp/.init.d.fs-work.2');
        done();
      });
    });

    describe('createWorkingDirectory', function() {
      beforeEach(function (done) {
        driver.root = '/etc/init.d';
        sinon.stub(driver, 'exists').returns(false);
        sinon.stub(Math, 'random').returns(0);
        done();
      });

      afterEach(function (done) {
        Math.random.restore();
        done();
      });

      it('should set the working directory', function(done) {
        driver.createWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(driver.working).to.equal('/tmp/.init.d.fs-work.0');
          done();
        });
      });

      it('should create the working directory with driver.exec', function (done) {
        var command = 'cp -r /etc/init.d /tmp/.init.d.fs-work.0';
        driver.createWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(driver.exec.calledWith(command)).to.be.true();
          done();
        });
      });

      it('should yield system errors to the supplied callback', function(done) {
        var error = new Error('Errorz');
        driver.exec.yields(error);
        driver.createWorkingDirectory(function (err) {
          expect(err).to.equal(error);
          done();
        });
      });
    }); // end 'createWorkingDirectory'

    describe('removeWorkingDirectory', function() {
      beforeEach(function (done) {
        sinon.stub(driver, 'removeRecursive').yieldsAsync();
        done();
      });

      afterEach(function (done) {
        driver.removeRecursive.restore();
        done();
      });

      it('should remove the working directory', function(done) {
        driver.working = '/tmp/x';
        driver.removeWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(driver.removeRecursive.calledWith('/tmp/x')).to.be.true();
          expect(driver.working).to.be.null();
          done();
        });
      });

      it('should not remove a working directory if none exists', function(done) {
        driver.working = null;
        driver.removeWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(driver.removeRecursive.callCount).to.equal(0);
          done();
        });
      });

      it('should yield system errors to the supplied callback', function(done) {
        var error = new Error('Remove error');
        driver.removeRecursive.yields(error);
        driver.working = '/woot/sauce';
        driver.removeWorkingDirectory(function (err) {
          expect(err).to.equal(error);
          done();
        });
      });
    }); // end 'removeWorkingDirectory'
  }); // end 'file system'
}); // end 'fs-driver'
