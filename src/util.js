exports.hasKey = function (obj, key) {
  return {}.hasOwnProperty.call(obj, key);
};

// TODO prevent an infinite loop from occurring ?
exports.matches = function (string, re) {
  const output = [];

  for (;;) {
    const a = re.exec(string);

    if (a == null) {
      return output;

    } else {
      output.push(a.slice(1));
    }
  }
};
