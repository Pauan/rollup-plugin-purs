exports.hasKey = function (obj, key) {
  return {}.hasOwnProperty.call(obj, key);
};
