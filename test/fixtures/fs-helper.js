'use strict';

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

/**
 * Path to the mock used as a basis for testing filesystem transformations.
 * @type {string}
 */
var mockPath = path.resolve(__dirname, 'root');

/**
 * Path to the working test directory upon which to perform transformations.
 * @type {string}
 */
var testPath = path.resolve(__dirname, 'test');

/**
 * @module fs-transform:test:fs-helper
 * @author Ryan Sandor Richards
 */
module.exports = {
  path: testPath,
  mock: mockPath,
  createTestDir: createTestDir,
  removeTestDir: removeTestDir,
  exists: exists,
  diff: diff,
  mockDiff: mockDiff,
  read: read,
  readMock: readMock,
  writeFile: writeFile
};

/**
 * Creates a testing root directory.
 * @param {function} cb Callback to execute after creating the directory.
 */
function createTestDir(cb) {
  childProcess.exec(['cp -r', mockPath, testPath].join(' '), cb);
}

/**
 * Removes the testing root directory.
 * @param {function} cb Callback to execute after removing the directory.
 */
function removeTestDir(cb) {
  childProcess.exec(['rm -rf', testPath].join(' '), cb);
}

/**
 * Resolves given name relative to the test directory and determines if it
 * exists.
 * @param {string} filename Filename to test.
 * @return {boolean} `true` if the file exists, `false` otherwise.
 */
function exists(filename) {
  return fs.existsSync(path.resolve(testPath, filename));
}

/**
 * Finds the diff between two files and yields the result to the given callback.
 * @param {string} a Filename of the first file relative to the test directory.
 * @param {string} b Filename of the second file relative to the test directory.
 * @param {function} cb Callback to execute with the diff between the files.
 */
function diff(a, b, cb) {
  var command = [
    'diff',
    path.resolve(testPath, a),
    path.resolve(testPath, b)
  ].join(' ');
  childProcess.exec(command, cb);
}

/**
 * Diffs a given file that has changed, with a file in the original directory
 * mock.
 * @param {string} newFile File that has changed due to transformations.
 * @param {string} originalFile File in the original root directory mock.
 * @param {function} cb Callback to execute with the diff of the files.
 */
function mockDiff(newFile, originalFile, cb) {
  var command = [
    'diff',
    path.resolve(testPath, newFile),
    path.resolve(mockPath, originalFile)
  ].join(' ');
  childProcess.exec(command, cb);
}

/**
 * Helper for fs.readFileSync.
 * @param {string} filename Name of the file to read in the test directory.
 * @param {object} [options] Options to send to f.readFileSync.
 * @return {string} The contents of the file.
 */
function read(filename, options) {
  return fs.readFileSync(
    path.resolve(testPath, filename),
    options
  ).toString();
}

/**
 * Helper to read files from the original mock directory.
 * @param {string} filename Name of the file to read in the test directory.
 * @param {object} [options] Options to send to f.readFileSync.
 * @return The contents of the file.
 */
function readMock(filename, options) {
  return fs.readFileSync(
    path.resolve(mockPath, filename),
    options
  ).toString();
}

/**
 * Alias for system `fs.writeFile`.
 */
function writeFile() {
  return fs.writeFile.apply(this, arguments);
}
