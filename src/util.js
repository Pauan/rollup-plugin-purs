"use strict";


exports.pushAll = function (a, b) {
  var length = b.length;

  for (var i = 0; i < length; ++i) {
    a.push(b[i]);
  }
};


exports.flatten = function (a) {
  // TODO better flatten function ?
  return [].concat.apply([], a);
};


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


exports.withFunctionDefinition = function (binding, fn) {
  var definition = binding.path.node;

  if (definition.type === "FunctionDeclaration") {
    fn(binding, binding.path, definition.id, definition);

  } else if (definition.type === "VariableDeclarator" &&
             definition.id.type === "Identifier" &&
             definition.init != null &&
             definition.init.type === "FunctionExpression") {
    fn(binding, binding.path.get("init"), definition.id, definition.init);

  } else {
    // TODO loc
    // TODO better warning
    //console.warn("Unknown type: " + definition.type);
  }
};
