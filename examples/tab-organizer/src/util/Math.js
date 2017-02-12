"use strict";


// TODO test this
exports.hypot =
  (typeof Math.hypot === "function"
    ? function (x) {
        return function (y) {
          return Math.hypot(x, y);
        };
      }
    // TODO this should handle very large/small numbers https://en.wikipedia.org/wiki/Hypot
    : function (x) {
        return function (y) {
          return Math.sqrt((x * x) + (y * y));
        };
      });
