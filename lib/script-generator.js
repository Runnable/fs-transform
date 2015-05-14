'use strict';

var FsDriver = require('./fs-driver');

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
function ScriptGenerator(rules) {
  this.setRules(rules);
  this.actionHandlers = {
    'copy': this.copy.bind(this),
    'rename': this.rename.bind(this),
    'replace': this.replace.bind(this),
    'exclude': this.exclude.bind(this)
  };
}

/**
 * Sets the rules for the script generator.
 * @param {array} rules Rules to set for the generator.
 */
ScriptGenerator.prototype.setRules = function (rules) {
  this.rules = rules;
};

/**
 * Generates a shell script from the rules.
 * @return {string} A shell script generated from the provided rules.
 */
ScriptGenerator.prototype.generate = function() {
  return [
    this.preamble(),
    this.rules.map(this.generateRule.bind(this)).join('\n')
  ].join('\n');
};

/**
 * Generates the preamble for the shell script.
 * @return {string} The preamble for the script.
 */
ScriptGenerator.prototype.preamble = function () {
  var header = [
    '#!/bin/sh\n',
    '#',
    '# Warning: this is a generated file, modifications may be overwritten.',
    '#\n'
  ].join('\n');

  var common = [
    '_script_name=`basename $0`',
    'search_files=\'.\'',
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
 * Generates the script for the given rule.
 * @param {object} rule Rule for which to generate the script.
 * @param {Number} [index] Optional index position for the rule in a greater
 *   rule set.
 * @return {string} The script that handles the given rule.
 */
ScriptGenerator.prototype.generateRule = function (rule, index) {
  return this.actionHandlers[rule.action](rule, index);
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
    'results=($(grep -rl \'' + search + '\' $search_files))',
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

  var excludes = rule.files.map(function (name) {
    return '\\( ! -name \'' + name + '\' \\)';
  }).join(' ');

  return [
    header,
    'search_files=`find . -type f ' + excludes +  '`',
    ''
  ].join('\n');
};
