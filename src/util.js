"use strict";

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


// TODO make this a pull request for https://github.com/rollup/rollup-pluginutils
exports.lookup = function (scope, name) {
  for (;;) {
    if (scope.declarations[name]) {
      return scope;

    } else if (scope.parent != null) {
      scope = scope.parent;

    } else {
      return null;
    }
  }
};


var tempIndex = 0;

// TODO make this a pull request for https://github.com/rollup/rollup-pluginutils
exports.makeTemporary = function (scope, name) {
  for (;;) {
    var mangled = name + "_" + (++tempIndex);

    if (!scope.declarations[mangled]) {
      scope.declarations[mangled] = true;
      return mangled;
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
  }
};
