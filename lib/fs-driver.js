'use strict';

var childProcess = require('child_process');
var last = require('101/last');
var fs = require('fs');
var path = require('path');
var isString = require('101/is-string');
var last = require('101/last');
var async = require('async');
var debug = require('debug');
var execLog = debug('fs-transform:exec');

/**
 * Driver for performing filesystem operations.
 * @module fs-transform:fs-driver
 * @author Ryan Sandor Richards
 */
module.exports = FsDriver;

/**
 * Creates a new FsDriver that performs operations relative to a given root
 * directory.
 *
 * @example
 * // Create a new filesystem driver relative to /tmp
 * var driver = new FsDriver('/tmp');
 *
 * @class
 * @param {string} root Path to use for operations.
 */
function FsDriver(root) {
  if (!root) {
    root = '';
  }

  if (last(root) === '/') {
    this.root = path.resolve(root.substr(0, root.length - 1));
  }
  else {
    this.root = path.resolve(root);
  }
  this.working = null;
}

/**
 * Escapes a string for use in a command.
 * @param {string} str String to escape.
 * @return {string} The command line escaped string.
 */
FsDriver.escape = function (str) {
  // Note: I tried alternatives to this, but none worked
  // in both osx and linux :(
  return str.replace(/(['/\\])/g, '\\$1');
};


/**
 * Commands required to use the `FsDriver` class.
 * @type {array}
 */
Object.defineProperty(FsDriver, "commands", {
  value: ['cp', 'mv', 'grep', 'sed', 'diff', 'rm'],
  writable: false
});

/**
 * Makes a relative path absolute to the root directory of the driver. Returns
 * the original path if it is already absolute.
 *
 * @example
 * var driver = new FsDriver('/root/dir');
 * // returns '/root/dir/example.txt'
 * driver.absolutePath('example.txt');
 *
 * // returns '/awesome/sauce' (already an absolute path)
 * driver.absolutePath('/awesome/sauce');
 *
 * @param {string} path Path to make absolute.
 * @return {string} An absolute path relative to the root for a relative path,
 *  or just the path if it was already absolute.
 */
FsDriver.prototype.absolutePath = function (path) {
  if (!isString(path)) {
    return null;
  }
  if (path.charAt(0) === '/') {
    return path;
  }
  return !this.working ?
    this.root + '/' + path :
    this.working + '/' + path;
};

/**
 * Logs and executes a command.
 * @param {string} command Command to execute.
 * @param {fs-driver~ExecCallback} cb Callback to execute after command
 *   finishes.
 */
FsDriver.prototype.exec = function (command, cb) {
  var self = this;
  execLog(command);
  childProcess.exec(command, function (err, output) {
    var scriptCommand;
    if (!self.working) {
      scriptCommand = command;
    }
    else {
      scriptCommand = command.replace(
        new RegExp(self.working + '([^\\s]*)', 'g'),
        self.root + '$1'
      );
    }
    cb(err, output, scriptCommand);
  });
};

/**
 * Callback to invoke after the command run by FsDriver.exec finishes.
 * @param {Error} [err] An error, if one occurred when executing the command.
 * @param {string} [output] The text result of the command.
 * @param {string} scriptCommand The command that was executed, with all
 *   filenames pathed relative to the root (used for saving script commands).
 */

/**
 * Determines if a given command is installed on the system.
 * @param {string} commandName Name of the command to check.
 * @param {fs-driver~ExecCallback} cb Callback to execute after command
 *   finishes.
 */
FsDriver.prototype.hasCommand = function (commandName, cb) {
  this.exec('command -v ' + commandName, cb);
};

/**
 * Ensures that all of the commands needed to run the FsDriver are installed
 * on the client system.
 * @param {fs-driver~ExecCallback} cb Callback to execute after command
 *   finishes.
 */
FsDriver.prototype.hasAllCommands = function(cb) {
  async.each(FsDriver.commands, this.hasCommand.bind(this), cb);
};

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
FsDriver.prototype.move = function (source, dest, cb) {
  this.exec([
    'mv',
    this.absolutePath(source),
    this.absolutePath(dest)
  ].join(' '), cb);
};

/**
 * Copies a file.
 *
 * @example
 * // Has the same behavior as `cp src dest` on the command-line.
 * driver.copy('src', 'dest', function (err, result) {
 *   // ...
 * });
 *
 * @param {string} source Source file path.
 * @param {string} dest Destination file path.
 * @param {fs-driver~ExecCallback} cb Callback to execute after the copy
 *   completes.

 */
FsDriver.prototype.copy = function (source, dest, cb) {
  this.exec([
    'cp',
    this.absolutePath(source),
    this.absolutePath(dest)
  ].join(' '), cb);
};

/**
 * Performs a text search in the root directory and recursively for all
 * subdirectories.
 *
 * @example
 * // Recursively search for all text file occurances of the word 'foo'
 * driver.grep('foo', function (err, result) {
 *  // ...
 * });
 *
 * @param {string} text Text to search for.
 * @param {fs-driver~ExecCallback} cb Callback to execute after the grep
 *   completes.
 */
FsDriver.prototype.grep = function (text, cb) {
  this.exec([
    'grep -rn',
    '\'' + FsDriver.escape(text) + '\'',
    this.working ? this.working : this.root
  ].join(' '), cb);
};

/**
 * Applies in-place text replacements.
 *
 * @example
 * // Replaces 'foo' with 'bar' on line 42 of '/path/to/file'
 * fsDriver('foo', 'bar', '/path/to/file', 42, function (err, result) {
 *   // ...
 * });
 *
 * @param {string} search Search text to replace.
 * @param {string} replace Text used for replacements.
 * @param {string} path Path to the file.
 * @param {Number} line Line number on which to perform the replacement.
 * @param {fs-driver~ExecCallback} cb Callback to execute after the sed
 *   completes.
 */
FsDriver.prototype.sed = function (search, replace, name, line, cb) {
  var pattern = [
    line + 's',
    FsDriver.escape(search),
    FsDriver.escape(replace),
    'g'
  ].join('/');

  var command = [
    'sed -i.last',
    '\'' + pattern + '\'',
    this.absolutePath(name)
  ].join(' ');

  this.exec(command, cb);
};

/**
 * Determines if a path exists.
 * @param {string} path Absolute or relative path to check.
 * @return {boolean} `true` if the absolute path exists, false otherwise.
 */
FsDriver.prototype.exists = function (path) {
  return fs.existsSync(this.absolutePath(path));
};

/**
 * Performs a file diff.
 * @param {string} a Name of the first file for the diff.
 * @param {string} b Name of the second file.
 * @param {fs-driver~ExecCallback} cb Callback to execute after the diff
 *   completes.
 */
FsDriver.prototype.diff = function (a, b, cb) {
  var self = this;
  var command = [
    'diff -u -r',
    this.absolutePath(a),
    this.absolutePath(b)
  ].join(' ');
  this.exec(command, function (err, diff, scriptCommand) {
    // `diff` returns 1 when there are differences and > 1 when there is trouble
    if (err && err.code > 1) { return cb(err); }
    // Make all diff references relative to the repository root (left means
    // before transform rule is applied, right means after)
    diff = diff.replace(new RegExp(self.root, 'g'), '')
      .replace(new RegExp(self.working, 'g'), '');
    cb(null, diff, scriptCommand);
  });
};

/**
 * Removes a file.
 * @param {string} filename Name of the file to remove.
 * @param {fs-driver~ExecCallback} cb Callback to execute after the remove
 *   completes.
 */
FsDriver.prototype.remove = function (filename, cb) {
  this.exec([
    'rm',
    this.absolutePath(filename)
  ].join(' '), cb);
};

/**
 * Recursively removes a file or directory.
 * @param {string} filename Name of the file to remove.
 * @param {fs-driver~ExecCallback} cb Callback to execute after the remove
 *   completes.
 */
FsDriver.prototype.removeRecursive = function (filename, cb) {
  this.exec([
    'rm -rf',
    this.absolutePath(filename)
  ].join(' '), cb);
};

/**
 * Attempts to find an available working directory relative to /tmp.
 */
FsDriver.prototype.findWorkingDirectory = function() {
  var rootName = last(this.root.split('/'));
  var workingPath = '/tmp/.' + rootName + '.fs-work';
  var n = Math.random();
  while (this.exists(workingPath + '.' + n)) {
    n = Math.random();
  }
  return workingPath += '.' + n;
};

/**
 * Creates a temporary working copy of the root directory. This copy is used to
 * set the absolute path for given relative file names in various commands (e.g.
 * move, copy, grep, sed, rm, etc.)
 * @param {fs-driver~ExecCallback} cb Callback to execute after the working
 *   directory has been created.
 */
FsDriver.prototype.createWorkingDirectory = function (cb) {
  var self = this;
  var workingPath = this.findWorkingDirectory();
  var copyCommand = ['cp -r', this.root, workingPath].join(' ');
  this.exec(copyCommand, function (err) {
    if (err) { return cb(err); }
    self.working = workingPath;
    cb();
  });
};

/**
 * Removes the temporary working directory.
 * @param {fs-driver~ExecCallback} cb Callback to execute after removing the
 *   temporary working directory.
 */
FsDriver.prototype.removeWorkingDirectory = function (cb) {
  var self = this;
  if (!this.working) { return cb(); }
  this.removeRecursive(this.working, function (err) {
    if (err) { return cb(err); }
    self.working = null;
    cb();
  });
};

/**
 * Returns a full diff between the working directory and the root directory.
 * @param {fs-driver~ExecCallback} cb Callback to execute after performing the
 *   diff.
 */
FsDriver.prototype.workingDiff = function (cb) {
  var self = this;
  this.diff(this.root, this.working, cb);
};
