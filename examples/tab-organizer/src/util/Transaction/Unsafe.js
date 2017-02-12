"use strict";


exports.unsafeLiftEff = function (eff) {
  return function (state) {
    return eff();
  };
};
