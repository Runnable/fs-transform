'use strict';

var isString = require('101/is-string');
var debug = require('debug');
var FsDriver = require('./fs-driver');
var trace = debug('fs-transform:script-generator:trace');

/**
 * Generates shell scripts from transformation rules.
 * @module fs-transform:script
 * @author Ryan Sandor Richards
 */
module.exports = ScriptGenerator;

/**
 * Creates a new ScriptGenerator class that can generate scripts for the given
 * set of transformation rules. Note: rules are not validated before generating
 * the script. Please ensure you validate all rules using `Transformer.dry`
 * before generating shell scripts.
 * @class
 * @param {array} rules Rules to convert into a shell script.
 */
function ScriptGenerator() {
  this.actionGenerators = {
    'copy': this.copy.bind(this),
    'rename': this.rename.bind(this),
    'replace': this.replace.bind(this),
    'exclude': this.exclude.bind(this)
  };
  this.ruleScripts = [];
}

/**
 * Generates a shell script from the rules.
 * @return {string} A shell script generated from the provided rules.
 */
ScriptGenerator.prototype.generate = function() {
  return [
    this.preamble(),
    this.ruleScripts.join('\n')
  ].join('\n');
};

/**
 * Generates the preamble for the shell script.
 * @return {string} The preamble for the script.
 */
ScriptGenerator.prototype.preamble = function () {
  var header = [
    '#!/bin/bash\n',
    '#',
    '# Warning: this is a generated file, modifications may be overwritten.',
    '#\n'
  ].join('\n');

  var common = [
    '_script_name=`basename $0`',
    'search_files=`find . -type f | grep -v \'./.git\'`',
    'warning() { echo "($_script_name) WARNING" $1; }',
    'error() { echo "($_script_name) ERROR" $1; exit 1; }\n'
  ].join('\n');

  var commandChecks = [
    FsDriver.commands.map(function (name) {
      return 'command -v ' + name + ' >/dev/null 2>&1 || {\n' +
        '  error "Missing required command: ' + name + '";\n' +
        '}';
    }).join('\n'),
  ].join('\n') + '\n';

  return [header, common, commandChecks].join('\n');
};

/**
 * Generates the script for the given rule and appends it to the script.
 * @param {object} rule Rule for which to generate the script.
 */
ScriptGenerator.prototype.addRule = function (rule) {
  if (!rule.action) { return; }
  trace('addRule: ' + JSON.stringify(rule));
  var index = this.ruleScripts.length + 1;
  var script = this.actionGenerators[rule.action](rule, index);
  this.ruleScripts.push(script);
};

/**
 * Generates the script for a copy rule.
 * @param {object} rule Copy rule.
 * @return {string} Script for the given rule.
 */
ScriptGenerator.prototype.copy = function (rule, index) {
  var header = [
    '# RULE ' + index,
    '# {',
    '#   action: "' + rule.action + '",',
    '#   source: "' + rule.source + '",',
    '#   dest: "' + rule.dest + '"',
    '# }'
  ].join('\n') + '\n';

  var body = [
    'cp ' + rule.source + ' ' + rule.dest + ' || {',
    '  warning "Rule ' + index + ': unable to copy ' +
      rule.source + ' to ' + rule.dest + '"',
    '}'
  ].join('\n');

  return [header, body, ''].join('\n');
};

/**
 * Generates the script for a rename rule.
 * @param {object} rule Rename rule.
 * @return {string} Script for the given rule.
 */
ScriptGenerator.prototype.rename = function (rule, index) {
  var header = [
    '# RULE ' + index,
    '# {',
    '#   action: "' + rule.action + '",',
    '#   source: "' + rule.source + '",',
    '#   dest: "' + rule.dest + '"',
    '# }'
  ].join('\n') + '\n';

  var body = [
    'mv ' + rule.source + ' ' + rule.dest + ' || {',
    '  warning "Rule ' + index + ': unable to rename ' +
      rule.source + ' to ' + rule.dest + '"',
    '}'
  ].join('\n');

  return [header, body, ''].join('\n');
};

/**
 * Generates the script for a replace rule.
 * @param {object} rule Replace rule.
 * @return {string} Script for the given rule.
 */
ScriptGenerator.prototype.replace = function (rule, index) {
  var header = [
    '# RULE ' + index,
    '# {',
    '#   action: ' + rule.action + ',',
    '#   search: "' + rule.search + '",',
    '#   replace: "' + rule.replace + '"'
  ].join('\n');

  var excludes = "";
  if (rule.excludes) {
    header += ',\n' + '#   excludes: [' + rule.excludes.join(', ') + ']\n';
    excludes = rule.excludes.join(' ');
  }
  else {
    header += '\n';
  }
  header += '# }\n';

  var search = FsDriver.escape(rule.search);
  var replace = FsDriver.escape(rule.replace);

  var body = [
    'results=($(grep -rlI \'' + search + '\' $search_files))',
    'excludes="' + excludes + '"',
    'if ((${#results[@]} > 0)); then',
    '  for name in $results',
    '  do',
    '    if [[ ! $excludes =~ $name ]]; then',
    '      sed -i.last \'s/' + search + '/' + replace + '/g\' $name || {',
    '        warning "Rule ' + index + ': could not replace ' +
               '\'' + search + '\' with \'' + replace + '\' in $name"',
    '      }',
    '      rm -f $name.last',
    '    fi',
    '  done',
    'else',
    '  warning "Rule ' + index + ': no search results to replace."',
    'fi'
  ].join('\n');

  return [header, body, ''].join('\n');
};

/**
 * Generates the script for a exclude rule.
 * @param {object} rule Exclude rule.
 * @return {string} Script for the given rule.
 */
ScriptGenerator.prototype.exclude = function (rule, index) {
  var header = [
    '# RULE ' + index,
    '# {',
    '#   action: "' + rule.action + '",',
    '#   files: [' + rule.files.join(', ') + ']',
    '# }'
  ].join('\n');

  /*
    rule.files should contain a list of string filenames to globally exclude
    from all replace rules. This does two things:

    1. Ensures that we only handle array entries that are strings
       .filter(isString)

    2. Maps the filename to an inverse `grep` that matches only the exact file
       name in the output of a `find` (the -v option tells grep to invert the
       search).

    For example, consider this list of files:

      ['A.txt', 'B.yml', {}]

    The first step will filter only the ones that are strings (excluding the
    {}). And the second step will produce the following string:

      "grep -v '^./A.txt$' | grep -v '^./B.txt$'"

    which is then composed with a find command and stored as a variable:

      search_files=`find . -type f | grep -v '^./A.txt$' | grep -v '^./B.txt$'`
  */
  var excludes = rule.files.filter(isString).map(function (name) {
    // Strip out single quotes from file names so they cannot add arbitrary
    // commands to the script. Tried my best to escape these, but it seems that
    // there is some weirdness when it comes to single quote matching in bash.
    return 'grep -v \'^./' + name.replace(/'/g, '') + '$\'';
  }).join(' | ');

  var cmd = 'search_files=`find . -type f | grep -v \'./.git\' | ' +
    excludes + '`';
  return [header, cmd, ''].join('\n');
};
