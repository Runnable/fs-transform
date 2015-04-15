'use strict';

var async = require('async');
var isString = require('101/is-string');
var FsDriver = require('./fs-driver');
var Warning = require('./warning');
var exists = require('101/exists');

/**
 * @module fs-transform:Transformer
 * @author Ryan Sandor Richards
 */
module.exports = Transformer;

/**
 * Class that performs a series of filesystem tranformations given a root
 * directory and list of rules.
 * @class
 * @author Ryan Sandor Richards
 * @param {String} root Root directory to run the transformations.
 * @param {String|Array} An array of transformations, or a JSON string that
 *   parses into a stream of transformations.
 */
function Transformer(root, rules) {
  if (isString(rules)) {
    rules = JSON.parse(rules);
  }
  if (!Array.isArray(rules)) {
    throw new Error('Rules must be an array.');
  }

  this.driver = new FsDriver(root);
  this.rules = rules;
  this._ruleActions = {};
  this.warnings = [];

  this.setAction('copy', this.copy);
  this.setAction('rename', this.rename);
  this.setAction('replace', this.replace);
}

/**
 * Callback executed when transformations have been completed, or if an error
 * has occurred.
 * @callback fs-transform~Callback
 * @param {Error} err An error if something went wrong when processing the
 *   transformation rules.
 */

/**
 * Performs a series of filesystem transformations.
 * @param {String} root Root directory to run the transformations.
 * @param {String|Array} An array of transformations, or a JSON string that
 *   parses into a stream of transformations.
 * @param {fs-transform~Callback} cb Callback to execute once the
 *   transformations have been completed or if an error has occurred.
 */
Transformer.transform = function(root, rules, cb) {
  try {
    new Transformer(root, rules).execute(cb);
  }
  catch (err) {
    cb(err);
  }
};

/**
 * Executes the transformations.
 * @param {fs-transform~Callback} cb Callback to execute once the
 *   transformations have been completed or if an error has occurred.
 */
Transformer.prototype.execute = function (cb) {
  var self = this;
  async.mapSeries(this.rules, function (rule, ruleCallback) {
    self.applyRule(rule, ruleCallback);
  }, function (err) {
    cb(err, self);
  });
};

/**
 * Adds a rule generated warning to the transformer.
 * @param object Object that generated the warning.
 * @param msg Message for the warning.
 */
Transformer.prototype.addWarning = function (object, msg) {
  this.warnings.push(new Warning(object, msg));
};

/**
 * Allows the user to override existing rule actions and define new ones.
 * Note the action function will be applied within the context of this
 * Transformation.
 * @param {string} name Name of the action to define or override.
 * @param {fs-transform~Rule} fn Function to apply when encountering the rule
 *   with the given action name.
 */
Transformer.prototype.setAction = function(name, fn) {
  var self = this;
  this._ruleActions[name] = function() {
    fn.apply(self, arguments);
  };
};

/**
 * Determine the rule action handler for the action name.
 * @param {string} name Name of the action.
 * @return {function} The rule handler for the action.
 */
Transformer.prototype.getAction = function(name) {
  return this._ruleActions[name];
};

/**
 * Callback for the application of rule actions.
 * @callback fs-transform~Rule
 * @param {object} rule Rule to apply.
 * @param {function} cb Callback to execute after the rule has been applied.
 */

/**
 * Applys a given transformation rule.
 * @param {object} rule Rule to apply.
 * @param {function} cb Callback to execute once the rule has been processed.
 */
Transformer.prototype.applyRule = function (rule, cb) {
  if (!rule) {
    return cb(new Error('Null or undfined rule encountered.'));
  }

  if (!isString(rule.action)) {
    return cb(new Error('Invalid rule action: ' + rule.action));
  }

  var actionMethod = this.getAction(rule.action);
  if (!actionMethod) {
    return cb(new Error('Action not found: ' + rule.action));
  }

  actionMethod(rule, cb);
};

/**
 * Copy a file.
 * @param {object} rule Defines the source and destination for the file copy.
 * @param {function} cb Callback to execute once the file has been copied.
 */
Transformer.prototype.copy = function (rule, cb) {
  if (!isString(rule.source)) {
    this.addWarning(rule, 'Missing source file.');
    return cb();
  }
  if (!isString(rule.dest)) {
    this.addWarning(rule, 'Missing destination file.');
    return cb();
  }
  if (!this.driver.exists(rule.source)) {
    this.addWarning(rule, 'Source file does not exist.');
    return cb();
  }
  if (this.driver.exists(rule.dest)) {
    this.addWarning(rule, 'Overwriting destination file.');
  }
  this.driver.copy(rule.source, rule.dest, cb);
};

/**
 * Rename a file.
 * @param {object} rule Defines the source and destination for the file rename.
 * @param {function} cb Callback to execute once the file has been renamed.
 */
Transformer.prototype.rename = function (rule, cb) {
  if (!isString(rule.source)) {
    this.addWarning(rule, 'Missing source file.');
    return cb();
  }
  if (!isString(rule.dest)) {
    this.addWarning(rule, 'Missing destination file.');
    return cb();
  }
  if (!this.driver.exists(rule.source)) {
    this.addWarning(rule, 'Source file does not exist.');
    return cb();
  }
  if (this.driver.exists(rule.dest)) {
    this.addWarning(rule, 'Overwriting destination file.');
  }
  this.driver.move(rule.source, rule.dest, cb);
};

/**
 * Text search and replace for many files.
 * @param {object} rule Rules that define what to search for, replace, and
 *   exclude from the search.
 * @param {function} cb Callback to execute once the search and replace has been
 *   performed.
 */
Transformer.prototype.replace = function (rule, cb) {
  var self = this;

  var search = rule.search;
  if (!isString(search)) {
    this.addWarning(rule, 'Search pattern not specified.');
    return cb();
  }

  var replace = rule.replace;
  if (!isString(replace)) {
    this.addWarning(rule, 'Replacement not specified.');
    return cb();
  }

  var exclude = rule.exclude || [];
  if (!Array.isArray(exclude)) {
    this.addWarning(rule, 'Excludes not supplied as an array, omitting.');
    exclude = [];
  }

  this.driver.grep(rule.search, function (err, grepResult) {
    var files = [];

    // 1. Determine files & lines from grep
    grepResult.split('\n').forEach(function (line) {
      var match = line.match(/(.*):(\d+):.*/);
      if (match) {
        files.push({ name: match[1], line: match[2] });
      }
    });

    // 1.1 If no files were returned by grep, issue a warning and get out of here
    if (files.length === 0) {
      self.addWarning(rule, 'Search did not return any results.');
      return cb();
    }

    // 2. Remove excluded files/lines from result set

    // 2.1 Keep track of when excludes are used to filter results
    var ruleApplied = [];
    exclude.forEach(function(excludeRule, index) {
      ruleApplied[index] = false;
    });

    // 2.2 Determine which files to keep
    files = files.filter(function (file) {
      var keepFile = true;

      exclude.forEach(function(excludeRule, index) {
        var name = excludeRule.name;
        var line = excludeRule.line;

        if (exists(name) && exists(line)) {
          if (name === file.name && parseInt(line) === parseInt(file.line)) {
            keepFile = false;
            ruleApplied[index] = true;
            return;
          }
        }
        else if (exists(name)) {
          if (name === file.name) {
            ruleApplied[index] = true;
            keepFile = false;
            return;
          }
        }
      });
      return keepFile;
    });

    // 2.3 Issue warnings for unused excludes
    exclude.forEach(function (excludeRule, index) {
      if (!ruleApplied[index]) {
        self.addWarning(excludeRule, 'Unused exclude.');
      }
    });

    // 2.4 Issue a warning and return if the excludes removed all files
    if (files.length === 0) {
      self.addWarning(rule, 'All results were excluded.')
      return cb();
    }

    // 3. Apply in-place `sed` to result set
    async.each(files, function (file, cb) {
      self.driver.sed(search, replace, file.name, file.line, cb);
    }, cb);
  });
};
