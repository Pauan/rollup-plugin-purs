var foo = require("../Foo");

function main() {
  console.log("MAIN", foo.main(), foo.curried(1), foo.curried(1)(2), foo.curried(1)(2)(3), foo.curried(1)(2)(3)(4));
}

module.exports = {
  main: main
};
