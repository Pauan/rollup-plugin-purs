var foo = require("../Foo");
require("../Typeclass");

function main() {
  console.log(foo.null);
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
