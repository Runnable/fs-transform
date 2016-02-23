var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var beforeEach = lab.beforeEach
var afterEach = lab.afterEach
var Code = require('code')
var expect = Code.expect
var sinon = require('sinon')
var childProcess = require('child_process')
var FsDriver = require('../lib/fs-driver')
var fs = require('fs')

describe('fs-driver', () => {
  describe('interface', () => {
    it('should export the `FsDriver` class', (done) => {
      expect(FsDriver).to.exist()
      expect(typeof FsDriver).to.equal('function')
      done()
    })
  }) // end 'interface'

  describe('constructor', () => {
    it('should construct a new fs driver with a given root', (done) => {
      var root = '/tmp'
      var driver = new FsDriver(root)
      expect(driver.root).to.equal(root)
      done()
    })

    it('should remove trailing slash from given root', (done) => {
      var driver = new FsDriver('/tmp/')
      expect(driver.root).to.equal('/tmp')
      done()
    })

    it('should use the current working directory if no root was given', (done) => {
      var driver = new FsDriver()
      expect(driver.root).to.equal(process.cwd())
      done()
    })
  })

  describe('escape', () => {
    it('should ignore non-strings', (done) => {
      var x = 0
      var y = {}
      var z = /woo/g
      expect(FsDriver.escape(x)).to.equal(x)
      expect(FsDriver.escape(y)).to.equal(y)
      expect(FsDriver.escape(z)).to.equal(z)
      done()
    })
  })

  describe('absolutePath', () => {
    var driver = new FsDriver('/tmp')

    it('should return an absolute path for a relative path', (done) => {
      expect(driver.absolutePath('foo.txt'))
        .to.equal('/tmp/foo.txt')
      expect(driver.absolutePath('./../neat.txt'))
        .to.equal('/tmp/./../neat.txt')
      done()
    })

    it('should return the same path for an absolute path', (done) => {
      expect(driver.absolutePath('/this/path'))
        .to.equal('/this/path')
      expect(driver.absolutePath('/etc/init.d/../foo'))
        .to.equal('/etc/init.d/../foo')
      done()
    })

    it('should return null if given a non string path', (done) => {
      expect(driver.absolutePath()).to.be.null()
      expect(driver.absolutePath(undefined)).to.be.null()
      expect(driver.absolutePath(null)).to.be.null()
      expect(driver.absolutePath({})).to.be.null()
      expect(driver.absolutePath(42)).to.be.null()
      done()
    })

    it('should use the working directory if one is present', (done) => {
      expect(driver.absolutePath('foo')).to.equal('/tmp/foo')
      driver.working = '/etc'
      expect(driver.absolutePath('foo')).to.equal('/etc/foo')
      done()
    })
  }) // end 'absolutePath'

  describe('exec', () => {
    var driver = new FsDriver('/root/dir')

    beforeEach((done) => {
      sinon.stub(childProcess, 'exec').yieldsAsync()
      done()
    })

    afterEach((done) => {
      childProcess.exec.restore()
      done()
    })

    it('should execute the given command', (done) => {
      var command = 'cp wow neat'
      driver.exec(command, (err) => {
        expect(err).to.not.exist()
        expect(childProcess.exec.calledWith(command)).to.be.true()
        done()
      })
    })

    it('should provide the command in the callback', (done) => {
      var expected = 'cp gnarly brah'
      driver.exec(expected, (err, output, command) => {
        expect(err).to.not.exist()
        expect(command).to.equal(expected)
        done()
      })
    })

    it('should replace working paths with root in returned commands', (done) => {
      var expected = 'command /root/dir/a /root/dir/b /root/dir/c'
      var execute = 'command /work/dir/a /work/dir/b /work/dir/c'
      driver.working = '/work/dir'
      driver.exec(execute, (err, output, command) => {
        expect(err).to.not.exist()
        expect(command).to.equal(expected)
        delete driver.working
        done()
      })
    })

    it('should yield childProcess.exec errors to the callback', (done) => {
      var error = new Error('Some error')
      childProcess.exec.yieldsAsync(error)
      driver.exec('whatever', (err) => {
        expect(err).to.equal(error)
        done()
      })
    })
  }) // end 'exec'

  describe('file system', () => {
    var driver

    beforeEach((done) => {
      driver = new FsDriver('/tmp')
      sinon.stub(driver, 'exec').yieldsAsync()
      done()
    })

    it('should check for commands using driver.exec', (done) => {
      driver.hasCommand('foo', () => {
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.calledWith('command -v foo')).to.be.true()
        done()
      })
    })

    it('should check for all commands using driver.exec', (done) => {
      sinon.stub(driver, 'hasCommand').yieldsAsync()
      driver.hasAllCommands(() => {
        expect(driver.hasCommand.callCount).to.equal(FsDriver.commands.length)
        FsDriver.commands.forEach((name) => {
          expect(driver.hasCommand.calledWith(name)).to.be.true()
        })
        driver.hasCommand.restore()
        done()
      })
    })

    it('should use driver.exec to perform file moves', (done) => {
      var command = 'mv /tmp/foo /tmp/bar'
      driver.move('foo', 'bar', () => {
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.calledWith(command)).to.be.true()
        done()
      })
    })

    it('should use driver.exec to perform file copies', (done) => {
      var command = 'cp /tmp/foo /tmp/bar'
      driver.copy('foo', 'bar', () => {
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.calledWith(command)).to.be.true()
        done()
      })
    })

    describe('grep', () => {
      it('should use driver.exec to perform the grep', (done) => {
        var command = 'grep -rlI \'search\' /tmp'
        driver.grep('search', () => {
          expect(driver.exec.calledOnce).to.be.true()
          expect(driver.exec.calledWith(command)).to.be.true()
          done()
        })
      })

      it('should properly escape search patterns', (done) => {
        driver.grep('\\lambda\'', (err) => {
          if (err) { return done(err) }
          var command = 'grep -rlI \'\\\\lambda\\\'\' /tmp'
          expect(driver.exec.calledWith(command))
            .to.be.true()
          done()
        })
      })

      it('should use the working directory when one is supplied', (done) => {
        var command = 'grep -rlI \'search\' /working'
        driver.working = '/working'
        driver.grep('search', (err) => {
          if (err) { return done(err) }
          expect(driver.exec.calledWith(command)).to.be.true()
          driver.exec.restore()
        })
        done()
      })
    }) // end 'grep'

    describe('sed', () => {
      it('should use driver.exec to perform the sed', (done) => {
        var command = 'sed -i.last \'s/bar/baz/g\' /tmp/file1.txt'
        driver.sed('bar', 'baz', 'file1.txt', () => {
          expect(driver.exec.calledOnce).to.be.true()
          expect(driver.exec.calledWith(command)).to.be.true()
          done()
        })
      })

      it('should properly escape search and replace', (done) => {
        driver.sed('/foo', '/bar', 'example.txt', (err) => {
          if (err) { return done(err) }
          var command = 'sed -i.last \'s/\\/foo/\\/bar/g\' /tmp/example.txt'
          expect(driver.exec.calledWith(command))
            .to.be.true()
          done()
        })
      })
    }) // end 'sed'

    describe('exists', () => {
      it('should use `fs.existsSync` to perform the check', (done) => {
        var stub = sinon.stub(fs, 'existsSync')
        driver.exists('example')
        expect(stub.calledOnce).to.be.true()
        expect(stub.calledWith('/tmp/example')).to.be.true()
        fs.existsSync.restore()
        done()
      })

      it('should return the result of `fs.existsSync`', (done) => {
        sinon.stub(fs, 'existsSync')
          .withArgs('/tmp/example').returns(true)
          .withArgs('/full/path').returns(false)
        expect(driver.exists('example')).to.be.true()
        expect(driver.exists('/full/path')).to.be.false()
        fs.existsSync.restore()
        done()
      })
    }) // end 'exists'

    describe('diff', () => {
      it('should use driver.exec to perform the diff', (done) => {
        driver.exec.yieldsAsync(null, 'diff', 'command')
        var command = 'diff -u -r /tmp/a /tmp/b'
        driver.diff('/tmp/a', '/tmp/b', (err) => {
          expect(err).to.not.exist()
          expect(driver.exec.calledOnce).to.be.true()
          expect(driver.exec.calledWith(command)).to.be.true()
          done()
        })
      })

      it('should ignore errors with code 1 (indicated differences)', (done) => {
        var error = new Error('diff error')
        error.code = 1
        driver.exec.yieldsAsync(error, 'diff', 'command')
        driver.diff('a', 'b', (err) => {
          expect(err).to.be.null()
          done()
        })
      })

      it('should yield errors with code > 1 to the given callback', (done) => {
        var error = new Error('diff error')
        error.code = 2
        driver.exec.yields(error)
        driver.diff('a', 'b', (err) => {
          expect(err).to.equal(error)
          done()
        })
      })

      it('should have paths that are relative to the root directory', (done) => {
        var absoluteDiff = driver.working + '\n' + driver.root + '\n'
        driver.exec.yieldsAsync(null, absoluteDiff, 'command')
        driver.diff('a', 'b', (err, diff) => {
          expect(err).to.not.exist()
          expect(diff.indexOf(driver.working)).to.equal(-1)
          expect(diff.indexOf(driver.root)).to.equal(-1)
          done()
        })
      })
    }) // end 'diff'

    it('should call `diff` when computing the `workingDiff`', (done) => {
      sinon.stub(driver, 'diff').yieldsAsync()
      driver.workingDiff((err, result) => {
        if (err) { return done(err) }
        expect(driver.diff.calledWith(driver.root, driver.working))
          .to.be.true()
        done()
      })
    })

    it('should use driver.exec to remove files', (done) => {
      var command = 'rm /tmp/file1.txt'
      driver.remove('file1.txt', () => {
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.calledWith(command)).to.be.true()
        done()
      })
    })

    it('should use driver.exec to recursively remove files', (done) => {
      var command = 'rm -rf /tmp/dir/'
      driver.removeRecursive('dir/', () => {
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.calledWith(command)).to.be.true()
        done()
      })
    })

    describe('findWorkingDirectory', () => {
      beforeEach((done) => {
        driver.root = '/etc/init.d'
        sinon.stub(driver, 'exists')
        sinon.stub(Math, 'random')
          .onFirstCall().returns(0)
          .onSecondCall().returns(1)
          .onThirdCall().returns(2)
        done()
      })

      afterEach((done) => {
        Math.random.restore()
        done()
      })

      it('should find a new working directory', (done) => {
        driver.exists.returns(false)
        var working = driver.findWorkingDirectory()
        expect(Math.random.calledOnce).to.be.true()
        expect(working).to.equal('/tmp/.init.d.fs-work.0')
        done()
      })

      it('should not attempt to use a working directory that already exists', (done) => {
        driver.exists
          .onFirstCall().returns(true)
          .onSecondCall().returns(true)
          .onThirdCall().returns(false)
        expect(driver.findWorkingDirectory())
          .to.equal('/tmp/.init.d.fs-work.2')
        done()
      })
    })

    describe('createWorkingDirectory', () => {
      beforeEach((done) => {
        driver.root = '/etc/init.d'
        sinon.stub(driver, 'exists').returns(false)
        sinon.stub(Math, 'random').returns(0)
        done()
      })

      afterEach((done) => {
        Math.random.restore()
        done()
      })

      it('should set the working directory', (done) => {
        driver.createWorkingDirectory((err) => {
          if (err) { return done(err) }
          expect(driver.working).to.equal('/tmp/.init.d.fs-work.0')
          done()
        })
      })

      it('should create the working directory with driver.exec', (done) => {
        var command = 'cp -r /etc/init.d /tmp/.init.d.fs-work.0'
        driver.createWorkingDirectory((err) => {
          if (err) { return done(err) }
          expect(driver.exec.calledWith(command)).to.be.true()
          done()
        })
      })

      it('should yield system errors to the supplied callback', (done) => {
        var error = new Error('Errorz')
        driver.exec.yields(error)
        driver.createWorkingDirectory((err) => {
          expect(err).to.equal(error)
          done()
        })
      })
    }) // end 'createWorkingDirectory'

    describe('removeWorkingDirectory', () => {
      beforeEach((done) => {
        sinon.stub(driver, 'removeRecursive').yieldsAsync()
        done()
      })

      afterEach((done) => {
        driver.removeRecursive.restore()
        done()
      })

      it('should remove the working directory', (done) => {
        driver.working = '/tmp/x'
        driver.removeWorkingDirectory((err) => {
          if (err) { return done(err) }
          expect(driver.removeRecursive.calledWith('/tmp/x')).to.be.true()
          expect(driver.working).to.be.null()
          done()
        })
      })

      it('should not remove a working directory if none exists', (done) => {
        driver.working = null
        driver.removeWorkingDirectory((err) => {
          if (err) { return done(err) }
          expect(driver.removeRecursive.callCount).to.equal(0)
          done()
        })
      })

      it('should yield system errors to the supplied callback', (done) => {
        var error = new Error('Remove error')
        driver.removeRecursive.yields(error)
        driver.working = '/woot/sauce'
        driver.removeWorkingDirectory((err) => {
          expect(err).to.equal(error)
          done()
        })
      })
    }) // end 'removeWorkingDirectory'
  }) // end 'file system'
}) // end 'fs-driver'
