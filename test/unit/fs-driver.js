'use strict'

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
var FsDriver = require('../../lib/fs-driver')
var fs = require('fs')

describe('fs-driver', () => {
  describe('escape', () => {
    it('should convert non-strings into strings', (done) => {
      expect(FsDriver.escape({})).to.be.a.string()
      done()
    })

    it('should escape single quotes', (done) => {
      expect(FsDriver.escape('\'')).to.equal('\'"\'"\'')
      done()
    })

    it('should escape forward slashes', (done) => {
      expect(FsDriver.escape('/')).to.equal('\\/')
      done()
    })

    it('should escape back slahes', (done) => {
      expect(FsDriver.escape('\\')).to.equal('\\\\')
      done()
    })
  })

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

  describe('escapePath', () => {
    var driver = new FsDriver('/tmp')

    it('should return nothing if not given a string', (done) => {
      expect(driver.escapePath([])).to.equal('')
      done()
    })

    it('should remove single quotes', (done) => {
      expect(driver.escapePath('wowie\'s')).to.match(/wowies/)
      done()
    })

    it('should wrap the path in single quotes', (done) => {
      expect(driver.escapePath('/tmp/neato')).to.equal('\'/tmp/neato\'')
      done()
    })
  }) // end 'escapePath'

  describe('setup', () => {
    var driver
    beforeEach((done) => {
      driver = new FsDriver('/tmp')
      sinon.stub(driver, 'createWorkingDirectory').yieldsAsync()
      sinon.stub(driver, 'createResultsDirectory').yieldsAsync()
      driver.setup(done)
    })

    it('should create the working directory', (done) => {
      expect(driver.createWorkingDirectory.calledOnce).to.be.true()
      done()
    })

    it('should create the results directory', (done) => {
      expect(driver.createResultsDirectory.calledOnce).to.be.true()
      done()
    })
  }) // end 'setup'

  describe('teardown', () => {
    var driver
    var rootPath
    var backupPath
    var workingPath
    var resultsPath

    beforeEach((done) => {
      driver = new FsDriver('/tmp')
      driver.workingPath = '/omg'
      driver.resultsPath = '/wow'
      sinon.stub(driver, 'exec').yieldsAsync()
      rootPath = driver.root
      backupPath = driver.root + '.bak'
      workingPath = driver.workingPath
      resultsPath = driver.resultsPath
      done()
    })

    describe('with commit', () => {
      beforeEach((done) => {
        driver.teardown(true, done)
      })

      it('should commit changes to the root directory', (done) => {
        expect(driver.exec.callCount).to.equal(3)
        expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
          'mv', [rootPath, backupPath]
        ])
        expect(driver.exec.secondCall.args.slice(0, 2)).to.deep.equal([
          'mv', [workingPath, rootPath]
        ])
        expect(driver.exec.thirdCall.args.slice(0, 2)).to.deep.equal([
          'rm', ['-rf', backupPath, resultsPath]
        ])
        done()
      })
    }) // end 'on commit'

    describe('without commit', () => {
      beforeEach((done) => { driver.teardown(false, done) })

      it('should execute the correct commands', (done) => {
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
          'rm', ['-rf', workingPath, resultsPath]
        ])
        done()
      })
    }) // end 'on commit'
  }) // end 'teardown'

  describe('createWorkingDirectory', () => {
    var driver
    var root = '/tmp/wow'
    var workingPath

    beforeEach((done) => {
      driver = new FsDriver(root)
      sinon.stub(driver, 'exec').yieldsAsync()
      sinon.stub(driver, 'exists')
      sinon.stub(Math, 'random').returns('0.9')
      workingPath = '/tmp/.wow.fs-work.900000'
      done()
    })

    afterEach((done) => {
      Math.random.restore()
      done()
    })

    it('should not create if already exists', (done) => {
      driver.workingPath = 'wowzoa'
      driver.createWorkingDirectory((err) => {
        expect(err).to.not.exist()
        expect(driver.exec.callCount).to.equal(0)
        done()
      })
    })

    it('should copy the root directory to working directory', (done) => {
      const source = driver.root
      const dest = workingPath
      driver.createWorkingDirectory((err) => {
        expect(err).to.not.exist()
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
          'cp', ['-r', source, dest]
        ])
        done()
      })
    })

    it('should correctly set the working path', (done) => {
      driver.createWorkingDirectory((err) => {
        expect(err).to.not.exist()
        expect(driver.workingPath).to.equal(workingPath)
        done()
      })
    })

    it('should not overwrite existing working directories', (done) => {
      driver.exists
        .onFirstCall().returns(true)
        .onSecondCall().returns(false)
      Math.random
        .onFirstCall().returns(0.9)
        .onSecondCall().returns(0.8)
      let secondWorkingPath = '/tmp/.wow.fs-work.800000'
      driver.createWorkingDirectory((err) => {
        expect(err).to.not.exist()
        expect(driver.workingPath).to.equal(secondWorkingPath)
        done()
      })
    })
  }) // end 'createWorkingDirectory'

  describe('createResultsDirectory', () => {
    var driver

    beforeEach((done) => {
      driver = new FsDriver('/tmp/neat')
      sinon.stub(driver, 'exec').yieldsAsync()
      done()
    })

    it('should do nothing if the results directory exists', (done) => {
      driver.resultsPath = 'toteshere'
      driver.createResultsDirectory((err) => {
        expect(err).to.not.exist()
        expect(driver.exec.callCount).to.equal(0)
        done()
      })
    })

    it('should error if the working directory does not exist', (done) => {
      driver.workingPath = null
      driver.createResultsDirectory((err) => {
        expect(err).to.exist()
        expect(err.message).to.match(/Cannot create/i)
        expect(driver.exec.callCount).to.equal(0)
        done()
      })
    })

    it('should create the correct results directory', (done) => {
      driver.workingPath = '/tmp/workingPath.123'
      let source = driver.workingPath
      let dest = driver.workingPath + '.results'
      driver.createResultsDirectory((err) => {
        expect(err).to.not.exist()
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
          'cp', ['-r', source, dest]
        ])
        done()
      })
    })

    it('should set the correct results directory', (done) => {
      driver.workingPath = '/tmp/workingPath.123'
      let resultsPath = driver.workingPath + '.results'
      driver.createResultsDirectory((err) => {
        expect(err).to.not.exist()
        expect(driver.resultsPath).to.equal(resultsPath)
        done()
      })
    })
  }) // end 'createResultsDirectory'

  describe('commitResults', () => {
    var driver

    beforeEach((done) => {
      driver = new FsDriver('/wow')
      driver.workingPath = '/tmp/working'
      driver.resultsPath = '/tmp/results'
      sinon.stub(driver, 'exec').yieldsAsync()
      done()
    })

    it('should commit the results directory to the working directory', (done) => {
      driver.commitResults((err) => {
        expect(err).to.not.exist()
        expect(driver.exec.calledTwice).to.be.true()
        expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
          'rm', ['-rf', driver.workingPath]
        ])
        expect(driver.exec.secondCall.args.slice(0, 2)).to.deep.equal([
          'cp', ['-r', driver.resultsPath, driver.workingPath]
        ])
        done()
      })
    })
  }) // end 'commitResults'

  describe('absoluteResultsPath', () => {
    var driver = new FsDriver('/tmp')

    it('should return an absolute path for a relative path', (done) => {
      expect(driver.absoluteResultsPath('foo.txt'))
        .to.equal('/tmp/foo.txt')
      expect(driver.absoluteResultsPath('./../neat.txt'))
        .to.equal('/tmp/./../neat.txt')
      done()
    })

    it('should return the same path for an absolute path', (done) => {
      expect(driver.absoluteResultsPath('/this/path'))
        .to.equal('/this/path')
      expect(driver.absoluteResultsPath('/etc/init.d/../foo'))
        .to.equal('/etc/init.d/../foo')
      done()
    })

    it('should return null if given a non string path', (done) => {
      expect(driver.absoluteResultsPath()).to.be.null()
      expect(driver.absoluteResultsPath(undefined)).to.be.null()
      expect(driver.absoluteResultsPath(null)).to.be.null()
      expect(driver.absoluteResultsPath({})).to.be.null()
      expect(driver.absoluteResultsPath(42)).to.be.null()
      done()
    })

    it('should use the results path if one is present', (done) => {
      expect(driver.absoluteResultsPath('foo')).to.equal('/tmp/foo')
      driver.resultsPath = '/etc'
      expect(driver.absoluteResultsPath('foo')).to.equal('/etc/foo')
      done()
    })
  }) // end 'absoluteResultsPath'

  describe('absoluteWorkingPath', () => {
    var driver = new FsDriver('/tmp')

    it('should return an absolute path for a relative path', (done) => {
      expect(driver.absoluteWorkingPath('foo.txt'))
        .to.equal('/tmp/foo.txt')
      expect(driver.absoluteWorkingPath('./../neat.txt'))
        .to.equal('/tmp/./../neat.txt')
      done()
    })

    it('should return the same path for an absolute path', (done) => {
      expect(driver.absoluteWorkingPath('/this/path'))
        .to.equal('/this/path')
      expect(driver.absoluteWorkingPath('/etc/init.d/../foo'))
        .to.equal('/etc/init.d/../foo')
      done()
    })

    it('should return null if given a non string path', (done) => {
      expect(driver.absoluteWorkingPath()).to.be.null()
      expect(driver.absoluteWorkingPath(undefined)).to.be.null()
      expect(driver.absoluteWorkingPath(null)).to.be.null()
      expect(driver.absoluteWorkingPath({})).to.be.null()
      expect(driver.absoluteWorkingPath(42)).to.be.null()
      done()
    })

    it('should use the results path if one is present', (done) => {
      expect(driver.absoluteWorkingPath('foo')).to.equal('/tmp/foo')
      driver.workingPath = '/etc'
      expect(driver.absoluteWorkingPath('foo')).to.equal('/etc/foo')
      done()
    })
  }) // end 'absoluteResultsPath'

  describe('exec', () => {
    var driver = new FsDriver('/root/dir')

    beforeEach((done) => {
      sinon.stub(childProcess, 'execFile').yieldsAsync()
      done()
    })

    afterEach((done) => {
      childProcess.execFile.restore()
      done()
    })

    it('should execute the given command', (done) => {
      driver.exec('cp', ['wow', 'neat'], (err) => {
        expect(err).to.not.exist()
        expect(childProcess.execFile.calledOnce).to.be.true()
        expect(childProcess.execFile.firstCall.args.slice(0, 2)).to.deep.equal([
          'cp', ['wow', 'neat']
        ])
        done()
      })
    })

    it('should provide the command in the callback', (done) => {
      var expected = 'cp gnarly brah'
      driver.exec('cp', ['gnarly', 'brah'], (err, output, command) => {
        expect(err).to.not.exist()
        expect(command).to.equal(expected)
        done()
      })
    })

    it('should replace results paths with root in returned commands', (done) => {
      var expected = 'command /root/dir/a /root/dir/b /root/dir/c'
      driver.resultsPath = '/work/dir'
      driver.exec(
        'command',
        ['/work/dir/a', '/work/dir/b', '/work/dir/c'],
        (err, output, command) => {
          expect(err).to.not.exist()
          expect(command).to.equal(expected)
          delete driver.working
          done()
        }
      )
    })

    it('should yield childProcess.exec errors to the callback', (done) => {
      var error = new Error('Some error')
      childProcess.execFile.yieldsAsync(error)
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
        expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
          'which', ['foo']
        ])
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
      driver.move('foo', 'bar', () => {
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
          'mv', ['/tmp/foo', '/tmp/bar']
        ])
        done()
      })
    })

    it('should use driver.exec to perform file copies', (done) => {
      driver.copy('foo', 'bar', () => {
        expect(driver.exec.calledOnce).to.be.true()
        expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
          'cp', ['/tmp/foo', '/tmp/bar']
        ])
        done()
      })
    })

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
        const a = '/file/a'
        const b = '/file/b'

        driver.diff(a, b, (err) => {
          expect(err).to.not.exist()
          expect(driver.exec.calledOnce).to.be.true()
          expect(driver.exec.firstCall.args.slice(0, 2)).to.deep.equal([
            'diff', ['-u', '-r', a, b]
          ])
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
        var absoluteDiff = driver.workingPath + '\n' + driver.root + '\n'
        driver.exec.yieldsAsync(null, absoluteDiff, 'command')
        driver.diff('a', 'b', (err, diff) => {
          expect(err).to.not.exist()
          expect(diff.indexOf(driver.workingPath)).to.equal(-1)
          expect(diff.indexOf(driver.root)).to.equal(-1)
          done()
        })
      })
    }) // end 'diff'

    it('should call `diff` when computing the `workingDiff`', (done) => {
      sinon.stub(driver, 'diff').yieldsAsync()
      driver.workingDiff((err, result) => {
        if (err) { return done(err) }
        expect(driver.diff.calledWith(driver.root, driver.workingPath))
          .to.be.true()
        done()
      })
    })

    it('should call `diff` when computing the `resultsDiff`', (done) => {
      sinon.stub(driver, 'diff').yieldsAsync()
      driver.resultsDiff((err, result) => {
        if (err) { return done(err) }
        expect(driver.diff.calledWith(driver.workingPath, driver.resultsPath))
          .to.be.true()
        done()
      })
    })
  }) // end 'file system'
}) // end 'fs-driver'
