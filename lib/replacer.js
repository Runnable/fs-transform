'use strict'

const finder = require('findit')
const Promise = require('bluebird')
const replaceStream = require('replacestream')
const fs = Promise.promisifyAll(require('fs'))

const IGNORE = ['.git', 'node_modules/']

/**
 * Performs find-and-replace actions on the given working directory.
 * @class
 * @author Ryan Sandor Richards
 */
module.exports = class Replacer {
  /**
   * Creates a new replace transform.
   * @param {string} readPath Path from which to read files.
   * @param {string} working Path to write changes for files.
   * @param {array} ignore A list of paths to ignore during the
   *   find-and-replace.
   */
  constructor (readPath, resultsPath, ignore) {
    this.readPath = readPath
    this.resultsPath = resultsPath
    this.ignore = IGNORE.concat(ignore || [])
  }

  /**
   * Determines whether or not the given file is allowed.
   * @return {boolean} `true` if the file is allowed, `false` otherwise.
   */
  allowFile (file, rule) {
    for (let i = 0; i < this.ignore.length; i++) {
      if (~file.indexOf(this.ignore[i])) {
        return false
      }
    }
    return true
  }

  /**
   * Walks the file tree of the root directory and finds a list of paths to
   * files relevant to the search and replace.
   * @return {Promise} Resolves with a list of all applicable files in the root
   *   directory.
   */
  getFiles () {
    return new Promise((resolve, reject) => {
      const files = []
      finder(this.readPath)
        .on('directory', (dir, stat, stop) => {
          if (!this.allowFile(dir)) {
            stop()
          }
        })
        .on('file', (file, stat) => {
          files.push(file)
        })
        .on('error', reject)
        .on('end', () => {
          resolve(files.filter((file) => {
            return this.allowFile(file)
          }))
        })
    })
  }

  /**
   * Performs a find-and-replace on the filesystem.
   * @param {object} rule The find-and-replace rule to apply.
   */
  replace (query, replace) {
    var self = this
    return this.getFiles()
      .then(function (files) {
        return Promise.all(files.map(function (file) {
          return new Promise(function (resolve, reject) {
            var findAndReplace = replaceStream(
              query,
              replace,
              { ignoreCase: false }
            )
            findAndReplace.on('end', resolve)
            findAndReplace.on('error', reject)
            fs.createReadStream(file)
              .pipe(findAndReplace)
              .pipe(fs.createWriteStream(
                file.replace(self.readPath, self.resultsPath)
              ))
          })
        }))
      })
  }
}
