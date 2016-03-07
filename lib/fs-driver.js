'use strict'

var async = require('async')
var childProcess = require('child_process')
var exists = require('101/exists')
var fs = require('fs')
var isString = require('101/is-string')
var last = require('101/last')
var path = require('path')
var Promise = require('bluebird')

/**
 * Creates a new FsDriver that performs operations relative to a given root
 * directory.
 *
 * @example
 * // Create a new filesystem driver relative to /tmp
 * var driver = new FsDriver('/tmp')
 *
 * @class
 * @author Ryan Sandor Richards
 */
class FsDriver {
  /**
   * Escapes a string for use in a command.
   * @param {string} str String to escape.
   * @return {string} The command line escaped string.
   */
  static escape (str) {
    if (!isString(str)) {
      str = str.toString()
    }
    return str.replace(/(['/\\])/g, '\\$1')
  }

  /**
   * Creates a new filesystem driver.
   * @param {string} root Path to use for operations.
   */
  constructor (root) {
    if (!root) {
      root = ''
    }

    if (last(root) === '/') {
      this.root = path.resolve(root.substr(0, root.length - 1))
    } else {
      this.root = path.resolve(root)
    }

    this.workingPath = null
    this.resultsPath = null

    Promise.promisifyAll(this)
  }

  /**
   * Escapes strings for use in paths via shell commands. Roughly this simply
   * removes all inner single quotes and wraps the path in single quotes.
   * @param {string} file Path to the file
   * @return {string} The escaped and single quoted path to the file.
   */
  escapePath (file) {
    if (!isString(file)) {
      return ''
    }
    return `'${file.replace(/[']/g, '')}'`
  }

  /**
   * Sets up the working and results directory for the driver.
   * @param  {Function} cb Called when setup is complete.
   */
  setup (cb) {
    async.series([
      this.createWorkingDirectory.bind(this),
      this.createResultsDirectory.bind(this)
    ], cb)
  }

  /**
   * Tears down the working and results directories.
   * @param  {boolean} commit Whether or not to commit changes to the original
   *   root directory.
   * @param  {Function} cb Callback to execute when the teardown is complete.
   */
  teardown (commit, cb) {
    const rootPath = this.root
    const backupPath = this.root + '.bak'
    const workingPath = this.workingPath
    const resultsPath = this.resultsPath

    if (commit) {
      this.execAsync('mv', [rootPath, backupPath])
        .then(() => {
          return this.execAsync('mv', [workingPath, rootPath])
        })
        .then(() => {
          return this.execAsync('rm', ['-rf', backupPath, resultsPath])
        })
        .asCallback(cb)
    } else {
      this.exec('rm', ['-rf', workingPath, resultsPath], cb)
    }
  }

  /**
   * Creates the initial working directory as a copy of the root directory. This
   * method has no effect if there is already a working directory.
   * @param  {Function} cb Called when the directory has been created.
   */
  createWorkingDirectory (cb) {
    if (exists(this.workingPath)) {
      return cb()
    }

    let rootName = last(this.root.split('/'))
    let workingPath = '/tmp/.' + rootName + '.fs-work'
    let n = parseInt(1000000 * Math.random())
    while (this.exists(workingPath + '.' + n)) {
      n = parseInt(1000000 * Math.random())
    }
    this.workingPath = workingPath + '.' + n

    const source = this.root
    const dest = this.workingPath
    this.exec('cp', ['-r', source, dest], cb)
  }

  /**
   * Creates the initial results directory to use for handling find and replace.
   * @param  {Function} cb Called when the results directory has been created.
   */
  createResultsDirectory (cb) {
    if (exists(this.resultsPath)) {
      return cb()
    }

    if (!exists(this.workingPath)) {
      return cb(new Error(
        'Cannot create a results directory without a working directory'
      ))
    }
    this.resultsPath = `${this.workingPath}.results`

    const source = this.workingPath
    const dest = this.resultsPath
    this.exec('cp', ['-r', source, dest], cb)
  }

  /**
   * Commits the changes made to the results directory back to the working
   * directory.
   * @param  {Function} cb Called when the changes have been committed.
   */
  commitResults (cb) {
    const workingPath = this.workingPath
    const resultsPath = this.resultsPath
    this.execAsync('rm', ['-rf', workingPath])
      .then(() => {
        return this.execAsync('cp', ['-r', resultsPath, workingPath])
      })
      .asCallback(cb)
  }

  /**
   * Performs a diff over two given paths.
   * @param {string} a First path.
   * @param {string} b Second path.
   * @param {function} cb Callback to execute with the diff results.
   */
  diff (a, b, cb) {
    var self = this
    this.exec('diff', ['-u', '-r', a, b], function (err, diff, scriptCommand) {
      // `diff` returns 1 when there are differences and > 1 on failure
      if (err && err.code > 1) { return cb(err) }

      // Diff file references need to be relative to the root (left means
      // before transform rule is applied, right means after)
      cb(null, self.stripAbsolutePaths(diff), scriptCommand)
    })
  }

  /**
   * Returns a full diff between the working directory and the root directory.
   * @param {fs-driver~ExecCallback} cb Callback to execute after performing the
   *   diff.
   */
  workingDiff (cb) {
    this.diff(this.root, this.workingPath, cb)
  }

  /**
   * Returns a full diff between the result directory and the working directory.
   * @param  {Function} cb Called with the results of the diff.
   */
  resultsDiff (cb) {
    this.diff(this.workingPath, this.resultsPath, cb)
  }

  /**
   * Makes a relative path absolute to the root directory of the driver. Returns
   * the original path if it is already absolute.
   *
   * @example
   * var driver = new FsDriver('/root/dir')
   * // returns '/root/dir/example.txt'
   * driver.absolutePath('example.txt')
   *
   * // returns '/awesome/sauce' (already an absolute path)
   * driver.absolutePath('/awesome/sauce')
   *
   * @param {string} path Path to make absolute.
   * @return {string} An absolute path relative to the root for a relative path,
   *  or just the path if it was already absolute.
   */
  absoluteResultsPath (path) {
    if (!isString(path)) {
      return null
    }
    if (path.charAt(0) === '/') {
      return path
    }
    if (!this.resultsPath) {
      return `${this.root}/${path}`
    }
    return `${this.resultsPath}/${path}`
  }

  /**
   * Makes a relative path absolute to the working path for the driver.
   * @param {string} path Path to make absolute.
   * @return {string} The absolute path.
   */
  absoluteWorkingPath (path) {
    if (!isString(path)) {
      return null
    }
    if (path.charAt(0) === '/') {
      return path
    }
    if (!this.workingPath) {
      return `${this.root}/${path}`
    }
    return `${this.workingPath}/${path}`
  }

  /**
   * Strips absolute path prefixes for working and root directory from the
   * given string.
   *
   * Note: This is here because the driver requires absolute paths to perform
   * file system operations, but any resulting information should always be
   * reported relative to the root directory. This is mostly used to have diffs
   * make sense.
   *
   * @param {string} str String from which to strip absolute paths.
   * @return {string} The string with sans absolute paths.
   */
  stripAbsolutePaths (str) {
    return str
      .replace(new RegExp(this.root, 'g'), '')
      .replace(new RegExp(this.resultsPath, 'g'), '')
      .replace(new RegExp(this.workingPath, 'g'), '')
  }

  /**
   * Logs and executes a command.
   * @param {string} command Command to execute.
   * @param {fs-driver~ExecCallback} cb Callback to execute after command
   *   finishes.
   */
  exec (cmd, args, cb) {
    var self = this
    childProcess.execFile(cmd, args, function (err, output) {
      var scriptCommand = `${cmd} ${args.join(' ')}`
      if (self.resultsPath) {
        scriptCommand = scriptCommand.replace(
          new RegExp(self.resultsPath + '([^\\s]*)', 'g'),
          self.root + '$1'
        )
      }

      if (err && err.code === 'ENOENT') {
        err.cmd = cmd
        err.args = args
        err.scriptCommand = scriptCommand
      }

      cb(err, output, scriptCommand)
    })
  }

  /**
   * Determines if a given command is installed on the system.
   * @param {string} commandName Name of the command to check.
   * @param {fs-driver~ExecCallback} cb Callback to execute after command
   *   finishes.
   */
  hasCommand (commandName, cb) {
    this.exec('command', ['-v', commandName], cb)
  }

  /**
   * Ensures that all of the commands needed to run the FsDriver are installed
   * on the client system.
   * @param {fs-driver~ExecCallback} cb Callback to execute after command
   *   finishes.
   */
  hasAllCommands (cb) {
    async.each(FsDriver.commands, this.hasCommand.bind(this), cb)
  }

  /**
   * Moves a file.
   *
   * @example
   * // Has the same behavior as `mv srcfile dstfile` on the command-line.
   * driver.move('srcfile', 'dstfile', function (err, result) {
   *   // err will only be present if something went wrong
   *   // result will contain information concerning the move
   * })
   *
   * @param {string} source Source file path.
   * @param {string} dest Destination file path.
   * @param {fs-driver~ExecCallback} cb Callback to execute after the move
   *   completes.
   */
  move (source, dest, cb) {
    this.exec('mv', [
      this.absoluteResultsPath(source),
      this.absoluteResultsPath(dest)
    ], cb)
  }

  /**
   * Copies a file.
   *
   * @example
   * // Has the same behavior as `cp src dest` on the command-line.
   * driver.copy('src', 'dest', function (err, result) {
   *   // ...
   * })
   *
   * @param {string} source Source file path.
   * @param {string} dest Destination file path.
   * @param {fs-driver~ExecCallback} cb Callback to execute after the copy
   *   completes.
   */
  copy (source, dest, cb) {
    this.exec('cp', [
      this.absoluteResultsPath(source),
      this.absoluteResultsPath(dest)
    ], cb)
  }

  /**
   * Determines if a path exists.
   * @param {string} path Absolute or relative path to check.
   * @return {boolean} `true` if the absolute path exists, false otherwise.
   */
  exists (path) {
    return fs.existsSync(this.absoluteResultsPath(path))
  }
}

/**
 * Commands required to use the `FsDriver` class.
 * @type {array}
 */
FsDriver.commands = ['cp', 'mv', 'diff', 'rm']

/**
 * Driver for performing filesystem operations.
 * @module fs-transform:fs-driver
 * @author Ryan Sandor Richards
 */
module.exports = FsDriver
