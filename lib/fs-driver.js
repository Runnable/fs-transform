'use strict'

var async = require('async')
var childProcess = require('child_process')
var debug = require('debug')
var fs = require('fs')
var isString = require('101/is-string')
var last = require('101/last')
var path = require('path')

var execLog = debug('fs-transform:exec')

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
    if (!commit) {
      return async.series([
        this.removeWorkingDirectory.bind(this),
        this.removeResultsDirectory.bind(this)
      ], cb)
    }
    var backupPath = this.root + '.bak'
    this.exec([
      `mv '${this.root}' '${backupPath}'`,
      `mv '${this.workingPath}' '${this.root}'`,
      `rm -rf '${backupPath}' '${this.resultsPath}'`,
    ].join(' && '), cb)
  }

  /**
   * Creates the initial working directory as a copy of the root directory.
   * @param  {Function} cb Called when the directory has been created.
   */
  createWorkingDirectory (cb) {
    let rootName = last(this.root.split('/'))
    let workingPath = '/tmp/.' + rootName + '.fs-work'
    let n = parseInt(1000000 * Math.random())
    while (this.exists(workingPath + '.' + n)) {
      n = parseInt(1000000 * Math.random())
    }
    this.workingPath = workingPath + '.' + n
    this.exec(`cp -r '${this.root}' '${this.workingPath}'`, cb)
  }

  /**
   * Creates the initial results directory to use for handling find and replace.
   * @param  {Function} cb Called when the results directory has been created.
   */
  createResultsDirectory (cb) {
    if (!this.workingPath) {
      return cb(new Error(
        'Cannot create a results directory without a working directory'
      ))
    }
    this.resultsPath = `${this.workingPath}.results`
    this.exec(`cp -r '${this.workingPath}' '${this.resultsPath}'`, cb)
  }

  /**
   * Commits the changes made to the results directory back to the working
   * directory.
   * @param  {Function} cb Called when the changes have been committed.
   */
  commitResults (cb) {
    this.exec([
      `rm -rf '${this.workingPath}'`,
      `cp -r '${this.resultsPath}' '${this.workingPath}'`
    ].join('&&'), cb)
  }

  /**
   * Removes the working directory.
   * @param  {Function} cb Called when the working directory has been removed.
   */
  removeWorkingDirectory (cb) {
    this.exec(`rm -rf '${this.workingPath}'`, cb)
  }

  /**
   * Removes the results directory.
   * @param  {Function} cb Called when the results directory has been removed.
   */
  removeResultsDirectory (cb) {
    this.exec(`rm -rf '${this.resultsPath}'`, cb)
  }

  /**
   * Escapes a string for use in a command.
   * @param {string} str String to escape.
   * @return {string} The command line escaped string.
   */
  static escape (str) {
    if (!isString(str)) { return str }
    return str.replace(/([$`'/\\])/g, '\\$1')
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
  absolutePath (path) {
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

  absoluteRootPath (path) {
    return `${this.root}/${path}`
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
      .replace(new RegExp(this.workingPath, 'g'), '')
      .replace(new RegExp(this.resultsPath, 'g'), '')
  }

  /**
   * Logs and executes a command.
   * @param {string} command Command to execute.
   * @param {fs-driver~ExecCallback} cb Callback to execute after command
   *   finishes.
   */
  exec (command, cb) {
    var self = this
    execLog(command)
    childProcess.exec(command, function (err, output) {
      var scriptCommand
      if (!self.resultsPath) {
        scriptCommand = command
      } else {
        scriptCommand = command.replace(
          new RegExp(self.resultsPath + '([^\\s]*)', 'g'),
          self.root + '$1'
        )
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
    this.exec('command -v ' + commandName, cb)
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
    this.exec([
      'mv',
      this.absolutePath(source),
      this.absolutePath(dest)
    ].join(' '), cb)
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
    this.exec([
      'cp',
      this.absolutePath(source),
      this.absolutePath(dest)
    ].join(' '), cb)
  }

  /**
   * Determines if a path exists.
   * @param {string} path Absolute or relative path to check.
   * @return {boolean} `true` if the absolute path exists, false otherwise.
   */
  exists (path) {
    return fs.existsSync(this.absolutePath(path))
  }

  /**
   * Performs a file diff.
   * @param {string} a Name of the first file for the diff.
   * @param {string} b Name of the second file.
   * @param {fs-driver~ExecCallback} cb Callback to execute after the diff
   *   completes.
   */
  diff (a, b, cb) {
    var self = this
    var command = [
      'diff -u -r',
      this.absolutePath(a),
      this.absolutePath(b)
    ].join(' ')
    this.exec(command, function (err, diff, scriptCommand) {
      // `diff` returns 1 when there are differences and > 1 on failure
      if (err && err.code > 1) { return cb(err) }
      // Diff file references need to be relative to the root (left means before
      // transform rule is applied, right means after)
      cb(null, self.stripAbsolutePaths(diff), scriptCommand)
    })
  }

  /**
   * Removes a file.
   * @param {string} filename Name of the file to remove.
   * @param {fs-driver~ExecCallback} cb Callback to execute after the remove
   *   completes.
   */
  remove (filename, cb) {
    this.exec([
      'rm',
      this.absolutePath(filename)
    ].join(' '), cb)
  }

  /**
   * Recursively removes a file or directory.
   * @param {string} filename Name of the file to remove.
   * @param {fs-driver~ExecCallback} cb Callback to execute after the remove
   *   completes.
   */
  removeRecursive (filename, cb) {
    this.exec([
      'rm -rf',
      this.absolutePath(filename)
    ].join(' '), cb)
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
