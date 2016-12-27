var foo = require("../../test/foo.js");

function main() {
  console.log("MAIN", foo.main());
}

module.exports = {
  main: main
};
