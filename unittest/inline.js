const assert = require("assert");
const $babel = require("babel-core");
const inline = require("../src/inline.js");

const testCases = [{
  codeIn: function test(){
    function sum5(a){ return a + 5; };
    sum5(7);
  },
  result: function test() {
    function sum5(a){ return a + 5; };
    (function (a){ return a + 5; })(7);
  }
}];

testCases.forEach(async function(testCase){
  var result = $babel.transform(testCase.codeIn.toString(), {
    babelrc: false,
    code: true,
    ast: false,
    sourceMaps: false,
    plugins: [
      [inline, {debug: true}]
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
