'use strict';

var async = require('async');
var isString = require('101/is-string');
var FsDriver = require('./fs-driver');
var Warning = require('./warning');

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
 * @param warning Warning to add to the transformer.
 */
Transformer.prototype.addWarning = function (warning) {
  this.warnings.push(warning);
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
    this.addWarning(new Warning(rule, 'Missing source file.'));
    return cb();
  }
  if (!isString(rule.dest)) {
    this.addWarning(new Warning(rule, 'Missing destination file.'));
    return cb();
  }
  if (!this.driver.exists(rule.source)) {
    this.addWarning(new Warning(rule, 'Source file does not exist.'));
    return cb();
  }
  if (this.driver.exists(rule.dest)) {
    this.addWarning(new Warning(rule, 'Overwriting destination file.'))
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
    this.addWarning(new Warning(rule, 'Missing source file.'));
    return cb();
  }
  if (!isString(rule.dest)) {
    this.addWarning(new Warning(rule, 'Missing destination file.'));
    return cb();
  }
  if (!this.driver.exists(rule.source)) {
    this.addWarning(new Warning(rule, 'Source file does not exist.'));
    return cb();
  }
  if (this.driver.exists(rule.dest)) {
    this.addWarning(new Warning(rule, 'Overwriting destination file.'))
  }
  this.driver.move(rule.source, rule.dest, cb);
};

/**
 * Text search and replace for many files.
 * @param {object} rule Rules that define what to search for, replace, and
 *   exclude from the search.
 * @param {function} cb Callback to execute once the search and replace has
 *   been performed.
 */
Transformer.prototype.replace = function (rule, cb) {
  var patterns = rule.patterns || [];
  var self = this;

  async.each(patterns, function (pattern, ruleCallback) {
    self.driver.grep(pattern.search, function (err, grepResult) {
      var files = [];
      var search = pattern.search;
      var replace = pattern.replace;
      var exclude = pattern.exclude || [];

      // 1. Determine files & lines from grep
      grepResult.split('\n').forEach(function (line) {
        var match = line.match(/(.*):(\d+):.*/);
        if (match) {
          files.push({ name: match[1], line: match[2] });
        }
      });

      // 2. Remove excluded files/lines from result set
      files = files.filter(function (file) {
        return exclude.reduce(function (memo, curr, index) {
          if (curr.name && curr.line) {
            return memo && (curr.name != file.name || curr.line != file.line);
          }
          if (curr.name) {
            return memo && (curr.name != file.name);
          }
          return memo;
        }, true);
      });

      // 3. Apply in-place `sed` to result set
      async.each(files, function (file, cb) {
        self.driver.sed(search, replace, file.name, file.line, cb);
      }, ruleCallback);
    });
  }, cb);
};
