const assert = require("assert");
const $babel = require("babel-core");
const deadCode = require("../src/dead-code.js");

const testCases = [{
  codeIn: function test(){
    var x = 5;
    console.log("derp");
  },
  result: function test() {
    console.log("derp");
  }
}, {
  codeIn: function __do(){
    var y = console.log("derp");
  },
  result: function __do() {
    console.log("derp");
  }
}, {
  codeIn: function test(){
    var y = console.log("derp");
  },
  result: function test() {
  }
}];

// We're running the testcases different than in other unit tests here,
// we're making the outer function into an IIFE, otherwise the outer function
// just gets DCE'd
testCases.forEach(async function(testCase){
  var result = $babel.transform(`(${testCase.codeIn.toString()})()`, {
    babelrc: false,
    code: true,
    ast: false,
    sourceMaps: false,
    plugins: [
      [deadCode, {
        debug: true,
        assumePureVars: true
      }]
    ]
  });

  assert(strip(result.code) === strip(`(${testCase.result.toString()})()`), [
    "",
    "",
    "------ The resulting code:",
    "",
    result.code,
    "",
    "------ is not equal to:",
    "",
    testCase.result.toString(),
    "",
    "------ Stripped: ",
    strip(result.code),
    strip(testCase.result.toString())
  ].join("\n"));
});

function strip(string){
  return string.replace(/\s/g, "").replace(/;/g, "");
}
