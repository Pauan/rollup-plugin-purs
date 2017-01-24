var bar = "bar4";

exports.bar1 = "bar1";
exports.qux = "bar2";
exports["uh"] = "bar3";
exports["var"] = bar;
exports["foo'"] = "bar5";
exports.main = main;
exports.hasOwnProperty = "hi!";
exports.null = 10;
//exports.main = main;

var log = 50;

console.log(log);

console.log(exports.null);

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

var curriedFnVar = exports.curried;

var recursivePropagation = recursivePropagation;

console.log(recursivePropagation);

function main() {
  function innerCurried(a) {
    return function (b) {
      return function (c) {
        return a + b + c;
      };
    };
  }

  var innerCurriedVar = innerCurried;
  var innerCurriedVar2 = innerCurriedVar;

  var propagated = (10 + 50, 20, 30);
  var notPropagated = (delete a.bar, 50);

  console.log(propagated);
  console.log(notPropagated);

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

  (function (innerCurried) {
    console.log(innerCurriedVar(1)(2)(3));
  })();

  (function (innerCurried) {
    var innerCurriedVar2 = innerCurriedVar;
    console.log(innerCurriedVar2(1)(2)(3));
  })();

  (function (innerCurried, innerCurriedVar) {
    console.log(innerCurriedVar2(1)(2)(3));
  })();

  console.log(curriedFnVar(1)(2)(3));
  console.log(curriedFn1(1), curriedFn1(1)());
  console.log(curriedFn2(1, 2)(3)(4)());
  console.log(innerCurried2(1)(2));
  console.log("nou", curriedFn(1), curriedFn(1)(2), curriedFn(1)(2)(3), curriedFn(1)(2)(3, 4), curriedFn(1)(2)(3, 4)());
}
