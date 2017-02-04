// rollup-plugin-purs ignore dynamic exports
"use strict";

var $bar = require("../Bar");

var bar2 = require("../Bar")
  , _test1 = 20;

var $qux = require("../Qux");

console.log($qux.default);

//var ___ = require("foo" + "bar");

//module.exports = "foo5000";

//var require = 50;

function inlined1(a, b, c) {
  return a + 1 + b + 1 + c + 1;
}

function inlined1_2(a, b, c) {
  return a + 1 + b + 1 + 1;
}

var inlined2 = function (a, b, c) {
  return a + 1 + b + 1 + c + 1;
};

function inlined3(a, b, c) {
  return a + b + c + function (d) {
    return function () {
      return function () {
        return function () {
          return d();
        };
      };
    };
  };
}

function inlined4(a, b, c) {
  return a + b + c + function (inlined4) {
    return inlined4();
  };
}

var inlined5 = inlined1;
var inlined6 = inlined5;

function inlined7(a, b, c) {
  return (a = 10), (self = b);
}

function inlined8(a, b, c) {
  if (a) {
    return b;

  } else {
    return c;
  }
}

function recursive(a, b, c) {
  return recursive(a + 1, b + 1, c + 1);
}

function recursive2(a, b, c) {
  return mutualRecursive1(a + 1, b + 1, c + 1);
}

function mutualRecursive1(a, b, c) {
  return mutualRecursive2(a + 1, b + 1, c + 1);
}

function mutualRecursive2(a, b, c) {
  return mutualRecursive1(a + 2, b + 2, c + 2);
}

var a = 1;

console.log(inlined1(1, 2, 3));
console.log(inlined1(1, 2));
console.log(inlined1_2(1, 2));
console.log(inlined1(1, 2, 3, 4));
console.log(inlined2(a, 2, 3));
console.log(inlined3(a, 2, 3));
console.log(inlined4(a, 2, 3));
console.log(inlined5(a, 2, 3));
console.log(inlined6(a, 2, 3));
console.log(inlined7(a, 2, 3));
console.log(inlined8(a, 2, 3));
console.log((function (a) { return inlined1(a, 2, 3); })(1));
console.log(inlined2(1, 2, 3));
console.log(recursive(1, 2, 3));
console.log(recursive2(1, 2, 3));
console.log(mutualRecursive1(1, 2, 3));

console.log((function foo() { return foo(); })());

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
