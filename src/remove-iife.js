"use strict";

var $util = require("./util");


// TODO code duplication
function canInlineParams(params) {
  return params.every(function (x) {
    return x !== null;
  });
}


// https://github.com/babel/babylon/blob/master/ast/spec.md
// TODO ImportDeclaration ?
// TODO ExportNamedDeclaration ?
// TODO ExportDefaultDeclaration ?
// TODO ExportAllDeclaration ?
// TODO ExpressionStatement ?
// TODO WithStatement ?
function canInlineStatement(node) {
  if (node.type === "FunctionDeclaration" ||
      // TODO are class declarations block scoped ?
      node.type === "ClassDeclaration") {
    return true;

  // return cannot be inlined
  } else if (node.type === "ReturnStatement") {
    return false;

  // TODO maybe replace var with let ?
  // var cannot be inlined
  } else if (node.type === "VariableDeclaration") {
    return node.kind !== "var";

  } else if (node.type === "BlockStatement") {
    return node.body.every(canInlineStatement);

  } else if (node.type === "IfStatement") {
    return canInlineStatement(node.consequent) &&
           (node.alternate === null || canInlineStatement(node.alternate));

  } else if (node.type === "SwitchStatement") {
    return node.cases.every(canInlineStatement);

  } else if (node.type === "SwitchCase") {
    return node.consequent.every(canInlineStatement);

  } else if (node.type === "TryStatement") {
    return canInlineStatement(node.block) &&
           (node.handler === null || canInlineStatement(node.handler)) &&
           (node.finalizer === null || canInlineStatement(node.finalizer));

  } else if (node.type === "LabeledStatement" ||
             node.type === "CatchClause" ||
             node.type === "WhileStatement" ||
             node.type === "DoWhileStatement") {
    return canInlineStatement(node.body);

  } else if (node.type === "ForStatement") {
    return (node.init === null || canInlineStatement(node.init)) &&
           canInlineStatement(node.body);

  } else if (node.type === "ForInStatement" ||
             node.type === "ForOfStatement" ||
             node.type === "ForAwaitStatement") {
    return canInlineStatement(node.left) && canInlineStatement(node.body);

  } else {
    return true;
  }
}


// TODO WithStatement ?
function canInlineLast(output, node) {
  if (node.type === "ReturnStatement") {
    if (node.argument !== null) {
      output.push($util.expressionStatement(JSON.parse(JSON.stringify(node.argument))));

    } else {
      // TODO maybe use EmptyStatement instead ?
      output.push($util.expressionStatement(_void(node.loc)));
    }
    return true;

  // TODO is this correct ?
  } else if (node.type === "ThrowStatement" ||
             node.type === "DebuggerStatement" ||
             node.type === "BreakStatement" ||
             node.type === "ContinueStatement") {
    output.push(JSON.parse(JSON.stringify(node)));
    return true;

  } else if (node.type === "EmptyStatement") {
    // TODO is this necessary ?
    output.push($util.expressionStatement(_void(node.loc)));
    return true;

  } else if (node.type === "BlockStatement") {
    var body = [];

    if (canInlineArray(body, node.body)) {
      // TODO does this affect the behavior of const/let ?
      output.push($util.statements(body, node));
      return true;

    } else {
      return false;
    }

  } else if (node.type === "LabeledStatement") {
    var body = [];

    if (canInlineLast(body, node.body)) {
      output.push({
        type: "LabeledStatement",
        label: JSON.parse(JSON.stringify(node.label)),
        // TODO does this change the semantics of const/let ?
        body: $util.statements(body, node.body),
        loc: node.loc
      });
      return true;

    } else {
      return false;
    }

  } else if (node.type === "IfStatement") {
    var yes = [];

    if (canInlineLast(yes, node.consequent)) {
      var alternate = null;

      // TODO what if the alternate is null ?
      if (node.alternate !== null) {
        var no = [];

        if (canInlineLast(no, node.alternate)) {
          alternate = $util.statements(no, node.alternate);

        } else {
          return false;
        }
      }

      output.push({
        type: "IfStatement",
        test: JSON.parse(JSON.stringify(node.test)),
        consequent: $util.statements(yes, node.consequent),
        alternate: alternate,
        loc: node.loc
      });
      return true;

    } else {
      return false;
    }

  } else if (node.type === "SwitchStatement") {
    var cases = [];

    var every = node.cases.every(function (node) {
      var body = [];

      // TODO handle break specially ?
      if (canInlineArray(body, node.consequent)) {
        // TODO does this affect the behavior of const/let ?
        cases.push({
          type: "SwitchCase",
          test: node.test,
          consequent: body,
          loc: node.loc
        });
        return true;

      } else {
        return false;
      }
    });

    if (every) {
      output.push({
        type: "SwitchStatement",
        discriminant: node.discriminant,
        cases: cases,
        loc: node.loc
      });
      return true;

    } else {
      return false;
    }

  } else if (node.type === "TryStatement") {
    var body = [];

    if (canInlineArray(body, node.block.body)) {
      var handler = null;

      if (node.handler !== null) {
        var _catch = [];

        if (canInlineArray(_catch, node.handler.body.body)) {
          handler = {
            type: "CatchClause",
            param: node.handler.param,
            body: {
              type: "BlockStatement",
              body: _catch,
              loc: node.handler.body.loc
            },
            loc: node.handler.loc
          };

        } else {
          return false;
        }
      }

      var finalizer = null;

      if (node.finalizer !== null) {
        var _finally = [];

        if (canInlineArray(_finally, node.finalizer.body)) {
          finalizer = {
            type: "BlockStatement",
            body: _finally,
            loc: node.finalizer.loc
          };

        } else {
          return false;
        }
      }

      output.push({
        type: "TryStatement",
        block: {
          type: "BlockStatement",
          body: body,
          loc: node.block.loc
        },
        handler: handler,
        finalizer: finalizer,
        loc: node.loc
      });
      return true;

    } else {
      return false;
    }

  } else if (canInlineStatement(node)) {
    output.push(JSON.parse(JSON.stringify(node)));
    // TODO is this necessary ?
    // TODO use EmptyStatement instead ?
    output.push($util.expressionStatement(_void(node.loc)));
    return true;

  } else {
    return false;
  }
}


function canInlineArray(output, array) {
  var length = array.length;

  if (length >= 1) {
    for (var i = 0; i < length - 1; ++i) {
      if (canInlineStatement(array[i])) {
        output.push(JSON.parse(JSON.stringify(array[i])));

      } else {
        return false;
      }
    }

    return canInlineLast(output, array[array.length - 1]);

  } else {
    return true;
  }
}


function _void(loc) {
  return {
    type: "UnaryExpression",
    operator: "void",
    argument: {
      type: "NumericLiteral",
      value: 0,
      loc: loc
    },
    prefix: true,
    loc: loc
  };
}


var inlineVisitor = {
  ReferencedIdentifier: function (path, state) {
    var node = path.node;

    var binding = path.scope.getBinding(node.name);

    if (binding != null) {
      // TODO make this faster
      var index = state.params.indexOf(binding);

      if (index !== -1) {
        console.assert(index < state.arguments.length);

        if (state.arguments[index] !== null) {
          path.replaceWith(state.arguments[index]);
        }
      }
    }
  }
};


// TODO code duplication with convert.js
function isUseStrict(node) {
  return node.type === "ExpressionStatement" &&
         node.expression.type === "StringLiteral" &&
         node.expression.value === "use strict";
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
      // TODO also do this optimization for BlockStatement
      DoExpression: {
        // TODO should this use exit ?
        enter: function (path, state) {
          var node = path.node;

          var body = node.body.body;

          // TODO does this work correctly with const/let ?
          if (path.parent.type === "ExpressionStatement") {
            path.replaceWithMultiple(body);

          } else {
            var length = body.length;

            if (length >= 1) {
              for (var i = 0; i < length - 1; ++i) {
                // TODO use assumePureVars ?
                if (!$util.isPure(body[i], false)) {
                  return;
                }
              }

              var last = body[length - 1];

              if (last.type === "ExpressionStatement") {
                path.replaceWith(last.expression);
              }
            }
          }
        }
      },
      // TODO does this preserve evaluation order ?
      VariableDeclaration: {
        exit: function (path, state) {
          var parent = path.parentPath.node;
          var node = path.node;

          // TODO is this correct ?
          if (parent.type !== "ForStatement" &&
              parent.type !== "ForInStatement") {
            node.declarations.forEach(function (node) {
              if (node.init !== null &&
                  node.init.type === "DoExpression") {
                var body = node.init.body.body;

                if (body.length >= 1) {
                  var last = body[body.length - 1];

                  if (last.type === "ExpressionStatement") {
                    node.init = last.expression;

                    path.insertBefore(body.slice(0, -1));
                  }
                }
              }
            });
          }
        }
      },
      ReturnStatement: {
        exit: function (path, state) {
          var node = path.node;

          if (node.argument !== null &&
              node.argument.type === "DoExpression") {
            var body = node.argument.body.body;

            if (body.length >= 1) {
              var last = body[body.length - 1];

              if (last.type === "ExpressionStatement") {
                node.argument = last.expression;

                path.insertBefore(body.slice(0, -1));
              }
            }
          }
        }
      },
      CallExpression: {
        exit: function (path, state) {
          var node = path.node;

          var callee = node.callee;

          // TODO is using callee.shadow correct ?
          if (callee.type === "FunctionExpression" &&
              !callee.shadow &&
              // TODO is this a good idea ?
              // TODO figure out why this isn't working
              !(callee.body.body.length >= 1 &&
                isUseStrict(callee.body.body[0]))) {
            var body = [];

            // TODO is this correct ?
            var subPath = path.get("callee");

            var params = callee.params.map(function (x) {
              if (x.type === "Identifier") {
                var binding = subPath.scope.getBinding(x.name);

                console.assert(binding != null);

                return binding;
              }

              return null;
            });

            // TODO allow for the id, as long as it's not called ?
            if (callee.id === null && canInlineParams(params) && canInlineArray(body, callee.body.body)) {
              ++this.removed;

              // TODO is this correct ?
              callee.body.body = body;

              var args = node.arguments;
              var length = args.length;

              var statements = [];

              var replace = [];

              callee.params.forEach(function (param, i) {
                var binding = params[i];

                if (i < length) {
                  var arg = args[i];

                  if (binding.constant &&
                      binding.references <= 1 &&
                      // TODO use assumePureVars ?
                      $util.isPure(arg, false)) {
                    // TODO is this correct ?
                    replace.push(JSON.parse(JSON.stringify(arg)));

                  } else {
                    // TODO guarantee that collisions cannot occur ?
                    var temp = $util.setLoc(path.scope.generateUidIdentifier(param.name), param);

                    replace.push(temp);

                    statements.push({
                      type: "VariableDeclaration",
                      kind: "let",
                      declarations: [
                        $util.setLoc({
                          type: "VariableDeclarator",
                          id: temp,
                          init: JSON.parse(JSON.stringify(arg))
                        }, temp)
                      ],
                      loc: node.loc
                    });
                  }

                } else {
                  if (binding.constant) {
                    // TODO what if the binding is mutated ?
                    replace.push(_void(param.loc));

                  // TODO test this
                  } else {
                    replace.push(null);

                    statements.push({
                      type: "VariableDeclaration",
                      kind: "let",
                      declarations: [
                        $util.setLoc({
                          type: "VariableDeclarator",
                          id: JSON.parse(JSON.stringify(param)),
                          init: null
                        }, param)
                      ],
                      loc: node.loc
                    });
                  }
                }
              });

              for (var i = callee.params.length; i < length; ++i) {
                var arg = args[i];

                // TODO use assumePureVars ?
                if (!$util.isPure(arg, false)) {
                  statements.push($util.expressionStatement(JSON.parse(JSON.stringify(arg))));
                }
              }

              // TODO is this correct ?
              subPath.traverse(inlineVisitor, {
                params: params,
                arguments: replace
              });

              // TODO is this correct ?
              callee.body.body.forEach(function (x) {
                statements.push(x);
              });

              path.replaceWith({
                type: "DoExpression",
                body: {
                  type: "BlockStatement",
                  body: statements,
                  loc: node.loc
                },
                loc: node.loc
              });

            } else {
              ++this.unremoved;
            }
          }
        }
      }
    }
  };
};
