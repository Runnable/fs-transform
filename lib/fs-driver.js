'use strict';

var childProcess = require('child_process');
var last = require('101/last');

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
    this.root = root.substr(0, root.length - 1);
  }
  else {
    this.root = root;
  }
}

/**
 * Makes a relative path absolute to the root directory of the driver. Returns
 * the original path if it already absolute.
 *
 * @example
 * var driver = new FsDriver('/root/dir');
 * // returns '/root/dir/example.txt'
 * driver._absolutePath('example.txt');
 *
 * // returns '/awesome/sauce' (already an absolute path)
 * driver._absolutePath('/awesome/sauce');
 *
 * @param {string} path Path to make absolute.
 * @return {string} An absolute path relative to the root for a relative path,
 *  or just the path if it was already absolute.
 */
FsDriver.prototype._absolutePath = function (path) {
  if (path.charAt(0) === '/') {
    return path;
  }
  return this.root + '/' + path;
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
 * @param {function} cb Callback to execute with the results of the file move.
 */
FsDriver.prototype.move = function (source, dest, cb) {
  var command = [
    'mv',
    this._absolutePath(source),
    this._absolutePath(dest)
  ].join(' ');
  childProcess.exec(command, cb);
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
 */
FsDriver.prototype.copy = function (source, dest, cb) {
  childProcess.exec([
    'cp',
    this._absolutePath(source),
    this._absolutePath(dest)
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
 */
FsDriver.prototype.grep = function (text, cb) {
  var command = [
    'grep -rn',
    text.replace(/\\/, '\\\\'),
    this.root
  ].join(' ');
  childProcess.exec(command, cb);
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
 */
FsDriver.prototype.sed = function (search, replace, name, line, cb) {
  var pattern = [
    line + 's',
    search.replace(/\//, '\\/'),
    replace.replace(/\//, '\\/'),
    'g'
  ].join('/');

  var command = [
    'sed -i "" "', pattern, '" ',
    this._absolutePath(name)
  ].join('');

  childProcess.exec(command, cb);
};
