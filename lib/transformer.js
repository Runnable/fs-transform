'use strict'

var async = require('async')
var isString = require('101/is-string')
var FsDriver = require('./fs-driver')
var Warning = require('./warning')
var ScriptGenerator = require('./script-generator')
var exists = require('101/exists')
var debug = require('debug')
var Replacer = require('./replacer')

var fullDiffDebug = debug('fs-transform:full-diff')

/**
 * Class that performs a series of filesystem tranformations given a root
 * directory and list of rules.
 * @class
 * @author Ryan Sandor Richards
 */
class Transformer {
  /**
   * Performs a series of filesystem transformations.
   * @param {String} root Root directory to run the transformations.
   * @param {String|Array} rules An array of transformations, or a JSON string
   *   that parses into a stream of transformations.
   * @param {fs-transform~Callback} cb Callback to execute once the
   *   transformations have been completed or if an error has occurred.
   */
  static transform (root, rules, cb) {
    try {
      new Transformer(root, rules).transform(cb)
    } catch (err) {
      cb(err)
    }
  }

  /**
   * Performs a dry run of the transformation.
   * @param {String} root Root directory to run the transformations.
   * @param {String|Array} rules An array of transformations, or a JSON string
   *   that parses into a stream of transformations.
   * @param {fs-transform~Callback} cb Callback to execute once the
   *   transformations have been completed or if an error has occurred.
   */
  static dry (root, rules, cb) {
    try {
      new Transformer(root, rules).dry(cb)
    } catch (err) {
      cb(err)
    }
  }

  /**
   * Creates a new transformer.
   * @param {String} root Root directory to run the transformations.
   * @param {String|Array} rules An array of transformations, or a JSON string
   *   that parses into a stream of transformations.
   * @throws SyntaxError If rules were provided as a string, but were not valid
   *   JSON.
   * @throws Error If the given rules were not an array.
   */
  constructor (root, rules) {
    if (isString(rules)) {
      rules = JSON.parse(rules)
    }
    if (!Array.isArray(rules)) {
      throw new Error('Rules must be an array.')
    }

    this.driver = new FsDriver(root)
    this.rules = rules
    this._ruleActions = {}
    this.currentResult = null
    this.warnings = []
    this.results = []
    this.nameChanges = []
    this._globalExcludes = []
    this.script = new ScriptGenerator()

    this.setAction('copy', this.copy)
    this.setAction('rename', this.rename)
    this.setAction('replace', this.replace)
    this.setAction('exclude', this.exclude)
  }

  /**
   * Pushes a new result to the result list.
   * @param {object} rule Rule that generates the result.
   * @return {object} The new result object.
   */
  pushResult (rule) {
    this.currentResult = {
      rule: rule,
      warnings: [],
      nameChanges: [],
      diffs: {}
    }
    this.results.push(this.currentResult)
    return this.currentResult
  }

  /**
   * Adds a rule generated warning to the transformer.
   * @param object Object that generated the warning.
   * @param msg Message for the warning.
   */
  addWarning (object, msg) {
    var warning = new Warning(object, msg)
    this.warnings.push(warning)
    if (exists(this.currentResult)) {
      this.currentResult.warnings.push(warning)
    }
  }

  /**
   * Adds a name change result.
   * @param {object} nameChange Name change to add.
   */
  addNameChange (from, to) {
    var nameChange = { from: from, to: to }
    this.nameChanges.push(nameChange)
    if (exists(this.currentResult)) {
      this.currentResult.nameChanges.push(nameChange)
    }
  }

  /**
   * Sets a diff for a given file to the current result.
   * @param {string} filename Name of the file for the diff.
   * @param {string} Contents of the diff (via diff -u, similar to git diff).
   */
  setFileDiff (filename, diff) {
    if (!this.currentResult) { return }
    // Note: Since this is being reported to the client, we need to remove any
    // absolute paths to the root directory.
    var relativePath = this.driver.stripAbsolutePaths(filename)
    this.currentResult.diffs[relativePath] = diff
  }

  /**
   * Generates a shell script from this transfromer's rules.
   * @return {string} A shell-script that executes the rules.
   */
  getScript () {
    return this.script.generate()
  }

  /**
   * @return The full diff after performing all filesystem transforms.
   */
  getDiff () {
    return this._fullDiff
  }

  /**
   * Allows the user to override existing rule actions and define new ones.
   * Note the action function will be applied within the context of this
   * Transformation.
   * @param {string} name Name of the action to define or override.
   * @param {fs-transform~Rule} fn Function to apply when encountering the rule
   *   with the given action name.
   */
  setAction (name, fn) {
    var self = this
    this._ruleActions[name] = function () {
      fn.apply(self, arguments)
    }
  }

  /**
   * Determine the rule action handler for the action name.
   * @param {string} name Name of the action.
   * @return {fs-transform~Rule} The rule handler for the action.
   */
  getAction (name) {
    return this._ruleActions[name]
  }

  /**
   * Perform and commit the transformations.
   * @param {fs-transform~Callback} cb Callback to execute once the
   *   transformations have been completed or if an error has occurred.
   */
  transform (cb) {
    this._execute(true, cb)
  }

  /**
   * Perform a dry run of of the tranformations.
   * @param {fs-transform~Callback} cb Callback to execute once the
   *   transformations have been completed or if an error has occurred.
   */
  dry (cb) {
    this._execute(false, cb)
  }

  /**
   * Executes each of the the tranformation rules and collects their results.
   * @param {boolean} commit Whether or not to commit the transformations to the
   *   original root directory. If true then the changes are applied to the root
   *   directory, if false then the root directory will remain unchanged.
   * @param {fs-transform~Callback} executeCallback Callback to execute once the
   *   transformations have been completed or if an error has occurred.
   */
  _execute (commit, executeCallback) {
    var self = this
    this._fullDiff = ''

    async.series([
      // 0. Check to ensure we have all the required commands
      function checkRequiredCommand (cb) {
        self.driver.hasAllCommands(cb)
      },

      // 1. Create initial working and results directory
      function setup (cb) {
        self.driver.setup(cb)
      },

      // 2. Apply transformation rules
      function applyRules (cb) {
        async.mapSeries(self.rules, function (rule, ruleCallback) {
          self.applyRule(rule, function (err) {
            if (err) { return ruleCallback(err) }
            self.driver.commitResults(ruleCallback)
          })
        }, function (err) {
          cb(err, self)
        })
      },

      // 3. Fetch a diff between the working and the original root
      function fetchFullDiff (cb) {
        self.driver.workingDiff(function (err, diff) {
          if (err) { return cb(err) }
          fullDiffDebug(diff)
          self._fullDiff = diff
          cb()
        })
      },

      // 4. Commit the changes if applicable, otherwise remove the working
      //    directory.
      function cleanup (cleanupCallback) {
        self.driver.teardown(commit, cleanupCallback)
      }
    ], function (err) {
      executeCallback(err, self)
    })
  }

  /**
   * Applys a given transformation rule.
   * @param {object} rule Rule to apply.
   * @param {function} cb Callback to execute once the rule has been processed.
   */
  applyRule (rule, cb) {
    if (!rule) {
      return cb(new Error('Null or undfined rule encountered.'))
    }

    if (!isString(rule.action)) {
      return cb(new Error('Invalid rule action: ' + rule.action))
    }

    var actionMethod = this.getAction(rule.action)
    if (!actionMethod) {
      return cb(new Error('Action not found: ' + rule.action))
    }

    this.pushResult(rule)
    actionMethod(rule, cb)
  }

  /**
   * Performs validations for copy and rename rules.
   * @param {object} rule Rule to validate.
   * @return {boolean} `true` if validations pass, `false` otherwise.
   */
  _isValidRenameOrCopy (rule) {
    if (!isString(rule.source)) {
      this.addWarning(rule, 'Missing source file.')
      return false
    }
    if (!isString(rule.dest)) {
      this.addWarning(rule, 'Missing destination file.')
      return false
    }
    if (!this.driver.exists(rule.source)) {
      this.addWarning(rule, 'Source file does not exist.')
      return false
    }
    if (this.driver.exists(rule.dest)) {
      this.addWarning(rule, 'Overwrites destination file.')
    }
    return true
  }

  /**
   * Copy a file.
   * @param {object} rule Defines the source and destination for the file copy.
   * @param {function} cb Callback to execute once the file has been copied.
   */
  copy (rule, cb) {
    if (!this._isValidRenameOrCopy(rule)) {
      return cb()
    }
    var self = this
    this.driver.copy(rule.source, rule.dest, function (err, output) {
      if (err) { return cb(err) }
      self.addNameChange(rule.source, rule.dest)
      self.script.addRule(rule)
      cb()
    })
  }

  /**
   * Rename a file.
   * @param {object} rule Defines the source and destination for the file
   *   rename.
   * @param {function} cb Callback to execute once the file has been renamed.
   */
  rename (rule, cb) {
    if (!this._isValidRenameOrCopy(rule)) {
      return cb()
    }
    var self = this
    this.driver.move(rule.source, rule.dest, function (err, output) {
      if (err) { return cb(err) }
      self.addNameChange(rule.source, rule.dest)
      self.script.addRule(rule)
      cb()
    })
  }

  /**
   * Text search and replace for many files.
   * @param {object} rule Rules that define what to search for, replace, and
   *   exclude from the search.
   * @param {function} cb Callback to execute once the search and replace has
   *   been performed.
   */
  replace (rule, cb) {
    var self = this

    var search = rule.search
    if (!isString(search)) {
      this.addWarning(rule, 'Search pattern not specified.')
      return cb()
    }

    var replace = rule.replace
    if (!isString(replace)) {
      this.addWarning(rule, 'Replacement not specified.')
      return cb()
    }

    var exclude = rule.exclude
    if (!Array.isArray(exclude)) {
      this.addWarning(rule, 'Excludes not supplied as an array, omitting.')
      exclude = []
    }

    var replacer = new Replacer(
      this.driver.workingPath,
      this.driver.resultsPath,
      this._globalExcludes.concat(exclude)
    )

    replacer.replace(rule.search, rule.replace)
      .then(function (files) {
        // Add the rule to the script
        self.script.addRule(rule)

        // Set the diffs for each file
        self.driver.resultDiff((err, diff) => {
          if (err) { return cb(err); }
          let entries = diff.split('diff -u -r ')
          entries.shift()
          entries.forEach((diff) => {
            let lines = diff.split('\n')
            let fileLine = lines.shift()
            let filename = fileLine.split(/\s+/).pop()
            self.setFileDiff(filename, lines.join('\n'))
          })
          cb()
        })
      })
      .catch(cb)
  }

  /**
   * Global exclude rule. Causes given files to be ignored by all subsequent
   * rules.
   * @param {object} rule Rule that provides a list of files to exclude.
   * @param {function} cb Callback to execute once the exclude rules have been
   *   applied.
   */
  exclude (rule, cb) {
    if (!Array.isArray(rule.files)) {
      this.addWarning('Exclude files not specified as an array.')
      return cb()
    }

    var self = this
    rule.files.forEach(function (name) {
      if (!isString(name)) {
        self.addWarning('Non-string exclude filename encountered.')
        return
      }
      var absoluteName = self.driver.absoluteWorkingPath(name)
      if (!~self._globalExcludes.indexOf(absoluteName)) {
        self._globalExcludes.push(absoluteName)
      }
    })

    self.script.addRule(rule)
    cb()
  }
}

/**
 * Default postfix to append to backup files after performing find and replace
 * transformation operations.
 * @type {string}
 */
Transformer.ORIGINAL_POSTFIX = '.fs-transform.original'

/**
 * @module fs-transform:Transformer
 * @author Ryan Sandor Richards
 */
module.exports = Transformer
