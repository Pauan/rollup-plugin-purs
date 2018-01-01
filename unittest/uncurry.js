const assert = require("assert");
const $babel = require("babel-core");
const uncurry = require("../src/uncurry.js");

const testCases = [{
  codeIn: [
    "const sum = function (a){return function(b){return a + b}};",
    "sum(5)(7);"
  ].join("\n"),
  result: [
    "const _sum_uncurried = function (a,b){return a + b;};",
    "const sum = function (a){return function(b){return _sum_uncurried(a,b); }};",
    "_sum_uncurried(5,7);"
  ].join("\n")
}, {
  codeIn: [
    "const sum = function(a){return function(b){return a + b}};",
    "var b = 5;",
    "const sum5 = sum(b);",
    "sum5(7)"
  ].join("\n"),
  result: [
    "const _sum_uncurried = function (a, b) {",
    "  return a + b;",
    "};",

    "const sum = function (a) {",
    "  return function (b) {",
    "    return _sum_uncurried(a, b);",
    "  };",
    "};",
    "var b = 5;",
    // Current bug: the argument is named "b" and shadows the variable declaration above (var b = 5)
    "const sum5 = function (_b) {", 
    "  return _sum_uncurried(b, _b);",
    "};",
    "sum5(7);",
  ].join("\n")
}];

testCases.forEach(async function(testCase){
  var result = $babel.transform(testCase.codeIn, {
    babelrc: false,
    code: true,
    ast: true,
    sourceMaps: false,
    plugins: [
      [uncurry, {debug: true}]
    ]
  });

  assert(strip(result.code) === strip(testCase.result), [
    "",
    "",
    "------ The resulting code:",
    "",
    result.code,
    "",
    "------ is not equal to:",
    "",
    testCase.result,
    "",
    "------ Stripped: ",
    strip(result.code),
    strip(testCase.result)
  ].join("\n"));
});

function strip(string){
  return string.replace(/\s/g, "").replace(/;/g, "");
}
