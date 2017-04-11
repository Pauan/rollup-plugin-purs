var $11 = require("../11");

console.log($11.foo, $11.readFloat);


var foo = require("../Foo");
var corge = require("../Corge");
require("../Typeclass");

var testing__ = {};

function main() {
  console.log(corge.foo, corge.bar, corge.default);
  console.log(foo.null, foo.var, testing__.var);
  console.log("MAIN", foo.main(), foo.curried(1), foo.curried(1)(2), foo.curried(1)(2)(3), foo.curried(1)(2)(3)(4));
}

module.exports = {
  main: main
};


function add(x) {
  return function (y) {
    return x + y;
  };
}

console.log(add(effect(1))(effect(2)));


var get = function (mutable) {
  return function (state) {
    return mutable.snapshot.value;
  };
};

console.log(get(effect(group.tabs), 1));

console.log(get(effect(group.tabs))(1));

console.log(get(effect(group.tabs)));
