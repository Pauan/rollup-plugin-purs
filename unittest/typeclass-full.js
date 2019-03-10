const assert = require("assert");
const $babel = require("babel-core");
const typeclass = require("../src/typeclass.js");
const removeIIFE = require("../src/remove-iife.js");
const inline = require("../src/inline.js");
const deadCode = require("../src/dead-code.js");

// Since a few plugins are working together to optimize PS's typeclass code gen,
// I thought it would be useful to make a sort of integration test for it

const testCases = [{
  codeIn: function test(){
    var Show = function (show) {
      this.show = show;
    };
    var showString = new Show(function(s){return s; });
    console.log((function(dict){
      return dict.show;
    }(showString)("abc")));
  },
  // TODO: Why is _temp not getting inlined further?
  // TODO: why is "var Show = ..." and "var showString = ..." not being DCE'd?
  result: function test() {
    var Show = function (show) {
      this.show = show;
    };

    const _temp = function (s) {
      return s;
    };

    var showString = new Show(_temp);
    console.log(_temp("abc"));
  }
}];

testCases.forEach(async function(testCase){
  var result = $babel.transform(`(${testCase.codeIn.toString()})()`, {
    babelrc: false,
    code: true,
    ast: false,
    sourceMaps: false,
    plugins: [
      [removeIIFE, {debug: true}],
      [inline, {debug: true}],
      [typeclass, {debug: true}],
      [deadCode, {debug: true, assumePureVars: true}]
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
