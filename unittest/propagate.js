const assert = require("assert");
const $babel = require("babel-core");
const propagate = require("../src/propagate.js");

const testCases = [{
  codeIn: function test(){
    var x = 5;
    console.log(7 + x);
  },
  result: function test() {
    var x = 5;
    console.log(7 + 5);
  }
}, {
  codeIn: function test(){
    var x = 5;
    var y = x;
    console.log(7 + y);
  },
  result: function test() {
    var x = 5;
    var y = 5;
    console.log(7 + 5);
  }
}];

testCases.forEach(async function(testCase){
  var result = $babel.transform(testCase.codeIn.toString(), {
    babelrc: false,
    code: true,
    ast: false,
    sourceMaps: false,
    plugins: [
      [propagate, {debug: true}]
    ]
  });

  assert(strip(result.code) === strip(testCase.result.toString()), [
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
