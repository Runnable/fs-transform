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
 * @param {String|Array} rules An array of transformations, or a JSON string
 *   that parses into a stream of transformations.
 * @throws SyntaxError If rules were provided as a string, but were not valid
 *   JSON.
 * @throws Error If the given rules were not an array.
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

  // Stores a list of the transformative commands that were executed
  this.commands = [];

  this.setAction('copy', this.copy);
  this.setAction('rename', this.rename);
  this.setAction('replace', this.replace);
}

/**
 * Default postfix to append to backup files after performing find and replace
 * transformation operations.
 * @type {string}
 */
Transformer.ORIGINAL_POSTFIX = '.fst.original';

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
 * @param {String|Array} rules An array of transformations, or a JSON string
 *   that parses into a stream of transformations.
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
  this.commands = [];
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
 * @return the commands executed by this transformer in the form of a command
 *   line script.
 */
Transformer.prototype.getScript = function () {
  var preamble = [
    '#!/bin/sh\n',
    '#',
    '# Warning: this is a generated file, modifications may be overwritten.',
    '#\n'
  ].join('\n');

  var commands = this.commands.map(function (cmd) {
    return ('# from rule: ' + JSON.stringify(cmd.rule)) + '\n' +
      cmd.command;
  }).join('\n\n');

  return [preamble, commands, ''].join('\n');
};

/**
 * Saves a command that was executed by the transformer. We do this so we can
 * reconstruct all of the transformations in the form of a script.
 * @param {string} command Command to save.
 * @param {object} rule Rule that generated the command.
 */
Transformer.prototype.saveCommand = function (command, rule) {
  this.commands.push({
    command: command,
    rule: rule
  });
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
 * Performs validations for copy and rename rules.
 * @param {object} rule Rule to validate.
 * @return {boolean} `true` if validations pass, `false` otherwise.
 */
Transformer.prototype._isValidRenameOrCopy = function (rule) {
  if (!isString(rule.source)) {
    this.addWarning(rule, 'Missing source file.');
    return false;
  }
  if (!isString(rule.dest)) {
    this.addWarning(rule, 'Missing destination file.');
    return false;
  }
  if (!this.driver.exists(rule.source)) {
    this.addWarning(rule, 'Source file does not exist.');
    return false;
  }
  if (this.driver.exists(rule.dest)) {
    this.addWarning(rule, 'Overwrites destination file.');
  }
  return true;
}

/**
 * Copy a file.
 * @param {object} rule Defines the source and destination for the file copy.
 * @param {function} cb Callback to execute once the file has been copied.
 */
Transformer.prototype.copy = function (rule, cb) {
  if (!this._isValidRenameOrCopy(rule)) {
    return cb();
  }
  var self = this;
  var command = this.driver.copy(rule.source, rule.dest, function (err) {
    if (err) { return cb(err); }
    self.saveCommand(command, rule);
    cb();
  });
};

/**
 * Rename a file.
 * @param {object} rule Defines the source and destination for the file rename.
 * @param {function} cb Callback to execute once the file has been renamed.
 */
Transformer.prototype.rename = function (rule, cb) {
  if (!this._isValidRenameOrCopy(rule)) {
    return cb();
  }
  var self = this;
  var command = this.driver.move(rule.source, rule.dest, function (err) {
    if (err) { return cb(err); }
    self.saveCommand(command, rule);
    cb();
  });
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

    // 1.1 If no files were returned by grep, issue a warning and return
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

    // 3.1 Create backups for the files we are about to change
    var names = [];
    files.forEach(function (file) {
      if (!~names.indexOf(file.name)) {
        names.push(file.name);
      }
    });

    async.each(names, function (name, copyCallback) {
      self.driver.copy(
        name,
        name + Transformer.ORIGINAL_POSTFIX,
        copyCallback
      );
    }, makeReplacements);

    // 3.2 Apply in-place `sed` to result set
    function makeReplacements(err) {
      if (err) { return cb(err); }
      async.each(files, function (file, cb) {
        var command = self.driver.sed(
          search,
          replace,
          file.name,
          file.line,
          function(err) {
            if (err) { return cb(err); }
            self.saveCommand(command, rule);
            cb();
          }
        );
      }, cb);
    }
  });
};
