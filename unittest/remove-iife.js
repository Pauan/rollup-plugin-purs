const assert = require("assert");
const $babel = require("babel-core");
const removeIIFE = require("../src/remove-iife.js");

const testCases = [{
  codeIn: function test(){
    (function(a){ return a + 5; })(7);
  },
  result: function test() {
    7 + 5;
  }
}, {
  // Test case for #24: Endless loop
  codeIn: function test(){
    var x = {a: 7};
    (function(x){x + 5;})(x.a);
  }, result: function test(){
    var x = {a: 7};
    x.a + 5;void 0;
  }
}];

testCases.forEach(async function(testCase){
  var result = $babel.transform(testCase.codeIn.toString(), {
    babelrc: false,
    code: true,
    ast: false,
    sourceMaps: false,
    plugins: [
      [removeIIFE, {debug: true}]
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
