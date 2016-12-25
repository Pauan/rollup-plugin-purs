"use strict";

var $bar = require("./bar");

var bar2 = require("./bar")
  , _test1 = 20;

module.exports = "foo5000";

module.exports = {
  bar: $bar.bar,
  qux: $bar.qux,
  foo_var: $bar["var"],
  "foo_foo'": $bar["foo'"]
};

exports.foo = "foo1";

exports["uh"] = "foo2";

exports["var"] = "foo3";

exports["foo'"] = "foo10";
