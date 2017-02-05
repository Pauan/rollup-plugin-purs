"use strict";

var $acorn = require("acorn");
var $util = require("./util");
var $isReference = require("is-reference");


function isObject(x) {
  return x != null && typeof x === "object";
}

function walkArray(array, node, state, fn) {
  var length = array.length;

  for (var i = 0; i < length; ++i) {
    var value = array[i];

    // TODO is this correct ?
    if (value != null) {
      console.assert(typeof value.type === "string");

      fn(node, value, state);
    }
  }
}

function walk(node, state, fn) {
  console.assert(typeof node.type === "string");

  // TODO is this necessary ?
  var keys = Object.keys(node);

  var length = keys.length;

  for (let i = 0; i < length; ++i) {
    var key = keys[i];
    var value = node[key];

    if (isObject(value)) {
      if (Array.isArray(value)) {
        walkArray(value, node, state, fn);

      } else if (typeof value.type === "string") {
        fn(node, value, state);
      }
    }
  }
}


/*function walk(node, state, override, fn) {
  $walk.base[override || node.type](node, state, fn);
}*/


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


function markGlobal(state, name) {
  state.globals[name] = true;
}


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


function withBlock(state, type, fn) {
  var oldBlock = state.block;

  state.block = [];

  try {
    return withScope(state, type, fn);

  } finally {
    state.block = oldBlock;
  }
}


function walkPattern(parent, node, state, fn) {
  if (node.type === "Identifier") {
    fn(parent, node, state);

  } else if (node.type === "ObjectPattern") {
    // TODO what about computed keys ?
    node.properties.forEach(function (x) {
      walkPattern(x, x.value, state, fn);
    });

  } else if (node.type === "ArrayPattern") {
    node.elements.forEach(function (x) {
      if (x != null) {
        walkPattern(node, x, state, fn);
      }
    });

  } else if (node.type === "RestElement") {
    walkPattern(node, node.argument, state, fn);

  } else if (node.type === "AssignmentPattern") {
    walkPattern(node, node.left, state, fn);
    // TODO is this correct ?
    traverseExpression(node, node.right, state);

  } else {
    throw new Error("Invalid type: " + node.type);
  }
}


function variableDeclaration(kind, id, init, base) {
  return {
    type: "VariableDeclaration",
    kind: kind,
    declarations: [{
      type: "VariableDeclarator",
      id: id,
      init: init,
      start: base.start,
      end: base.end,
      loc: base.loc
    }],
    start: base.start,
    end: base.end,
    loc: base.loc
  };
}


function makeBlockStatement(node) {
  if (node.type !== "BlockStatement") {
    return {
      type: "BlockStatement",
      body: [node],
      start: node.start,
      end: node.end,
      loc: node.loc
    };

  } else {
    return node;
  }
}


function defineIdentifier(state, type, node) {
  var binding = defineVar(state, type, node.name);

  binding.uses.push(node);
}


function isFunctionExpression(node) {
  return node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";
}


function traverseFunction(parent, node, state, id) {
  withScope(state, "function", function () {
    if (id != null) {
      defineIdentifier(state, "function", id);
    }

    node.params.forEach(function (x) {
      // TODO what about variables which are used before being defined (e.g. default arguments)
      walkPattern(node, x, state, function (parent, x, state) {
        defineIdentifier(state, "function", x);
      });
    });

    node.body = makeBlockStatement(node.body);

    findFunctionDefinitions(node, node.body, state);

    traverseBlock(node, node.body, state);
  });
}


function traverseExpression(parent, node, state) {
  if (isFunctionExpression(node)) {
    traverseFunction(parent, node, state, node.id);

  } else if (node.type === "Identifier") {
    if ($isReference(node, parent)) {
      var binding = lookupVar(state, node.name);

      if (binding == null) {
        markGlobal(state, node.name);

      } else {
        binding.uses.push(node);
      }
    }

  } else {
    walk(node, state, traverseExpression);
  }
}


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


function findBlockDefinitions(parent, node, state) {
  node.body.forEach(function (x) {
    // FunctionDeclarations are block scoped
    if (x.type === "FunctionDeclaration") {
      defineIdentifier(state, "block", x.id);

    // let / const
    } else if (x.type === "VariableDeclaration" && x.kind !== "var") {
      x.declarations.forEach(function (x) {
        walkPattern(x, x.id, state, function (parent, x, state) {
          defineIdentifier(state, "block", x);
        });
      });
    }
  });
}


function traverseBlock(parent, node, state) {
  withBlock(state, "block", function () {
    findBlockDefinitions(parent, node, state);

    node.body.forEach(function (x) {
      traverseStatement(node, x, state);
    });

    node.body = state.block;
  });
}


// TODO ClassDeclaration
// TODO ImportDeclaration
// TODO ExportNamedDeclaration
// TODO ExportDefaultDeclaration
// TODO ExportAllDeclaration
// TODO SwitchStatement
// TODO WhileStatement
// TODO DoWhileStatement
// TODO ForStatement
// TODO ForInStatement
// TODO ForOfStatement
// TODO LabeledStatement
// TODO BreakStatement
// TODO ContinueStatement
function traverseStatement(parent, node, state) {
  if (node.type === "Program") {
    withBlock(state, "program", function () {
      findBlockDefinitions(parent, node, state);
      findFunctionDefinitions(parent, node, state); // TODO is this correct ?

      node.body.forEach(function (x) {
        traverseStatement(node, x, state);
      });

      node.body = state.block;
    });

    state.block.push(node);

  } else if (node.type === "BlockStatement") {
    traverseBlock(parent, node, state);

    state.block.push(node);

  } else if (node.type === "FunctionDeclaration") {
    traverseFunction(parent, node, state, null);

    state.block.push(node);

  } else if (node.type === "VariableDeclaration") {
    node.declarations.forEach(function (x) {
      if (x.init != null) {
        traverseExpression(x, x.init, state);
      }

      state.block.push(variableDeclaration(node.kind, x.id, x.init, x));
    });

  } else if (node.type === "ExpressionStatement") {
    traverseExpression(node, node.expression, state);
    state.block.push(node);

  } else if (node.type === "EmptyStatement") {
    // Do nothing

  } else if (node.type === "ReturnStatement") {
    if (node.argument != null) {
      traverseExpression(node, node.argument, state);
    }
    state.block.push(node);

  } else if (node.type === "ThrowStatement") {
    traverseExpression(node, node.argument, state);
    state.block.push(node);

  } else if (node.type === "TryStatement") {
    traverseBlock(node, node.block, state);

    if (node.handler != null) {
      // TODO is this the correct type of scope ?
      withScope(state, "block", function () {
        walkPattern(node.handler, node.handler.param, state, function (parent, x, state) {
          defineIdentifier(state, "block", x);
        });

        traverseBlock(node.handler, node.handler.body, state);
      });
    }

    if (node.finalizer != null) {
      traverseBlock(node, node.finalizer, state);
    }

    state.block.push(node);

  } else if (node.type === "DebuggerStatement") {
    state.block.push(node);

  } else if (node.type === "IfStatement") {
    traverseExpression(node, node.test, state);

    node.consequent = makeBlockStatement(node.consequent);
    traverseBlock(node, node.consequent, state);

    if (node.alternate != null) {
      node.alternate = makeBlockStatement(node.alternate);
      traverseBlock(node, node.alternate, state);
    }

    state.block.push(node);

  } else {
    throw new Error("Unknown statement: " + node.type);
  }
}


module.exports = function (code, filename) {
  var ast = $acorn.parse(code, {
    sourceType: "module",
    allowHashBang: true, // TODO is this a good idea ?
    locations: true,
    sourceFile: filename
  });

  // TODO maybe use traverseBlock instead ?
  traverseStatement(null, ast, {
    globals: {},
    varCounter: 0,
    scopes: [],
    block: []
  });

  console.log(require("escodegen").generate(ast));

  return;
};
