"use strict";

var $acorn = require("acorn");
var $util = require("./util");
var $traverseExpression = require("./expression");


/*function walk(node, state, override, fn) {
  $walk.base[override || node.type](node, state, fn);
}*/


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
    node.right = $traverseExpression(node, node.right, state, false);

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


function _void(node) {
  return {
    type: "UnaryExpression",
    operator: "void",
    prefix: true,
    argument: {
      type: "Literal",
      value: 0,
      start: node.start,
      end: node.end,
      loc: node.loc
    },
    start: node.start,
    end: node.end,
    loc: node.loc
  };
}


function expressionStatement(node) {
  return {
    type: "ExpressionStatement",
    expression: node,
    start: node.start,
    end: node.end,
    loc: node.loc
  };
}


function assignmentExpression(left, right, base) {
  return {
    type: "AssignmentExpression",
    operator: "=",
    left: left,
    right: right,
    start: base.start,
    end: base.end,
    loc: base.loc
  };
}


function hasSideEffects(parent, node, state) {
  if ((node.type === "UpdateExpression") ||
      (node.type === "UnaryExpression" && node.operator === "delete") ||
      (node.type === "AssignmentExpression") ||
      // TODO this is a little bit strict...
      (node.type === "MemberExpression") ||
      (node.type === "CallExpression") ||
      (node.type === "NewExpression")) {
    return true;

  } else {
    return walk(node, state, hasSideEffects);
  }
}


function optimizeIIFE(parent, node, state) {
  node.callee = $traverseExpression(node, node.callee, state, true);

  var callee = node.callee;

  node.arguments = node.arguments.map(function (x) {
    return $traverseExpression(node, x, state, true);
  });

  var params = callee.params;

  // TODO what if the arguments is shorter than the params ?
  node.arguments.forEach(function (x, i) {
    if (i < params.length) {
      var param = params[i];

      // TODO should this use var or let ?
      // TODO should this call traverseStatement ?
      // TODO should this call findFunctionDefinitions ?
      state.block.push(variableDeclaration("var", param, x, x));

    } else {
      // TODO should this call traverseStatement ?
      state.block.push(expressionStatement(x));
    }
  });

  // TODO make this faster
  params.forEach(function (x, i) {
    if (i >= node.arguments.length) {
      // TODO should this use var or let ?
      // TODO should this call traverseStatement ?
      // TODO should this call findFunctionDefinitions ?
      state.block.push(variableDeclaration("var", x, null, x));
    }
  });

  if (callee.body.body.length === 1 &&
      callee.body.body[0].type === "ReturnStatement") {
    return callee.body.body[0].argument;

  } else {
    var returnUnique = null;

    function loop(parent, node, state) {
      if (node.type === "ReturnStatement") {
        if (returnUnique === null) {
          returnUnique = defineUnique(state, "block")
        }

        return expressionStatement(assignmentExpression(returnUnique.identifier, node.argument, node));

      } else if (isFunction(node)) {
        return node;

      } else {
        walk(node, state, loop);
        return node;
      }
    }

    callee.body = loop(callee, callee.body, state);

    if (returnUnique !== null) {
      // TODO should this use var or let ?
      // TODO should this call traverseStatement ?
      // TODO should this call findFunctionDefinitions ?
      state.block.push(variableDeclaration("var", returnUnique.identifier, null, returnUnique.identifier));

      // TODO use traverseStatement ?
      callee.body.body.forEach(function (x) {
        state.block.push(x);
      });

      return returnUnique.identifier;

    } else {
      // TODO use traverseStatement ?
      callee.body.body.forEach(function (x) {
        state.block.push(x);
      });

      return _void(node);
    }
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
        x.init = $traverseExpression(x, x.init, state, false);
      }

      state.block.push(variableDeclaration(node.kind, x.id, x.init, x));
    });

  } else if (node.type === "ExpressionStatement") {
    node.expression = $traverseExpression(node, node.expression, state, false);
    state.block.push(node);

  } else if (node.type === "EmptyStatement") {
    // Do nothing

  } else if (node.type === "ReturnStatement") {
    if (node.argument != null) {
      node.argument = $traverseExpression(node, node.argument, state, false);
    }
    state.block.push(node);

  } else if (node.type === "ThrowStatement") {
    node.argument = $traverseExpression(node, node.argument, state, false);
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
    node.test = $traverseExpression(node, node.test, state, false);

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

  var state = {};

  $scope.state(state);

  // TODO maybe use traverseBlock instead ?
  traverseStatement(null, ast, {
    block: []
  });

  console.log(require("escodegen").generate(ast));

  return;
};
