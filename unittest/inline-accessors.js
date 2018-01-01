const assert = require("assert");
const $babel = require("babel-core");
const inlineAccessors = require("../src/inline-accessors.js");

const testCases = [{
  codeIn: "var obj = { b: 2 };var b = function (a){ return a.b; }(obj);",
  result: "var obj = { b: 2 };var b = obj.b;"
}];

testCases.forEach(async function(testCase){
  var result = $babel.transform(testCase.codeIn, {
    babelrc: false,
    code: true,
    ast: true,
    sourceMaps: false,
    plugins: [
      [inlineAccessors, {debug: true}]
    ]
  });

  assert(result.code === testCase.result, `${result.code} is not equal to ${testCase.result}`);
});

