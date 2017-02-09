"use strict";

var $util = require("./util");


// TODO code duplication
function canInlineParams(params) {
  return params.every(function (x) {
    return x !== null;
  });
}


// TODO code duplication
function canInlineFunction(node) {
  // TODO allow for the id, as long as it's not called ?
  return node.id === null &&
         node.body.body.length === 1 &&
         node.body.body[0].type === "ReturnStatement";
}


// TODO loc
var _void = {
  type: "UnaryExpression",
  operator: "void",
  argument: {
    type: "NumericLiteral",
    value: 0
  },
  prefix: true
};


var inlineVisitor = {
  ReferencedIdentifier: function (path, state) {
    var node = path.node;

    var binding = path.scope.getBinding(node.name);

    if (binding != null) {
      // TODO make this faster
      var index = state.params.indexOf(binding);

      if (index !== -1) {
        console.assert(index < state.arguments.length);
        path.replaceWith(state.arguments[index]);
      }
    }
  }
};


function expressionStatement(node) {
  return {
    type: "ExpressionStatement",
    expression: node,
    start: node.start,
    end: node.end,
    loc: node.loc
  };
}


module.exports = function (babel) {
  return {
    pre: function () {
      this.removed = 0;
      this.unremoved = 0;
    },
    post: function () {
      if (this.opts.debug) {
        // TODO does this go to stdout or stderr ?
        console.info("");
        console.info("* Debug IIFE");
        console.info(" * Removed: " + this.removed);
        console.info(" * Not removed: " + this.unremoved);
      }
    },
    visitor: {
      CallExpression: function (path, state) {
        var node = path.node;

        var callee = node.callee;

        if (callee.type === "FunctionExpression") {
          // TODO is this correct ?
          var subPath = path.get("callee");

          var params = callee.params.map(function (x) {
            if (x.type === "Identifier") {
              var binding = subPath.scope.getBinding(x.name);

              console.assert(binding != null);

              // Only inline if each argument is used at most once
              if (binding.constant && binding.references <= 1) {
                return binding;

              } else {
                return null;
              }

            } else {
              return null;
            }
          });

          if (canInlineFunction(callee) && canInlineParams(params)) {
            ++this.removed;

            var statements = [];

            var length = node.arguments.length;

            var uniques = [];

            for (var i = 0; i < callee.params.length; ++i) {
              var param = callee.params[i];

              // TODO guarantee that collisions cannot occur ?
              var temp = $util.setLoc(path.scope.generateUidIdentifier(param.name), param);

              uniques.push(temp);

              statements.push($util.setLoc({
                type: "VariableDeclaration",
                kind: "var",
                declarations: [
                  $util.setLoc({
                    type: "VariableDeclarator",
                    id: temp,
                    init: (i < length ? node.arguments[i] : null)
                  }, temp)
                ]
              }, temp));
            }

            for (var i = callee.params.length; i < length; ++i) {
              var arg = node.arguments[i];

              statements.push(expressionStatement(arg));
            }

            statements.push(expressionStatement(callee.body.body[0].argument));

            subPath.traverse(inlineVisitor, {
              params: params,
              arguments: uniques
            });

            // TODO path.replaceExpressionWithStatements();

            path.replaceWithMultiple(statements);

          } else {
            ++this.unremoved;
          }
        }
      }
    }
  };
};
