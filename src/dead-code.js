"use strict";

var $util = require("./util");


function isPure(scope, expression) {
  return $util.isPure(expression, false) || isPureNew(scope, expression);
}


// TODO move this into the $util.isPure function ?
function isPureNew(scope, expression) {
  if (expression.type === "NewExpression") {
    if (expression.callee.type === "Identifier") {
      var classBinding = scope.getBinding(expression.callee.name);

      // TODO FunctionDeclaration ?
      // TODO ClassDeclaration ?
      if (classBinding != null &&
          classBinding.constant &&
          classBinding.path.node.type === "VariableDeclarator") {
        var init = classBinding.path.get("init");

        // TODO check the params
        if (init.node.type === "FunctionExpression") {
          var isPureBody = init.get("body").get("body").every(function (path) {
            return path.node.type === "ExpressionStatement" &&
                   path.node.expression.type === "AssignmentExpression" &&
                   path.node.expression.operator === "=" &&
                   // TODO is this the correct scope ?
                   // TODO is this correct ?
                   isPure(path.scope, path.node.expression.left) &&
                   // TODO is this the correct scope ?
                   isPure(path.scope, path.node.expression.right);
          });

          var isPureArguments = expression.arguments.every(function (node) {
            return isPure(scope, node);
          });

          return isPureBody && isPureArguments;
        }
      }
    }
  }

  return false;
}


// TODO directives
function visitBlockStatement(path, state) {
  var node = path.node;

  var length = node.body.length;

  node.body = node.body.filter(function (node) {
    // TODO is this correct ?
    return !isPure(path.scope, node);
  });

  state.deadExpressions += (length - node.body.length);
}


// TODO ClassDeclaration
// TODO ImportDeclaration ?
// TODO ExportNamedDeclaration
// TODO ExportDefaultDeclaration
// TODO unused function arguments should be removed
// TODO remove LabeledStatement if the label isn't used ?
// TODO remove unused cases from SwitchStatement ?
// TODO remove unused variables from ForStatement and ForInStatement ?
// TODO remove unused quasis and expressions from TemplateLiteral ?
// TODO remove unused properties from ObjectPattern ?
// TODO remove unused elements ArrayPattern ?
// TODO remove unused RestElement ?
// TODO remove unused AssignmentPattern ?
var visitor = {
  Program: {
    enter: visitBlockStatement,
    exit: function (path, state) {
      state.after.forEach(function (f) {
        f();
      });
    }
  },
  BlockStatement: visitBlockStatement,
  SwitchCase: function (path, state) {
    var node = path.node;

    var length = node.consequent.length;

    node.consequent = node.consequent.filter(function (node) {
      // TODO is this correct ?
      return !isPure(path.scope, node);
    });

    state.deadExpressions += (length - node.consequent.length);
  },
  SequenceExpression: function (path, state) {
    var node = path.node;

    var length = node.expressions.length;

    var last = node.expressions.pop();

    var expressions = node.expressions.filter(function (node) {
      // TODO is this correct ?
      return !isPure(path.scope, node);
    });

    expressions.push(last);

    node.expressions = expressions;

    state.deadExpressions += (length - node.expressions.length);

    if (node.expressions.length === 1) {
      path.replaceWith(node.expressions[0]);
    }
  },
  ReferencedIdentifier: function (path, state) {
    var node = path.node;

    var binding = path.scope.getBinding(node.name);

    // TODO require the variable to be constant ?
    if (binding != null) {
      if (!binding.rollup_plugin_used) {
        binding.rollup_plugin_used = true;

        if (binding.rollup_plugin_onUse != null) {
          binding.rollup_plugin_onUse.forEach(function (f) {
            f();
          });
        }
      }
    }
  },
  UpdateExpression: function (path, state) {
    var parent = path.parentPath.node;

    // TODO is this correct ?
    if (parent.type === "ExpressionStatement") {
      var node = path.node;

      if (node.argument.type === "Identifier") {
        var binding = path.scope.getBinding(node.argument.name);

        if (binding != null) {
          state.after.push(function () {
            if (!binding.rollup_plugin_used) {
              // TODO what if the UpdateExpression is inside of an expression ?
              path.remove();
            }
          });

          if (!binding.rollup_plugin_used) {
            if (binding.rollup_plugin_onUse == null) {
              binding.rollup_plugin_onUse = [];
            }

            binding.rollup_plugin_onUse.push(function () {
              path.traverse(visitor, state);
            });

            path.skip();
          }
        }
      }
    }
  },
  //  var foo = pure; foo = pure;      -->
  //  var foo = pure; foo = impure;    -->  impure;
  //  var foo = impure; foo = pure;    -->  impure;
  //  var foo = impure; foo = impure;  -->  impure; impure;
  AssignmentExpression: function (path, state) {
    var node = path.node;

    // TODO handle other operators
    if (node.operator === "=" &&
        node.left.type === "Identifier") {
      var binding = path.scope.getBinding(node.left.name);

      if (binding != null) {
        var parent = path.parentPath.node;

        // TODO is this correct ?
        // TODO use assumePureVars
        var pure = (parent.type === "ExpressionStatement") && isPure(path.scope, node.right);

        state.after.push(function () {
          if (!binding.rollup_plugin_used) {
            if (pure) {
              // TODO should this count even if the right side is impure ?
              ++state.deadExpressions;

              path.remove();

            } else {
              path.replaceWith(node.right);
            }
          }
        });

        path.skip();

        if (!binding.rollup_plugin_used && pure) {
          if (binding.rollup_plugin_onUse == null) {
            binding.rollup_plugin_onUse = [];
          }

          binding.rollup_plugin_onUse.push(function () {
            // TODO is this correct ?
            path.get("right").traverse(visitor, state);
          });

        } else {
          // TODO is this correct ?
          path.get("right").traverse(visitor, state);
        }
      }
    }
  },
  VariableDeclaration: function (path, state) {
    var parent = path.parentPath.node;

    var declarations = path.get("declarations");

    // TODO is this correct ?
    if (parent.type !== "ForStatement" &&
        parent.type !== "ForInStatement" &&
        parent.type !== "ForOfStatement") {
      //console.assert(declarations.length === 1);

      if (declarations.length > 1) {
        var kind = path.node.kind;

        path.replaceWithMultiple(declarations.map(function (path) {
          var node = path.node;

          // TODO is this loc correct ?
          return $util.setLoc({
            type: "VariableDeclaration",
            kind: kind,
            declarations: [node]
          }, node);
        }));

      } else {
        console.assert(declarations.length === 1);

        var declaration = declarations[0];

        var node = declaration.node;

        if (node.id.type === "Identifier") {
          // TODO require the variable to be constant ?
          var binding = declaration.scope.getBinding(node.id.name);

          console.assert(binding != null);

          var rightPure = isPure(binding.scope, node.init);

          // TODO this causes it to be counted multiple times per binding
          if (rightPure) {
            ++state.pure;

          } else {
            ++state.impure;
          }

          if (binding.rollup_plugin_seen_declarator) {
            // TODO this causes it to be counted multiple times per binding
            state.after.push(function () {
              if (binding.rollup_plugin_used) {
                ++state.live;

              } else {
                ++state.dead;
              }
            });

            if (node.init != null) {
              path.replaceWith($util.expressionStatement($util.setLoc({
                type: "AssignmentExpression",
                operator: "=",
                left: node.id,
                right: node.init
              }, path.node)));

            } else {
              // TODO is this correct ?
              path.remove();
            }

          } else {
            binding.rollup_plugin_seen_declarator = true;

            // TODO is this scope correct ?
            var pure = state.opts.assumePureVars || rightPure;

            var inDoBlock = path.parent.type === "BlockStatement" &&
                            path.parentPath.parent.type === "FunctionExpression" &&
                            path.parentPath.parent.id &&
                            path.parentPath.parent.id.name &&
                            path.parentPath.parent.id.name.match("__do");

            state.after.push(function () {
              if (binding.rollup_plugin_used) {
                ++state.live;

              } else {
                ++state.dead;

                if (pure) {
                  if (inDoBlock){
                    ++state.deadCodeInDoBlockNotRemoved;
                    path.replaceWith($util.expressionStatement(node.init));
                  } else {
                    path.remove();
                  }
                } else {
                  path.replaceWith($util.expressionStatement(node.init));
                }
              }
            });

            if (!binding.rollup_plugin_used && (pure && !inDoBlock)) {
              if (binding.rollup_plugin_onUse == null) {
                binding.rollup_plugin_onUse = [];
              }

              binding.rollup_plugin_onUse.push(function () {
                declaration.traverse(visitor, state);
              });

              path.skip();
            }
          }

        } else {
          ++state.ignored;
        }
      }

    } else {
      state.ignored += declarations.length;
    }
  },
  FunctionDeclaration: function (path, state) {
    var node = path.node;

    console.assert(node.id.type === "Identifier");

    // TODO require the variable to be constant ?
    var binding = path.scope.getBinding(node.id.name);

    console.assert(binding != null);

    // TODO is this correct ?
    console.assert(!binding.rollup_plugin_seen_declarator);

    binding.rollup_plugin_seen_declarator = true;

    ++state.pure;

    state.after.push(function () {
      if (binding.rollup_plugin_used) {
        ++state.live;

      } else {
        ++state.dead;

        path.remove();
      }
    });

    if (!binding.rollup_plugin_used) {
      if (binding.rollup_plugin_onUse == null) {
        binding.rollup_plugin_onUse = [];
      }

      binding.rollup_plugin_onUse.push(function () {
        path.traverse(visitor, state);
      });

      path.skip();
    }
  }
};


module.exports = function (babel) {
  return {
    pre: function () {
      this.live = 0;
      this.dead = 0;
      this.pure = 0;
      this.impure = 0;
      this.ignored = 0;
      this.deadExpressions = 0;
      this.deadCodeInDoBlockNotRemoved = 0;
      this.after = [];
    },
    post: function () {
      if (this.opts.debug) {
        // TODO does this go to stdout or stderr ?
        console.info("");
        console.info("* Dead code statistics");
        console.info(" * Live variables: " + this.live);
        console.info(" * Dead variables: " + this.dead);
        console.info(" * Pure variables: " + this.pure);
        console.info(" * Impure variables: " + this.impure);
        console.info(" * Ignored variables: " + this.ignored);
        console.info(" * Unused pure expressions: " + this.deadExpressions);
        console.info(" * Dead code in do block not removed: " + this.deadCodeInDoBlockNotRemoved);
      }
    },
    visitor: visitor
  };
};
