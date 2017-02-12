"use strict";


// TODO test this
exports.usingImpl = function (create) {
  return function (use) {
    return function (destroy) {
      return function () {
        var x = create();

        try {
          return use(x)();

        } finally {
          destroy(x)();
        }
      };
    };
  };
};
