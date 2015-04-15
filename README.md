# fs-transform

Fast, rule based, file system transformations.

## Usage

```js
var transform = require('fs-transform').transform;

transform('/path', [
  // Copy files
  {
    action: 'copy',
    source: 'source/file',
    dest: 'dest/file'
  },

  // Rename files
  {
    action: 'rename',
    source: 'source/file',
    dest: 'dest/file'
  },

  // Search and Replace in Files
  {
    action: 'replace',
    search: 'foo',
    replace: 'bar',
    exclude: [
      {
        name: 'another/file',
        line: 22
      },
      {
        name: 'complex/file',
        lines: [12, 17, 94]
      }
    ]
  }
]);
```


## License
MIT
