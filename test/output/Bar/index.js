var globals = 10;

(function () {
  console.log(globals_119);
})();

console.log(globals);


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
var recursivePropagation2 = (1, recursivePropagation2);

console.log(recursivePropagation);
console.log(recursivePropagation2);

function main() {
  function recursiveCurry(a) {
    return function (b) {
      return function (c) {
        return a + b + c + recursiveCurry(a)(b)(c);
      };
    };
  }

  function recursiveCurry2(a) {
    return function (b) {
      return function (c) {
        return a + b + c + recursiveCurry2(a)(b);
      };
    };
  }

  console.log(recursiveCurry(1)(2)(3));
  console.log(recursiveCurry2(1)(2)(3));

  function innerCurried(a) {
    return function (b) {
      return function (c) {
        return a + b + c;
      };
    };
  }

  var innerCurriedVar = innerCurried;
  var innerCurriedVar2 = innerCurriedVar;

  var propagatedPre = (delete a.bar),
      propagated = (10 + 50, 20, 30),
      propagatedPost = (delete a.bar);
  var notPropagated = (delete a.bar, 50);

  var assigned = 0;

  assigned = 10;

  console.log(propagatedPre);
  console.log(propagated);
  console.log(propagatedPost);
  console.log(notPropagated);
  console.log(assigned);

  function unsafeCompareImplRecursive(a) {
    return function (b) {
      return function (c) {
        return function (d) {
          return a + b + c + d + unsafeCompareImplRecursive(1)(2)(3)(4);
        };
      };
    };
  }

  function unsafeCompareImpl(a) {
    return function (b) {
      return function (c) {
        return function (d) {
          return a + b + c + d;
        };
      };
    };
  }

  var unsafeCompare1 = unsafeCompareImpl(1);
  var unsafeCompare2 = unsafeCompareImpl(1)(2);
  var unsafeCompare3 = unsafeCompareImpl(1)(2)(3);
  var unsafeCompare4 = unsafeCompareImpl(1)(2)(3)(4);
  var unsafeCompare5 = unsafeCompareImpl(1)(2)(3)(4)(5);
  var unsafeCompare6 = unsafeCompareImpl(1)(2)(3)(4)(5)(6);

  var unsafeCompare7 = unsafeCompare1(2)(3)(4);
  var unsafeCompare8 = unsafeCompare2(3);
  var unsafeCompare9 = unsafeCompare3(4);

  console.log(unsafeCompareImplRecursive(1)(2)(3)(4));
  console.log(unsafeCompareImpl);
  console.log(unsafeCompareImpl);
  console.log(unsafeCompareImpl);
  console.log(unsafeCompare1);
  console.log(unsafeCompare2);
  console.log(unsafeCompare8);

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

    function innerCurried2(a) {
      return function (b) {
        return a + b;
      };
    }

    function innerCurried3(a) {
      return function (b) {
        return function (c) {
          return a + b + c;
        };
      };
    }

    innerCurried2 = 50;

    console.log(innerCurried(1)(2));
    console.log(innerCurried2(1)(2));
    console.log(innerCurried3(1)(qux = 2)(foo(3)));
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

  (function () {
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
