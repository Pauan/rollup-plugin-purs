var foo = require("../Foo");

function main() {
  console.log("MAIN", foo.main());
}

module.exports = {
  main: main
};
