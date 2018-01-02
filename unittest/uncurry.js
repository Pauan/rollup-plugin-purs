const assert = require("assert");
const $babel = require("babel-core");
const uncurry = require("../src/uncurry.js");

const testCases = [{
  codeIn: function test(){
    const sum = function (a){
      return function(b){
        return a + b;
      };
    };
    sum(5)(7);
  },
  result: function test(){
    const _sum_uncurried = function (a,b){
      return a + b;
    };
    const sum = function (a){
      return function(b){
        return _sum_uncurried(a,b);
      };
    };
    _sum_uncurried(5,7);
  }
}, {
  codeIn: function test(){
    const sum = function(a){
      return function(b){
        return a + b;
      };
    };
    var b = 5;
    const sum5 = sum(b);
    sum5(7);
  },
  result: function test(){
    const _sum_uncurried = function (a, b) {
      return a + b;
    };

    const sum = function (a) {
      return function (b) {
        return _sum_uncurried(a, b);
      };
    };
    var b = 5;
    const sum5 = function (_b) {
      return _sum_uncurried(b, _b);
    };
    sum5(7);
  }
}, {
  codeIn: function test(){
    var sum = function(a){
      return function(b){
        var sumInner = function(a){
          return function(b){
            return sum(a, b);
          };
        };
        return sumInner(a)(b);
      };
    };
    sum(5)(7);
  },
  result: function test() {
    const _sum_uncurried = function (a, b) {
      const _sumInner_uncurried2 = function (a, b) {
        return sum(a, b);
      };

      var sumInner = function (a) {
        return function (b) {
          return _sumInner_uncurried2(a, b);
        };
      };
      return _sumInner_uncurried2(a, b);
    };

    var sum = function (a) {
      return function (b) {
        const _sumInner_uncurried = function (a, b) {
          return sum(a, b);
        };

        return _sum_uncurried(a, b);
      };
    };
    _sum_uncurried(5, 7);
  }
}];

testCases.forEach(async function(testCase){
  var result = $babel.transform(testCase.codeIn.toString(), {
    babelrc: false,
    code: true,
    ast: false,
    sourceMaps: false,
    plugins: [
      [uncurry, {debug: true}]
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
