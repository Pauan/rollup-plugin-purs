var bar = "bar4";

module.exports = {
  bar: "bar1",
  qux: "bar2",
  "uh": "bar3",
  "var": bar,
  "foo'": "bar5",
  main: main
};

function main() {
  console.log("nou");
}
