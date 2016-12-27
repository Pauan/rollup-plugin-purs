"use strict";

var $bar = require("./bar");

var bar2 = require("./bar")
  , _test1 = 20;

//module.exports = "foo5000";

function main() {
  console.log("HI!", $bar.main());
}

module.exports = {
  bar: $bar.bar,
  qux: $bar.qux,
  //"var": $bar["var"],
  "foo_foo'": $bar["foo'"],
  foo_var10: foo_var1,
  "const": foo_var1,
  main: main
};

exports.foo = "foo1";

exports["uh"] = "foo2";

exports["foo'"] = "foo10";

var foo_var1 = 50;

exports.foo_var = foo_var1;
