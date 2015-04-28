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
    var driver;

    beforeEach(function (done) {
      driver = new FsDriver('/root/dir');
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

    it('should return the command', function(done) {
      var command = 'cp gnarly brah';
      expect(driver.exec(command, noop)).to.equal(command);
      done();
    });

    it('should replace working paths with root in returned commands', function(done) {
      var command = 'command /root/dir/a /root/dir/b /root/dir/c';
      var execute = 'command /work/dir/a /work/dir/b /work/dir/c'
      driver.working = '/work/dir';
      expect(driver.exec(execute, noop)).to.equal(command);
      done();
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
      sinon.stub(childProcess, 'exec').yieldsAsync();
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
        var command = 'grep -rn \'search\' /tmp';
        expect(driver.grep('search', noop)).to.equal(command);
        done();
      });

      it('should execute system `grep`', function (done) {
        driver.grep('foo', function (err) {
          if (err) { return done(err); }
          var command = 'grep -rn \'foo\' /tmp';
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should properly escape search patterns', function(done) {
        driver.grep('\\lambda\'', function (err) {
          if (err) { return done(err); }
          var command = 'grep -rn \'\\\\lambda\\\'\' /tmp';
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

      it('should use the working directory when one is supplied', function(done) {
        var command = 'grep -rn \'search\' /working';
        driver.working = '/working';
        sinon.stub(driver, 'exec').yieldsAsync();
        driver.grep('search', function (err) {
          if (err) { return done(err); }
          expect(driver.exec.calledWith(command)).to.be.true();
          driver.exec.restore();
        });
        done();
      });
    }); // end 'grep'

    describe('sed', function() {
      it('should return the correct sed command', function(done) {
        var expected = 'sed -i.last \'1337s/bar/baz/g\' /tmp/file1.txt';
        var actual = driver.sed('bar', 'baz', 'file1.txt', 1337, noop);
        expect(actual).to.equal(expected);
        done();
      });

      it('should execute system `sed`', function(done) {
        driver.sed('foo', 'bar', 'example.txt', 20, function (err) {
          if (err) { return done(err); }
          var command = 'sed -i.last \'20s/foo/bar/g\' /tmp/example.txt';
          expect(childProcess.exec.calledWith(command))
            .to.be.true();
          done();
        });
      });

      it('should properly escape search and replace', function(done) {
        driver.sed('/foo', '/bar', 'example.txt', 17, function (err) {
          if (err) { return done(err); }
          var command = 'sed -i.last \'17s/\\/foo/\\/bar/g\' /tmp/example.txt';
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
      it('should return the correct diff command', function (done) {
        var command = driver.diff('/tmp/a', '/tmp/b', function (err) {
          if (err) { return done(err); }
          expect(command).to.equal('diff -u /tmp/a /tmp/b');
          done();
        });
      });

      it('should execute system diff', function (done) {
        driver.diff('/tmp/a', '/tmp/b', function (err) {
          expect(childProcess.exec.calledWith('diff -u /tmp/a /tmp/b'))
            .to.be.true();
          done();
        });
      });

      it('should ignore errors with code 1 (indicated differences)', function (done) {
        var error = new Error('diff error');
        error.code = 1;
        childProcess.exec.yields(error);
        driver.diff('a', 'b', function (err) {
          expect(err).to.be.null();
          done();
        });
      });

      it('should yield errors with code > 1 to the given callback', function (done) {
        var error = new Error('diff error');
        error.code = 2;
        childProcess.exec.yields(error);
        driver.diff('a', 'b', function (err) {
          expect(err).to.equal(error);
          done();
        });
      });
    }); // end 'diff'

    describe('remove', function() {
      it('should return the correct remove command', function(done) {
        var command = 'rm /tmp/file1.txt';
        expect(driver.remove('file1.txt', noop)).to.equal(command);
        done();
      });

      it('should execute system `rm`', function(done) {
        driver.remove('file', function (err) {
          if (err) { return done(err); }
          expect(childProcess.exec.calledWith('rm /tmp/file')).to.be.true();
          done();
        });
      });

      it('should yield errors to the given callback', function(done) {
        var error = new Error('Remove error');
        childProcess.exec.yields(error);
        driver.remove('file', function (err) {
          expect(err).to.equal(error);
          done();
        });
      });
    }); // end 'remove'

    describe('removeRecursive', function() {
      it('should return the correct remove command', function(done) {
        var command = 'rm -rf /tmp/file1/';
        expect(driver.removeRecursive('file1/', noop)).to.equal(command);
        done();
      });

      it('should execute system `rm -rf`', function(done) {
        driver.removeRecursive('file', function (err) {
          if (err) { return done(err); }
          expect(childProcess.exec.calledWith('rm -rf /tmp/file')).to.be.true();
          done();
        });
      });

      it('should yield errors to the given callback', function(done) {
        var error = new Error('Remove error');
        childProcess.exec.yields(error);
        driver.removeRecursive('file', function (err) {
          expect(err).to.equal(error);
          done();
        });
      });
    }); // end 'removeRecursive'

    describe('createWorkingDirectory', function() {
      beforeEach(function (done) {
        driver.root = '/etc/init.d';
        sinon.stub(driver, 'exists');
        done();
      });

      afterEach(function (done) {
        driver.exists.restore();
        done();
      });

      it('should create a new working directory', function(done) {
        driver.exists.returns(false);
        driver.createWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(driver.working).to.equal('/tmp/.init.d.fs-work.0');
          done();
        });
      });

      it('should not overwrite existing working directories', function(done) {
        driver.exists
          .onFirstCall().returns(true)
          .onSecondCall().returns(true)
          .onThirdCall().returns(false);
        driver.createWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(driver.working).to.equal('/tmp/.init.d.fs-work.2');
          done();
        });
      });

      it('should execute system cp -r to copy the working directory', function(done) {
        var command = 'cp -r /etc/init.d /tmp/.init.d.fs-work.0';
        driver.exists.returns(false);
        driver.createWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(childProcess.exec.calledWith(command)).to.be.true();
          done();
        });
      });

      it('should yield system errors to the supplied callback', function(done) {
        var error = new Error('Errorz');
        childProcess.exec.yields(error);
        driver.createWorkingDirectory(function (err) {
          expect(err).to.equal(error);
          done();
        });
      });
    }); // end 'createWorkingDirectory'

    describe('removeWorkingDirectory', function() {
      it('should remove the working directory', function(done) {
        var removeRecursive = sinon.stub(driver, 'removeRecursive')
          .yieldsAsync();
        driver.working = '/tmp/x';
        driver.removeWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(removeRecursive.calledWith('/tmp/x')).to.be.true();
          expect(driver.working).to.be.null();
          done();
        });
      });

      it('should not remove a working directory if none exists', function(done) {
        driver.working = null;
        driver.removeWorkingDirectory(function (err) {
          if (err) { return done(err); }
          expect(childProcess.exec.callCount).to.equal(0);
          done();
        });
      });

      it('should yield system errors to the supplied callback', function(done) {
        var error = new Error('Remove error');
        childProcess.exec.yields(error);
        driver.working = '/woot/sauce';
        driver.removeWorkingDirectory(function (err) {
          expect(err).to.equal(error);
          done();
        });
      });
    }); // end 'removeWorkingDirectory'
  }); // end 'file system'
}); // end 'fs-driver'
