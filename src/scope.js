"use strict";

var $util = require("./util");


exports.state = function (state) {
  state.globals = {};
  state.varCounter = 0;
  state.scopes = [];
};


function generateName(state, prefix) {
  for (;;) {
    var name = prefix + "_" + (++state.varCounter);

    if (!state.globals[name]) {
      return name;
    }
  }
}


function withScope(state, type, fn) {
  var scope = {
    type: type,
    definitions: {},
    uniques: []
  };

  state.scopes.push(scope);

  try {
    return fn();

  } finally {
    state.scopes.pop();

    $util.eachObject(scope.definitions, function (key, binding) {
      var name = generateName(state, binding.name);

      binding.uses.forEach(function (node) {
        node.name = name;
      });
    });

    scope.uniques.forEach(function (binding) {
      var name = generateName(state, "");

      binding.identifier.name = name;
    });
  }
}

exports.withScope = withScope;


function markGlobal(state, name) {
  state.globals[name] = true;
}

exports.markGlobal = markGlobal;


function defineUnique(state, type) {
  var i = state.scopes.length;

  while (i--) {
    var scope = state.scopes[i];

    if (scope.type === type || scope.type === "program") {
      var binding = {
        identifier: {
          type: "Identifier",
          name: "" // TODO is this correct ?
        }
      };

      scope.uniques.push(binding);

      return binding;
    }
  }

  throw new Error("Could not define unique: invalid scope");
}

exports.defineUnique = defineUnique;


function defineVar(state, type, name) {
  var i = state.scopes.length;

  while (i--) {
    var scope = state.scopes[i];

    if (scope.type === type || scope.type === "program") {
      return scope.definitions[name] = {
        name: name,
        uses: []
      };
    }
  }

  throw new Error("Could not define var " + name + ": invalid scope");
}

exports.defineVar = defineVar;


function lookupVar(state, name) {
  var i = state.scopes.length;

  if (i === 0) {
    throw new Error("Could not lookup var " + name + ": invalid scope");
  }

  while (i--) {
    var scope = state.scopes[i];

    if ($util.hasKey(scope.definitions, name)) {
      return scope.definitions[name];
    }
  }

  return null;
}

exports.lookupVar = lookupVar;


function defineIdentifier(state, type, node) {
  var binding = defineVar(state, type, node.name);

  binding.uses.push(node);
}

exports.defineIdentifier = defineIdentifier;


function findFunctionDefinitions(parent, node, state) {
  if (node.type === "Program" || node.type === "BlockStatement") {
    node.body.forEach(function (x) {
      findFunctionDefinitions(node, x, state);
    });

  } else if (node.type === "LabeledStatement") {
    findFunctionDefinitions(node, node.body, state);

  } else if (node.type === "IfStatement") {
    findFunctionDefinitions(node, node.consequent, state);

    if (node.alternate != null) {
      findFunctionDefinitions(node, node.alternate, state);
    }

  } else if (node.type === "SwitchStatement") {
    node.cases.forEach(function (node) {
      node.consequent.forEach(function (x) {
        findFunctionDefinitions(node, x, state);
      });
    });

  } else if (node.type === "TryStatement") {
    findFunctionDefinitions(node, node.block, state);

    if (node.handler != null) {
      findFunctionDefinitions(node, node.handler.body, state);
    }

    if (node.finalizer != null) {
      findFunctionDefinitions(node, node.finalizer, state);
    }

  } else if (node.type === "WhileStatement" ||
             node.type === "DoWhileStatement") {
    findFunctionDefinitions(node, node.body, state);

  } else if (node.type === "ForStatement") {
    findFunctionDefinitions(node, node.init, state); // TODO is this correct ?
    findFunctionDefinitions(node, node.body, state);

  } else if (node.type === "ForInStatement") {
    findFunctionDefinitions(node, node.left, state); // TODO is this correct ?
    findFunctionDefinitions(node, node.body, state);

  } else if (node.type === "VariableDeclaration" && node.kind === "var") {
    node.declarations.forEach(function (x) {
      walkPattern(x, x.id, state, function (parent, x, state) {
        // TODO is this correct ?
        defineIdentifier(state, "function", x);
      });
    });
  }
}

exports.findFunctionDefinitions = findFunctionDefinitions;
