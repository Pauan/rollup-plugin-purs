var bar = "bar4";

exports.bar1 = "bar1";
exports.qux = "bar2";
exports["uh"] = "bar3";
exports["var"] = bar;
exports["foo'"] = "bar5";
exports.main = main;
//exports.main = main;

function curriedFn1(a) {
  return function () {
    return a;
  };
}

function curriedFn(a) {
  return function (b) {
    return function (c, d) {
      return function () {
        return a + b + c + d;
      };
    };
  };
}

function curriedFn2(a, b) {
  return function (c) {
    return function (d) {
      return function () {
        return a + b + c + d;
      };
    };
  };
}

exports.curried = function (a) {
  return function (b) {
    return function (c) {
      return a + b + c;
    };
  };
};

function main() {
  function innerCurried(a) {
    return function (b) {
      return function (c) {
        return a + b + c;
      };
    };
  }

  function innerCurried2(a) {
    return function (b) {
      return function (c) {
        return a + b + c;
      };
    };
  }

  (function () {
    function innerCurried(a) {
      return function (b) {
        return a + b;
      };
    }

    console.log(innerCurried(1)(2));
  })();

  (function () {
    //var innerCurried = 10;
    console.log(innerCurried(1)(2)(3));
  })();

  console.log(curriedFn1(1), curriedFn1(1)());
  console.log(curriedFn2(1, 2)(3)(4)());
  console.log(innerCurried2(1)(2));
  console.log("nou", curriedFn(1), curriedFn(1)(2), curriedFn(1)(2)(3), curriedFn(1)(2)(3, 4), curriedFn(1)(2)(3, 4)());
}
