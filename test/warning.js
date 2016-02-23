var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;

var Warning = require('../lib/warning.js');

describe('Warning', function() {
  it('should set the warning rule and message', function(done) {
    var rule = { action: 'replace' };
    var message = 'Warning message';
    var warning = new Warning(rule, message);
    expect(warning.rule).to.equal(rule);
    expect(warning.message).to.equal(message);
    done();
  });
});
