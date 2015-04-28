'use strict';

var childProcess = require('child_process');
var last = require('101/last');
var fs = require('fs');
var path = require('path');
var isString = require('101/is-string');
var last = require('101/last');
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
 * Escapes a string for use in a command.
 * @param {string} str String to escape.
 * @return {string} The command line escaped string.
 */
FsDriver.prototype.escape = function (str) {
  // Note: I tried alternatives to this, but none worked
  // in both osx and linux :(
  return str.replace(/(['/\\])/g, '\\$1');
};

/**
 * Logs and executes a command.
 * @param {string} command Command to execute.
 * @param {function} cb Callback to execute after command finishes.
 * @return {string} The command that was executed, with each path resolved to
 *   the root directory.
 */
FsDriver.prototype.exec = function (command, cb) {
  execLog(command);
  childProcess.exec(command, cb);

  if (!this.working) {
    return command;
  }

  return command.replace(
    new RegExp(this.working + '([^\\s]*)', 'g'),
    this.root + '$1'
  );
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
 * @param {function} cb Callback to execute with the results of the file move.
 * @return {string} The move command to be executed.
 */
FsDriver.prototype.move = function (source, dest, cb) {
  return this.exec([
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
 * @param {function} cb Callback to execute with the results of the file copy.
 * @return {string} The copy command to be executed.
 */
FsDriver.prototype.copy = function (source, dest, cb) {
  return this.exec([
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
 * @param {function} cb Callback to execute after the search has been performed.
 * @return {string} The grep command that is to be executed.
 */
FsDriver.prototype.grep = function (text, cb) {
  return this.exec([
    'grep -rn',
    '\'' + this.escape(text) + '\'',
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
 * @param {function} cb Callback to execute when the replacement has been made.
 * @return {string} The sed command that is to be executed.
 */
FsDriver.prototype.sed = function (search, replace, name, line, cb) {
  var pattern = [
    line + 's',
    this.escape(search),
    this.escape(replace),
    'g'
  ].join('/');
  return this.exec([
    'sed -i.last',
    '\'' + pattern + '\'',
    this.absolutePath(name)
  ].join(' '), cb);
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
 * @param {function} cb Callback to execute with the results of the diff.
 */
FsDriver.prototype.diff = function (a, b, cb) {
  var command = [
    'diff -u',
    this.absolutePath(a),
    this.absolutePath(b)
  ].join(' ');
  return this.exec(command, function (err, diff) {
    // `diff` returns 1 when there are differences and > 1 when there is trouble
    if (err && err.code > 1) { return cb(err); }
    cb(null, diff);
  });
};

/**
 * Removes a file.
 * @param {string} filename Name of the file to remove.
 * @param {function} cb Callback to execute after the file remove.
 */
FsDriver.prototype.remove = function (filename, cb) {
  return this.exec([
    'rm',
    this.absolutePath(filename)
  ].join(' '), cb);
};

/**
 * Recursively removes a file or directory.
 * @param {string} filename Name of the file to remove.
 * @param {function} cb Callback to execute after the file remove.
 */
FsDriver.prototype.removeRecursive = function (filename, cb) {
  return this.exec([
    'rm -rf',
    this.absolutePath(filename)
  ].join(' '), cb);
};

/**
 * Creates a temporary working copy of the root directory. This copy is used to
 * set the absolute path for given relative file names in various commands (e.g.
 * move, copy, grep, sed, rm, etc.)
 * @param {function} cb Callback to execute after the working directory has been
 *   created.
 */
FsDriver.prototype.createWorkingDirectory = function (cb) {
  var self = this;
  var rootName = last(this.root.split('/'));
  var workingPath = '/tmp/.' + rootName + '.fs-work';
  var n = 0;
  while (this.exists(workingPath + '.' + n)) {
    n++;
  }
  workingPath += '.' + n;
  var copyCommand = ['cp -r', this.root, workingPath].join(' ');
  this.exec(copyCommand, function (err) {
    if (err) { return cb(err); }
    self.working = workingPath;
    cb();
  });
};

/**
 * Removes the temporary working directory.
 * @param {function} cb Callback to execute after removing the temporary working
 *   directory.
 */
FsDriver.prototype.removeWorkingDirectory = function (cb) {
  var self = this;
  if (!this.working) { return cb(); }
  return this.removeRecursive(this.working, function (err) {
    if (err) { return cb(err); }
    self.working = null;
    cb();
  });
};

/**
 * Returns a full diff between the working directory and the root directory.
 * @param {function} cb Callback to execute after performing the diff.
 */
FsDriver.prototype.workingDiff = function (cb) {
  this.diff(this.root, this.working, cb);
};
