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
  console.log(undefinedVariable());
  console.log("HI!", $bar.main(), exports.foo1, exports.foo2, exports["if"], exports.bar, exports.default, module.exports, module["exports"]);
}

//exports.foo20 = "bar";

module.exports = {
  foo1: "foo1",
  //require: require,
  bar: $bar.bar1,
  qux: $bar.qux,
  "if": foo_var1,
  //"var": $bar["var"],
  "foo_foo'": $bar["foo'"],
  foo_var10: foo_var1,
  "const": foo_var1,
  main: main,
  foo2: "testing",
  curried: $bar.curried,
  "null": 50
};

//exports.foo = "foo1";
//exports.foo1 = "foo1";

//exports["uh"] = "foo2";

//exports["foo'"] = "foo10";

var foo_var1 = 50;

//exports.foo_var = foo_var1;
