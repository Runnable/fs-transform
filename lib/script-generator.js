'use strict'

var isString = require('101/is-string')
var debug = require('debug')
var FsDriver = require('./fs-driver')
var trace = debug('fs-transform:script-generator:trace')
var fs = require('fs')
var path = require('path')

/**
 * Creates a new ScriptGenerator class that can generate scripts for the given
 * set of transformation rules. Note: rules are not validated before generating
 * the script. Please ensure you validate all rules using `Transformer.dry`
 * before generating shell scripts.
 * @class
 */
class ScriptGenerator {
  /**
   * Creates a new script generator
   * @param {array} rules Rules to convert into a shell script.
   */
  constructor () {
    this.actionGenerators = {
      'copy': this.copy.bind(this),
      'rename': this.rename.bind(this),
      'replace': this.replace.bind(this),
      'exclude': this.exclude.bind(this)
    }
    this.ruleScripts = []
  }

  /**
   * Generates a shell script from the rules.
   * @return {string} A shell script generated from the provided rules.
   */
  generate () {
    return [
      fs.readFileSync(path.resolve(__dirname, '../script/preamble.sh')),
      this.ruleScripts.join('\n')
    ].join('\n')
  }

  /**
   * Generates the script for the given rule and appends it to the script.
   * @param {object} rule Rule for which to generate the script.
   */
  addRule (rule) {
    if (!rule.action) { return }
    trace('addRule: ' + JSON.stringify(rule))
    var index = this.ruleScripts.length + 1
    var script = this.actionGenerators[rule.action](rule, index)
    this.ruleScripts.push(script)
  }

  /**
   * Generates the script for a copy rule.
   * @param {object} rule Copy rule.
   * @return {string} Script for the given rule.
   */
  copy (rule, index) {
    var header = [
      '# RULE ' + index,
      '# {',
      '#   action: "' + rule.action + '",',
      '#   source: "' + rule.source + '",',
      '#   dest: "' + rule.dest + '"',
      '# }'
    ].join('\n') + '\n'
    var command = 'copy ' + rule.source + ' ' + rule.dest
    return [header, command, ''].join('\n')
  }

  /**
   * Generates the script for a rename rule.
   * @param {object} rule Rename rule.
   * @return {string} Script for the given rule.
   */
  rename (rule, index) {
    var header = [
      '# RULE ' + index,
      '# {',
      '#   action: "' + rule.action + '",',
      '#   source: "' + rule.source + '",',
      '#   dest: "' + rule.dest + '"',
      '# }'
    ].join('\n') + '\n'
    var command = 'rename ' + rule.source + ' ' + rule.dest
    return [header, command, ''].join('\n')
  }

  /**
   * Generates the script for a replace rule.
   * @param {object} rule Replace rule.
   * @return {string} Script for the given rule.
   */
  replace (rule, index) {
    var header = [
      '# RULE ' + index,
      '# {',
      '#   action: ' + rule.action + ',',
      '#   search: "' + rule.search + '",',
      '#   replace: "' + rule.replace + '"'
    ].join('\n')

    var exclude = ''
    if (rule.exclude) {
      exclude = rule.exclude.map((file) => {
        return [
          './',
          file.replace(/^([/]|[.][/])*/, '').replace(/["$]/g, '\\$1')
        ].join('')
      }).join(' ')
      header += ',\n' + '#   exclude: [' + exclude.split(' ').join(', ') + ']\n'
    }
    else {
      header += '\n'
    }
    header += '# }\n'

    var search = FsDriver.escape(rule.search)
    var replace = FsDriver.escape(rule.replace)

    var params = [search, replace, exclude].map((param) => {
      return '\'' + param + '\''
    }).join(' ')

    return [header, 'replace ' + params, ''].join('\n')
  }

  /**
   * Generates the script for a exclude rule.
   * @param {object} rule Exclude rule.
   * @return {string} Script for the given rule.
   */
  exclude (rule, index) {
    /*
      rule.files should contain a list of string filenames to globally exclude
      from all replace rules. This does two things:

      1. Ensures that we only handle array entries that are strings
         .filter(isString)

      2. Maps the filename to a path relative to the root directory where the
         script will be run.

      For example, consider this list of files:

        ['A.txt', 'B.yml', {}]

      The first step will filter only the ones that are strings (excluding the
      {}). And the second step will produce the following string:

        "./A.txt ./B.txt"
    */
    var excludes = rule.files.filter(isString).map((name) => {
      return './' + name.replace(/^([/]|[.][/])*/, '').replace(/["$]/g, '\\$1')
    })

    var header = [
      '# RULE ' + index,
      '# {',
      '#   action: "' + rule.action + '",',
      '#   files: [' + excludes.join(', ') + ']',
      '# }'
    ].join('\n')
    var command = 'global_exclude="./$script_name ' + excludes.join(' ') + '"'
    return [header, '', command, ''].join('\n')
  }
}

/**
 * Generates shell scripts from transformation rules.
 * @module fs-transform:script
 * @author Ryan Sandor Richards
 */
module.exports = ScriptGenerator
