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


function setPurity(binding, expression) {
  if (binding.rollup_plugin_purs_is_pure == null) {
    // TODO is this scope correct ?
    if (isPure(binding.scope, expression)) {
      binding.rollup_plugin_purs_is_pure = true;

    } else {
      binding.rollup_plugin_purs_is_pure = false;
    }
  }
}


// TODO ClassDeclaration
// TODO ImportDeclaration ?
// TODO ExportNamedDeclaration
// TODO ExportDefaultDeclaration
var visitor = {
  Program: {
    exit: function (path, state) {
      state.declarations.forEach(function (x) {
        if (x.binding.rollup_plugin_used) {
          ++state.live;

        } else {
          ++state.dead;

          if (x.binding.rollup_plugin_purs_is_pure) {
            x.path.remove();

          } else {
            var parentPath = x.path.parentPath;

            console.assert(parentPath.node.declarations.length === 1);

            parentPath.replaceWith($util.expressionStatement(x.path.node.init));
          }
        }
      });
    }
  },
  ReferencedIdentifier: function (path, state) {
    var node = path.node;

    var binding = path.scope.getBinding(node.name);

    // TODO require the variable to be constant ?
    if (binding != null) {
      if (!binding.rollup_plugin_used) {
        binding.rollup_plugin_used = true;

        var declarator = binding.path.node;

        if (declarator.type === "VariableDeclarator") {
          setPurity(binding, declarator.init);

          if (binding.rollup_plugin_purs_is_pure) {
            binding.path.get("init").traverse(visitor, state);
          }

        } else if (declarator.type === "FunctionDeclaration") {
          binding.rollup_plugin_purs_is_pure = true;

          // TODO is this needed ?
          binding.path.get("params").forEach(function (path) {
            path.traverse(visitor, state);
          });

          binding.path.get("body").traverse(visitor, state);
        }
      }
    }
  },
  VariableDeclarator: function (path, state) {
    var node = path.node;

    if (node.id.type === "Identifier") {
      // TODO require the variable to be constant ?
      var binding = path.scope.getBinding(node.id.name);

      console.assert(binding != null);

      state.declarations.push({
        path: path,
        binding: binding
      });

      setPurity(binding, node.init);

      if (binding.rollup_plugin_purs_is_pure) {
        path.skip();
      }
    }
  },
  FunctionDeclaration: function (path, state) {
    var node = path.node;

    console.assert(node.id.type === "Identifier");

    // TODO require the variable to be constant ?
    var binding = path.scope.getBinding(node.id.name);

    console.assert(binding != null);

    state.declarations.push({
      path: path,
      binding: binding
    });

    binding.rollup_plugin_purs_is_pure = true;
    path.skip();
  }
};


module.exports = function (babel) {
  return {
    pre: function () {
      this.live = 0;
      this.dead = 0;
      this.declarations = [];
    },
    post: function () {
      if (this.opts.debug) {
        // TODO does this go to stdout or stderr ?
        console.info("");
        console.info("* Debug dead code");
        console.info(" * Live variables: " + this.live);
        console.info(" * Dead variables: " + this.dead);
      }
    },
    visitor: visitor
  };
};
