"use strict";

var $bar = require("../Bar");

var bar2 = require("../Bar")
  , _test1 = 20;

//var ___ = require("foo" + "bar");

//module.exports = "foo5000";

//var require = 50;

function foo(require, exports, module) {
  var x = require("foo");
  exports.foo = 5;
  module.exports = 5;
}

function main() {
  console.log("HI!", $bar.main(), require);
}

module.exports = {
  require: require,
  bar: $bar.bar,
  qux: $bar.qux,
  //"var": $bar["var"],
  //"foo_foo'": $bar["foo'"],
  foo_var10: foo_var1,
  "const": foo_var1,
  main: main
};

exports.foo = "foo1";

exports["uh"] = "foo2";

//exports["foo'"] = "foo10";

var foo_var1 = 50;

exports.foo_var = foo_var1;
