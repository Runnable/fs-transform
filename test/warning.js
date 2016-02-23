var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var Code = require('code')
var expect = Code.expect

var Warning = require('../lib/warning.js')

describe('Warning', () => {
  it('should set the warning rule and message', (done) => {
    var rule = { action: 'replace' }
    var message = 'Warning message'
    var warning = new Warning(rule, message)
    expect(warning.rule).to.equal(rule)
    expect(warning.message).to.equal(message)
    done()
  })
})
