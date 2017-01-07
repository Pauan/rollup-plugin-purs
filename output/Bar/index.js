var bar = "bar4";

exports.bar1 = "bar1";
exports.qux = "bar2";
exports["uh"] = "bar3";
exports["var"] = bar;
exports["foo'"] = "bar5";
exports.main = main;
//exports.main = main;

function main() {
  console.log("nou");
}
