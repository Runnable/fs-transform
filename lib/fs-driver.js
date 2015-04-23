'use strict';

var childProcess = require('child_process');
var last = require('101/last');
var fs = require('fs');
var path = require('path');
var isString = require('101/is-string');

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
  return this.root + '/' + path;
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
  var command = [
    'mv',
    this.absolutePath(source),
    this.absolutePath(dest)
  ].join(' ');
  childProcess.exec(command, cb);
  return command;
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
  var command = [
    'cp',
    this.absolutePath(source),
    this.absolutePath(dest)
  ].join(' ');
  childProcess.exec(command, cb);
  return command;
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
  var escaped = text
    .replace('\\', '\\\\\\\\')
    .replace('"', '\\\\"');
  var command = [
    'grep -rn',
    '"' + escaped + '"',
    this.root
  ].join(' ');
  childProcess.exec(command, cb);
  return command;
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
    search.replace(/ /g, '\\ ').replace(/\//, '\\/').replace('"', '\\"'),
    replace.replace(/ /g, '\\ ').replace(/\//, '\\/').replace('"', '\\"'),
    'g'
  ].join('/');

  var command = [
    'sed -i.last ', pattern, ' ',
    this.absolutePath(name)
  ].join('');

  childProcess.exec(command, cb);

  return command;
};

/**
 * Determines if a path exists.
 * @param {string} path Absolute or relative path to check.
 * @return {boolean} `true` if the absolute path exists, false otherwise.
 */
FsDriver.prototype.exists = function (path) {
  return fs.existsSync(this.absolutePath(path));
};
