var $walk = require("./walk");
var $util = require("./util");


// TODO TemplateLiteral
// TODO TaggedTemplateExpression
// TODO TemplateElement
// TODO ClassBody
// TODO MethodDefinition
// TODO ClassDeclaration
// TODO ClassExpression
// TODO MetaProperty
// TODO ImportDeclaration
// TODO ImportSpecifier
// TODO ImportDefaultSpecifier
// TODO ImportNamespaceSpecifier
// TODO ExportNamedDeclaration
// TODO ExportSpecifier
// TODO ExportDefaultDeclaration
// TODO ExportAllDeclaration
var weights = {
  "Identifier": 1,
  "Literal": 1,
  "Program": 0,
  "ExpressionStatement": 0,
  "BlockStatement": 0,
  "EmptyStatement": 0,
  "DebuggerStatement": 8,
  "WithStatement": 6,
  "ReturnStatement": 6,
  "LabeledStatement": 1,
  "SwitchStatement": 10,
  "ThrowStatement": 5,
  "CatchClause": 9,
  "WhileStatement": 7,
  "DoWhileStatement": 10,
  "ForStatement": 7,
  "ForInStatement": 7,
  "FunctionDeclaration": Infinity, // TODO async functions and generators
  "VariableDeclarator": 1,
  "ThisExpression": 4,
  "FunctionExpression": Infinity, // TODO async functions and generators
  "UpdateExpression": 2,
  "LogicalExpression": 2,
  "ConditionalExpression": 2,
  "AwaitExpression": 5,
  "ForOfStatement": 7,
  "Super": 5,
  "SpreadElement": 3,
  "ArrowFunctionExpression": Infinity, // TODO async functions and generators
  "YieldExpression": 5,
  "RestElement": 3,
  "AssignmentPattern": 1
};


function calculateWeight(node) {
  var weight = 0;

  $walk.raw(node, function (node, traverse) {
    if (node.type === "Literal") {
      weight += ("" + node.value).length;

    } else if (node.type === "BreakStatement") {
      weight += (node.label == null ? 5 : 6);

    } else if (node.type === "ContinueStatement") {
      weight += (node.label == null ? 8 : 9);

    } else if (node.type === "IfStatement") {
      weight += (node.alternate == null ? 4 : 8);

    } else if (node.type === "SwitchCase") {
      weight += (node.test == null ? 8 : 6);

    } else if (node.type === "TryStatement") {
      weight += (node.finalizer == null ? 7 : 16);

    } else if (node.type === "VariableDeclaration") {
      weight += node.kind.length + 1;

    } else if (node.type === "ArrayExpression" || node.type === "ArrayPattern") {
      weight += 2 + (node.elements.length > 1 ? node.elements.length - 1 : 0);

    } else if (node.type === "ObjectExpression" || node.type === "ObjectPattern") {
      weight += 2 + (node.properties.length > 1 ? node.properties.length - 1 : 0);

    } else if (node.type === "Property") {
      if (node.kind === "init") {
        weight += 1;

      } else if (node.kind === "get") {
        // TODO is this correct ?
        weight += 3;

      } else if (node.kind === "set") {
        // TODO is this correct ?
        weight += 3;

      } else {
        weight += Infinity;
      }

    } else if (node.type === "UnaryExpression") {
      weight += node.operator.length;

    } else if (node.type === "BinaryExpression") {
      weight += node.operator.length;

    } else if (node.type === "AssignmentExpression") {
      weight += node.operator.length;

    } else if (node.type === "MemberExpression") {
      weight += (node.computed ? 2 : 1);

    } else if (node.type === "CallExpression") {
      weight += 2 + (node.arguments.length > 1 ? node.arguments.length - 1 : 0);

    } else if (node.type === "NewExpression") {
      if (node.arguments.length === 0) {
        weight += 3;

      } else {
        weight += 3 + 2 + (node.arguments.length > 1 ? node.arguments.length - 1 : 0);
      }

    } else if (node.type === "SequenceExpression") {
      weight += (node.expressions.length > 1 ? node.expressions.length - 1 : 0);

    } else if (weights[node.type] != null) {
      weight += weights[node.type];

    } else {
      weight += Infinity;
    }

    traverse(node);
    return node;
  });

  return weight;
}


function makeInlined(id, top, scope) {
  var body = top.body.body;

  if (body.length === 1 &&
      body[0].type === "ReturnStatement" &&
      // Don't inline curried functions
      body[0].argument.type !== "FunctionExpression") {

    var weight = calculateWeight(body[0].argument);

    if (weight < 50) {
      // TODO hacky
      // TODO use scope.contains ?
      if (scope.inlined == null) {
        scope.inlined = {};
      }

      scope.inlined[id.name] = {
        name: id,
        params: top.params,
        body: top.body,
        loc: top.loc
      };
    }
  }

  /*if (body.length === 1 &&
      body[0].type === "ReturnStatement" &&
      // Don't inline curried functions
      body[0].argument.type !== "FunctionExpression" &&
      top.params.every(function (x) { return x.type === "Identifier"; })) {

    var seen = {};

    top.params.forEach(function (x) {
      seen[x.name] = 0;
    });

    $walk(body[0].argument, function (node, traverse) {
      if (node.type === "Identifier" &&
          $util.hasKey(seen, node.name)) {
        ++seen[node.name];
      }

      traverse(node);

      return node;
    });

    if (top.params.every(function (x) { return seen[x.name] <= 1; })) {
      var indexes = {};

      top.params.forEach(function (x, i) {
        indexes[x.name] = i;
      });

      // TODO hacky
      // TODO use scope.contains ?
      if (scope.inlined == null) {
        scope.inlined = {};
      }

      scope.inlined[id.name] = {
        name: id,
        params: top.params,
        body: top.body,
        loc: top.loc,
        indexes: indexes,
        expression: body[0].argument
      };
    }
  }*/
}


function lookupInlined(top, scope) {
  if (top.type === "Identifier") {
    var name = top.name;

    var def = $util.lookup(scope, name);

    if (def != null &&
        def.inlined != null &&
        $util.hasKey(def.inlined, name)) {
      return def.inlined[name];
    }
  }

  return null;
}


function lookupInlinedCall(top, scope) {
  var inlined = lookupInlined(top.callee, scope);

  if (inlined !== null) {
    return {
      name: inlined.name,
      expression: {
        type: "CallExpression",
        callee: {
          type: "FunctionExpression",
          id: inlined.name,
          params: inlined.params,
          body: inlined.body,
          // TODO is this correct ?
          loc: inlined.loc
        },
        arguments: top.arguments,
        loc: top.loc
      }
    };

  } else {
    return null;
  }
}


function findInlineFunctions(ast, scope) {
  // TODO use $walk.scope ?
  return $walk.raw(ast, function (node, traverse) {
    if (node.type === "FunctionDeclaration") {
      makeInlined(node.id, node, scope);

    } else if (node.type === "VariableDeclaration") {
      node.declarations.forEach(function (x) {
        if (x.init !== null && x.init.type === "FunctionExpression") {
          makeInlined(x.id, x.init, scope);
        }
      });
    }

    // TODO code duplication
    if (node.scope != null) {
      scope = node.scope;
    }

    try {
      traverse(node);

    } finally {
      // TODO is this correct ?
      if (node.scope != null) {
        scope = scope.parent;
      }
    }

    return node;
  });
}


function pushInline(id, scope, stack, traverse, node) {
  var inlined = lookupInlined(id, scope);

  if (inlined !== null) {
    stack.push(inlined.name.name);

    try {
      traverse(node);

    } finally {
      stack.pop();
    }

    return node;

  } else {
    traverse(node);
    return node;
  }
}


function inlineFunctionCalls(ast, scope) {
  var stack = [];

  // TODO is this correct ?
  var recursive = false;

  return $walk.scope(ast, scope, function (node, scope, traverse) {
    // TODO code duplication
    if (node.type === "FunctionDeclaration") {
      return pushInline(node.id, scope, stack, traverse, node);

    // TODO code duplication
    } else if (node.type === "VariableDeclaration") {
      // TODO should this traverse twice...?
      node.declarations.forEach(function (x) {
        if (x.init !== null && x.init.type === "FunctionExpression") {
          // TODO is this correct ?
          pushInline(x.id, scope, stack, traverse, x);
        }
      });

    } else if (node.type === "CallExpression") {
      var inlined = lookupInlinedCall(node, scope);

      if (inlined !== null) {
        if (stack.indexOf(inlined.name.name) === -1) {
          recursive = false;

          stack.push(inlined.name.name);

          try {
            traverse(inlined.expression);

          } finally {
            stack.pop();
          }

          if (recursive) {
            // TODO should this traverse or not ?
            recursive = false;

          } else {
            return inlined.expression;
          }

        } else {
          // TODO is there a better way of doing this ?
          recursive = true;
          // TODO should this traverse ?
          return node;
        }
      }
    }

    traverse(node);

    return node;
  });
}


module.exports = function (ast, scope) {
  return inlineFunctionCalls(findInlineFunctions(ast, scope), scope);
};
