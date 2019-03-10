const assert = require("assert");
const $babel = require("babel-core");
const typeclass = require("../src/typeclass.js");

const testCases = [{
  codeIn: function test(){
    var Show = function (show) {
      this.show = show;
    };
    var showString = new Show(function(s){return s; });
    showString.show("abc");
  },
  result: function test() {
    var Show = function (show) {
      this.show = show;
    };

    const _temp = function (s) {
      return s;
    };

    var showString = new Show(_temp);
    _temp("abc");
  }
}];

testCases.forEach(async function(testCase){
  var result = $babel.transform(testCase.codeIn.toString(), {
    babelrc: false,
    code: true,
    ast: false,
    sourceMaps: false,
    plugins: [
      [typeclass, {debug: true}]
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
