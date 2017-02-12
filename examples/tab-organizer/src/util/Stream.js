"use strict";


exports.makeImpl = function (f) {
  return f;
};


exports.eachImpl = function (onValue) {
  return function (onError) {
    return function (onComplete) {
      return function (stream) {
        return stream(onValue, onError, onComplete);
      };
    };
  };
};


exports.scanlImpl = function (f) {
  return function (init) {
    return function (stream) {
      return function (onValue, onError, onComplete) {
        return function () {
          var accumulated = init;

          // TODO is this a good idea ?
          onValue(accumulated)();

          return stream(function (value) {
            // TODO is this correct ?
            return function () {
              accumulated = f(accumulated)(value);
              return onValue(accumulated)();
            };
          }, onError, onComplete)();
        };
      };
    };
  };
};


exports.mapImpl = function (f) {
  return function (stream) {
    return function (onValue, onError, onComplete) {
      return stream(function (value) {
        return onValue(f(value));
      }, onError, onComplete);
    };
  };
};


exports.filterImpl = function (unit) {
  function noop() {
    return unit;
  }

  return function (f) {
    return function (stream) {
      return function (onValue, onError, onComplete) {
        return stream(function (value) {
          if (f(value)) {
            return onValue(value);

          } else {
            return noop;
          }
        }, onError, onComplete);
      };
    };
  };
};


exports.mergeImpl = function (unit) {
  return function (stream1) {
    return function (stream2) {
      return function (onValue, onError, onComplete) {
        return function () {
          var complete1 = false;
          var complete2 = false;

          function onError1(err) {
            // TODO is this correct ?
            return function () {
              // TODO test this
              stop2();
              return onError(err)();
            };
          }

          // TODO code duplication
          function onError2(err) {
            // TODO is this correct ?
            return function () {
              // TODO test this
              stop1();
              return onError(err)();
            };
          }

          function onComplete1() {
            complete1 = true;

            if (complete2) {
              return onComplete();

            } else {
              return unit;
            }
          }

          // TODO code duplication
          function onComplete2() {
            complete2 = true;

            if (complete1) {
              return onComplete();

            } else {
              return unit;
            }
          }

          var stop1 = stream1(onValue, onError1, onComplete1)();

          var stop2 = stream2(onValue, onError2, onComplete2)();

          return function () {
            stop1();
            return stop2();
          };
        };
      };
    };
  };
};


// TODO test this
exports.streamArrayImpl = function (unit) {
  function noop() {
    return unit;
  }

  return function (array) {
    var length = array.length;

    return function (onValue, onError, onComplete) {
      return function () {
        for (var i = 0; i < length; ++i) {
          onValue(array[i])();
        }

        onComplete();

        return noop;
      };
    };
  };
};


// TODO test this
exports.streamTraverseImpl = function (unit) {
  function noop() {
    return unit;
  }

  return function (traverse_) {
    return function (a) {
      return function (onValue, onError, onComplete) {
        return function () {
          traverse_(onValue)(a)();

          onComplete();

          return noop;
        };
      };
    };
  };
};
