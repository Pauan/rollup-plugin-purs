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
  return node.body.body.length === 1 &&
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


// TODO Import ?
// TODO BindExpression ?
// TODO TemplateLiteral ?
// TODO TaggedTemplateExpression ?
// TODO ClassExpression ?
// TODO MetaProperty ?
// TODO DirectiveLiteral ?
function isPure(node) {
      // TODO this is only needed for ArrayExpression
  if (node === null ||
      node.type === "Identifier" ||
      // TODO is this correct ? what about inner classes ?
      node.type === "Super" ||
      // TODO is this correct ? what about inner functions ?
      node.type === "ThisExpression" ||
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      // TODO this is technically impure
      node.type === "RegExpLiteral" ||
      node.type === "NullLiteral" ||
      node.type === "StringLiteral" ||
      node.type === "BooleanLiteral" ||
      node.type === "NumericLiteral") {
    return true;

  } else if (node.type === "ArrayExpression") {
    return node.elements.every(isPure);

  } else if (node.type === "ObjectExpression") {
    return node.properties.every(isPure);

  } else if (node.type === "ObjectProperty" ||
             node.type === "ObjectMethod") {
    return isPure(node.key) && isPure(node.value);

  } else if (node.type === "RestProperty" ||
             node.type === "SpreadProperty" ||
             node.type === "SpreadElement") {
    return isPure(node.argument);

  } else if (node.type === "UnaryExpression") {
    return node.operator !== "delete" &&
           isPure(node.argument);

  } else if (node.type === "BinaryExpression" ||
             node.type === "LogicalExpression") {
    return isPure(node.left) && isPure(node.right);

  } else if (node.type === "ConditionalExpression") {
    return isPure(node.test) && isPure(node.alternate) && isPure(node.consequent);

  } else if (node.type === "SequenceExpression") {
    return node.expressions.every(isPure);

             // TODO is this necessary ?
  } else if (node.type === "YieldExpression" ||
             // TODO is this necessary ?
             node.type === "AwaitExpression" ||
             node.type === "UpdateExpression" ||
             node.type === "AssignmentExpression" ||
             node.type === "CallExpression" ||
             node.type === "NewExpression" ||
             // TODO this is a little strict...
             node.type === "MemberExpression") {
    return false;

  // TODO throw an error instead ?
  } else {
    return false;
  }
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
      CallExpression: {
        exit: function (path, state) {
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

            // TODO allow for the id, as long as it's not called ?
            if (callee.id === null && canInlineFunction(callee) && canInlineParams(params)) {
              ++this.removed;

              var statements = [];

              var length = node.arguments.length;

              var replace = [];

              for (var i = 0; i < callee.params.length; ++i) {
                var param = callee.params[i];

                if (i < length) {
                  // TODO is this correct ?
                  replace.push(node.arguments[i]);

                } else {
                  replace.push(_void);
                }

                /*if (i < length && isPure(node.arguments[i])) {
                  // TODO is this correct ?
                  replace.push(node.arguments[i]);

                } else {
                  // TODO guarantee that collisions cannot occur ?
                  var temp = $util.setLoc(path.scope.generateUidIdentifier(param.name), param);

                  replace.push(temp);

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
                }*/
              }

              for (var i = callee.params.length; i < length; ++i) {
                var arg = node.arguments[i];

                statements.push(expressionStatement(arg));
              }

              var expression = callee.body.body[0].argument;

              subPath.traverse(inlineVisitor, {
                params: params,
                arguments: replace
              });

              // TODO path.replaceExpressionWithStatements(); ?

              if (statements.length === 0) {
                path.replaceWith(expression);

              } else {
                statements.push(expressionStatement(expression));
                path.replaceWithMultiple(statements);
              }

            } else {
              ++this.unremoved;
            }
          }
        }
      }
    }
  };
};
