"use strict";

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

  $walk.raw(node, function (parent, node, traverse) {
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


var inlineVisitor = {
  // TODO handle NewExpression as well ?
  CallExpression: function (path, state) {
    var node = path.node;

    if (node.callee.type === "Identifier") {
      var binding = path.scope.getBinding(node.callee.name);

      if (binding != null) {
        // TODO handle aliasing
        if (state.seen.indexOf(binding) === -1) {
          state.seen.push(binding);

          // TODO a bit hacky
          $util.withFunctionDefinition(binding, function (binding, path, id, node) {
            // TODO make this faster ?
            path.get("body").traverse(inlineVisitor, state);
          });

        } else {
          state.recursive = true;
          path.stop();
        }
      }
    }
  },
  Function: function (path, state) {
    state.function = true;
    path.stop();
  }
};


function makeInlined(binding, path, id, top) {
  var body = top.body.body;

  if (body.length === 1 &&
      body[0].type === "ReturnStatement") {

    // Only inline if each argument is used at most once
    // TODO we can lift this restriction later, with better IIFE inlining techniques
    /*var seenOnce = top.params.every(function (x) {
      if (x.type === "Identifier") {
        var binding = path.scope.getBinding(x.name);

        console.assert(binding != null);

        return binding.constant && binding.references <= 1;

      } else {
        return false;
      }
    });*/

    var state = {
      function: false,
      recursive: false,
      seen: [binding] // TODO should this start with the binding or not ?
    };

    path.get("body").traverse(inlineVisitor, state);

    if (!state.function && !state.recursive) {
      binding.rollup_plugin_purs_inlined = {
        name: id,
        params: top.params,
        body: top.body,
        loc: top.loc
      };
    }
  }
}



module.exports = function (babel) {
  return {
    visitor: {
      CallExpression: {
        exit: function (path) {
          var node = path.node;

          if (node.callee.type === "Identifier") {
            var binding = path.scope.getBinding(node.callee.name);

            if (binding != null) {
              if (binding.rollup_plugin_purs_inlined == null) {
                binding.rollup_plugin_purs_inlined = false;

                $util.withFunctionDefinition(binding, makeInlined);
              }

              var inlined = binding.rollup_plugin_purs_inlined;

              if (inlined !== false) {
                node.callee = {
                  type: "FunctionExpression",
                  // TODO is this needed ?
                  //id: inlined.name,
                  params: inlined.params,
                  body: inlined.body,
                  // TODO is this correct ?
                  loc: inlined.loc
                };
              }
            }
          }
        }
      }
    }
  };
};
