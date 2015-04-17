# fs-transform

Fast, rule based, file system transformations.

## Basic Usage

Using `fs-transform` is fairly straight forward, here's an example that
illustrates its core features:

```js
// 1. Require the transformer class
var Transformer = require('fs-transform');

// 2. Define an array of transform rules
var rules = [
  // 2.1 Copy files
  {
    action: 'copy',
    source: 'source/file',
    dest: 'dest/file'
  },

  // 2.2 Rename files
  {
    action: 'rename',
    source: 'source/file',
    dest: 'dest/file'
  },

  // 2.3 Search and Replace in Files
  //     Note: this is applied globally to all files in the root directory
  {
    action: 'replace',
    search: 'foo',
    replace: 'bar',

    // Use `exclude` property to define a set of files / lines to exclude
    // from the global replace.
    exclude: [
      {
        name: 'another/file',
        line: 22
      },
      {
        name: 'complex/file',
        lines: [12, 17, 94]
      },
      {
        name: 'a/dir/'
      }
    ]
  }
];

// Execute the transformation on the given root directory (/root/path)
Transformer.transform('/root/path', rules, function (err) {
  // Handle errors if they arise, and move on!
});
```

## Rule Actions

`fs-transform` ships with three basic transform rule implementations, or
actions, they are:

1. `copy` - Copies a file
2. `rename` - Renames a file
3. `replace` - Performs a global search and replace (without regex)

If you need custom transformations, you can easily add them by using a
`Transformer` instance, like so:

```js
var Transformer = require('fs-transform');

// 1. Instantiate a new transformer with a root directory and rules
var transformer = new Transformer('/root/dir', rules);

// 2. Add a custom rule action implementation
transformer.setAction('custom-action', function (rule, cb) {
  // This function will be applied to the `transformer` object itself;
  // which means you can use Transformer prototype methods directly, like this:
  this.addWarning(rule, 'Foo does nothing').

  // When you are done with handling your action, make sure to execute
  // the callback.
  if (rule.errorOut) {
    cb(new Error('Foo failed.'));
  }
  cb();
});
```

## Warnings

The library is fairly intelligent about when and how to apply transforms. For
instance, if you attempt to perform a rename but the source file doesn't exist
the library will skip that rule and issue a warning.

After a transformation completes you can access all of the warnings generated
by the library like so:

```js
Transformer.transform('/root', rules, function (err, transformer) {
  // Look here for a list of all the warnings
  var warnings = transformer.warnings;

  // Each warning will have both a `rule` and a `message` field so you can
  // narrow down why the warning occurred.
  warnings[0].rule;
  warnings[0].message;
});
```

Below is a complete listing of the warnings that can be generated during a
transform pass, by rule type:

#### Copy & Rename

Copy and rename perform the same checks and have the same behavior when issuing
warnings. The warnings, in order of precedence, are:

* `'Missing source file.'` - if the `rule.source` was not a string.
* `'Missing destination file.'` - if the `rule.dest` was not a string.
* `'Source file does not exist.'` - if the given path to the source file did not
  exist on the filesystem.
* `'Overwriting destination file.'` - if the given destination file exists and
  has been overwritten by the operation.

#### Replace

* `'Search pattern not specified.'` - The given `rule.search` was not a string.
* `'Replacement not specified.'` - The given `rule.replace` was not a string.
* `'Excludes not supplied as an array, omitting.'` - The given `rule.exclude`
  was given, but it was not an array, and will thus be ignored.
* `'Search did not return any results.'` - The given `rule.search` could not be
  found in any file under the root directory.
* `'Unused exclude.'` - An exclude was given that was never used to exclude a
  file from the search.
* `'All results were excluded.'` - The given set of excludes ended up removing
  all of the files from the search results.


## Generating Shell Scripts
`fs-transform` also has the ability to generate reusable shell scripts. Whenever
a command that would mutate the state of the root directory executes
successfully, the `Transform` class will keep track of that command and which
rule generated it (via the `.saveCommand` method).

Once the transformation is complete, you can call the `.getScript` method to
get all the commands as an executable shell script. Here's an example:

```js
var rules = [
  { action: 'copy', source: 'foo', dest: 'bar' },
  { action: 'replace', search: 'Socrates', replace: 'Plato' }
]
Transformer.transform('/tmp', rules, function (err, transformer) {
  // Get the shell script:
  var script = transformer.getScript();
});
```

The script would look something like this:
```sh
#!/bin/sh

#
# Warning: this is a generated file, modifications may be overwritten.
#

# from rule: {action:"copy",source:"foo",dest:"bar"}
cp /tmp/foo /tmp/bar

# from rule: {action:"replace",search:"Socrates",replace:"Plato"}
sed -i "" "13s/Socrates/Plato/g" /tmp/bar

# from rule: {action:"replace",search:"Socrates",replace:"Plato"}
sed -i "" "93s/Socrates/Plato/g" /tmp/bar

# from rule: {action:"replace",search:"Socrates",replace:"Plato"}
sed -i "" "4761s/Socrates/Plato/g" /tmp/bar
```

## Contributing

If you'd like to contribute to the library please abide by the following rules:

0. Make sure to compile and read the jsdoc documentation (run `npm run doc`,
   then open'doc/index.html' in a browser).
1. Ensure all existing tests pass (run `npm test`).
2. If you add new functionality, please add new tests and ensure 100% coverage.
3. Make sure you handle all warning corner-cases (see the source for examples
   of how the existing actions)
4. Update the jsdoc if you make changes to the any of the method behaviors.
5. Please submit a PR that clearly defines the purpose of your contributions


## License
MIT
