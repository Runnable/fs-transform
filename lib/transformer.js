'use strict';

var async = require('async');
var isString = require('101/is-string');
var FsDriver = require('./fs-driver');
var Warning = require('./warning');
var exists = require('101/exists');
var debug = require('debug');
var fullDiffDebug = debug('fs-transform:full-diff');

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
  this.currentResult = null;
  this.warnings = [];
  this.commands = [];
  this.results = [];
  this.nameChanges = [];

  this.setAction('copy', this.copy);
  this.setAction('rename', this.rename);
  this.setAction('replace', this.replace);
}

/**
 * Default postfix to append to backup files after performing find and replace
 * transformation operations.
 * @type {string}
 */
Transformer.ORIGINAL_POSTFIX = '.fs-transform.original';

/**
 * Pushes a new result to the result list.
 * @param {object} rule Rule that generates the result.
 * @return {object} The new result object.
 */
Transformer.prototype.pushResult = function (rule) {
  this.currentResult = {
    rule: rule,
    commands: [],
    warnings: [],
    nameChanges: [],
    diffs: {}
  };
  this.results.push(this.currentResult);
  return this.currentResult;
};

/**
 * Adds a rule generated warning to the transformer.
 * @param object Object that generated the warning.
 * @param msg Message for the warning.
 */
Transformer.prototype.addWarning = function (object, msg) {
  var warning = new Warning(object, msg);
  this.warnings.push(warning);
  if (exists(this.currentResult)) {
    this.currentResult.warnings.push(warning);
  }
};

/**
 * Adds a name change result.
 * @param {object} nameChange Name change to add.
 */
Transformer.prototype.addNameChange = function (from, to) {
  var nameChange = {
    from: from,
    to: to
  };
  this.nameChanges.push(nameChange);
  if (exists(this.currentResult)) {
    this.currentResult.nameChanges.push(nameChange);
  }
};

/**
 * Adds a diff to the current result.
 * @param {string} filename Name of the file for the diff.
 * @param {string} Contents of the diff (via diff -u, similar to git diff).
 */
Transformer.prototype.addDiff = function (filename, diff) {
  if (!this.currentResult) { return; }
  if (!this.currentResult.diffs[filename]) {
    this.currentResult.diffs[filename] = [];
  }
  this.currentResult.diffs[filename].push(diff);
};

/**
 * Saves a command that was executed by the transformer. We do this so we can
 * reconstruct all of the transformations in the form of a script.
 * @param {string} command Command to save.
 * @param {object} rule Rule that generated the command.
 */
Transformer.prototype.saveCommand = function (command, rule) {
  this.commands.push({
    rule: rule,
    command: command
  });
  if (exists(this.currentResult)) {
    this.currentResult.commands.push(command);
  }
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
 * @return The full diff after performing all filesystem transforms.
 */
Transformer.prototype.getDiff = function() {
  return this._fullDiff;
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
 * @return {fs-transform~Rule} The rule handler for the action.
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
 * Performs a series of filesystem transformations.
 * @param {String} root Root directory to run the transformations.
 * @param {String|Array} rules An array of transformations, or a JSON string
 *   that parses into a stream of transformations.
 * @param {fs-transform~Callback} cb Callback to execute once the
 *   transformations have been completed or if an error has occurred.
 */
Transformer.transform = function(root, rules, cb) {
  try {
    new Transformer(root, rules).transform(cb);
  }
  catch (err) {
    cb(err);
  }
};

/**
 * Performs a dry run of the transformation.
 * @param {String} root Root directory to run the transformations.
 * @param {String|Array} rules An array of transformations, or a JSON string
 *   that parses into a stream of transformations.
 * @param {fs-transform~Callback} cb Callback to execute once the
 *   transformations have been completed or if an error has occurred.
 */
Transformer.dry = function(root, rules, cb) {
  try {
    new Transformer(root, rules).dry(cb);
  }
  catch (err) {
    cb(err);
  }
};

/**
 * Callback executed when transformations have been completed, or if an error
 * has occurred.
 * @callback fs-transform~Callback
 * @param {Error} err An error if something went wrong when processing the
 *   transformation rules.
 */

/**
 * Perform and commit the transformations.
 * @param {fs-transform~Callback} cb Callback to execute once the
 *   transformations have been completed or if an error has occurred.
 */
Transformer.prototype.transform = function (cb) {
  this._execute(true, cb);
};

/**
 * Perform a dry run of of the tranformations.
 * @param {fs-transform~Callback} cb Callback to execute once the
 *   transformations have been completed or if an error has occurred.
 */
Transformer.prototype.dry = function (cb) {
  this._execute(false, cb);
};

/**
 * Executes each of the the tranformation rules and collects their results.
 * @param {boolean} commit Whether or not to commit the transformations to the
 *   original root directory. If true then the changes are applied to the root
 *   directory, if false then the root directory will remain unchanged.
 * @param {fs-transform~Callback} executeCallback Callback to execute once the
 *   transformations have been completed or if an error has occurred.
 */
Transformer.prototype._execute = function (commit, executeCallback) {
  var self = this;
  this.commands = [];
  this._fullDiff = "";

  async.series([
    // 1. Create a working directory
    function setup(cb) {
      self.driver.createWorkingDirectory(cb);
    },

    // 2. Apply transformation rules
    function applyRules(cb) {
      async.mapSeries(self.rules, function (rule, ruleCallback) {
        self.applyRule(rule, ruleCallback);
      }, function (err) {
        cb(err, self);
      });
    },

    // 3. Fetch a diff between the working and the original root
    function fetchFullDiff(cb) {
      self.driver.workingDiff(function (err, diff) {
        if (err) { return cb(err); }
        fullDiffDebug(diff);
        self._fullDiff = diff;
        cb();
      });
    },

    // 4. Commit the changes if applicable, otherwise remove the working
    //    directory.
    function cleanup(cleanupCallback) {
      if (!commit) {
        return self.driver.removeWorkingDirectory(cleanupCallback);
      }

      var root = self.driver.root;
      var backup = root + '.bak';
      var working = self.driver.working;

      async.series([
        function backupRoot(cb) {
          self.driver.move(root, backup, cb);
        },
        function moveWorkingToRoot(cb) {
          self.driver.move(working, root, cb);
        },
        function removeBackup(cb) {
          self.driver.removeRecursive(backup, cb);
        }
      ], cleanupCallback);
    }
  ], function (err) {
    executeCallback(err, self);
  });
};

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

  this.pushResult(rule);
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
};

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
    self.addNameChange(rule.source, rule.dest);
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
    self.addNameChange(rule.source, rule.dest);
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
        var name = self.driver.absolutePath(excludeRule.name);
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
      self.addWarning(rule, 'All results were excluded.');
      return cb();
    }

    // 3. Perform Search and Replace

    // 3.0 Collect the set of filenames for each of the files being changed.
    var filenames = [];
    files.forEach(function (file) {
      if (!~filenames.indexOf(file.name)) {
        filenames.push(file.name);
      }
    });

    async.series([
      // 3.1 Create an original copy for each file being changed
      function createOriginalCopy(cb) {
        async.each(filenames, function (name, copyCallback) {
          var originalName = name + Transformer.ORIGINAL_POSTFIX;
          self.driver.copy(name, originalName, copyCallback);
        }, cb);
      },

      // 3.2 Make replacements by using sed
      function sedFiles(cb) {
        async.each(files, function (file, sedCallback) {
          var command = self.driver.sed(
            search,
            replace,
            file.name,
            parseInt(file.line),
            function(err) {
              if (err) { return sedCallback(err); }
              self.saveCommand(command, rule);
              sedCallback();
            }
          );
        }, cb);
      },

      // 3.3 Collect diffs for each file
      function collectDiffs(cb) {
        async.each(filenames, function (name, diffCallback) {
          var originalName = name + Transformer.ORIGINAL_POSTFIX;
          var cmd = self.driver.diff(originalName, name, function (err, diff) {
            if (err) { return diffCallback(err); }
            self.addDiff(name, diff);
            diffCallback();
          });
        }, cb);
      },

      // 3.4 Cleanup temporary files
      function cleanup(cb) {
        async.each(filenames, function (name, removeCallback) {
          var originalName = name + Transformer.ORIGINAL_POSTFIX;
          var dotLastName = name + '.last';
          var names = [originalName, dotLastName].join(' ');
          self.driver.remove(names, removeCallback);
        }, cb);
      }
    ], cb);
  });
};
