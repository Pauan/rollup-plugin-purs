"use strict";

var $util = require("./util");


function canInlineFunction(binding, path, node) {
  // TODO code duplication
  var params = node.params.map(function (x) {
    if (x.type === "Identifier") {
      var binding = path.scope.getBinding(x.name);

      console.assert(binding != null);

      return binding;

    } else {
      return false;
    }
  });

  var replace = {
    members: {},
    params: new Array(params.length) // TODO is this correct ?
  };

  // Only inline if each argument is used at most once
  if (params.every(function (binding) { return binding.constant && binding.references <= 1; })) {
    var all = node.body.body.every(function (x) {
      // this.foo = bar;
      // this["foo"] = bar;
      if (x.type === "ExpressionStatement" &&
          x.expression.type === "AssignmentExpression" &&
          x.expression.operator === "=" &&
          x.expression.left.type === "MemberExpression" &&
          x.expression.left.object.type === "ThisExpression" &&
          x.expression.right.type === "Identifier") {
        var name = $util.getPropertyName(x.expression.left);

        if (name != null) {
          var binding = path.scope.getBinding(x.expression.right.name);

          if (binding != null) {
            var index = params.indexOf(binding);

            if (index !== -1) {
              // TODO guarantee that collisions cannot occur ?
              // TODO loc ?
              var temp = binding.scope.generateUidIdentifier();

              // TODO is this correct ?
              replace.params[index] = temp;
              replace.members[name] = temp;
              return true;
            }
          }
        }
      }

      return false;
    });

    if (all) {
      return replace;
    }
  }

  return null;
}


function makeTypeclass(state, binding, path, node) {
  if (binding.constant &&
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      node.init != null &&
      node.init.type === "NewExpression" &&
      node.init.callee.type === "Identifier") {
    var typeclass = path.scope.getBinding(node.init.callee.name);

    if (typeclass != null && typeclass.constant) {
      var definition = typeclass.path.node;

      if (definition.type === "VariableDeclarator" &&
          definition.init != null &&
          definition.init.type === "FunctionExpression") {
        var replace = canInlineFunction(binding, typeclass.path.get("init"), definition.init);

        if (replace != null) {
          var args = node.init.arguments;

          // TODO guarantee that this assertion always holds
          console.assert(args.length === replace.params.length);

          replace.params.forEach(function (x, i) {
            // TODO loc
            path.insertBefore([{
              type: "VariableDeclarator",
              id: x,
              init: args[i],
            }]);

            args[i] = x;
          });

          // TODO is this correct ?
          path.scope.registerDeclaration(path.parentPath);

          binding.rollup_plugin_purs_typeclass = replace.members;
        }
      }
    }
  }
}


module.exports = function (babel) {
  return {
    pre: function () {
      this.inlined = 0;
    },
    post: function () {
      if (this.opts.debug) {
        // TODO does this go to stdout or stderr ?
        console.info("");
        console.info("* Debug typeclass inlining");
        console.info(" * Typeclass instances inlined: " + this.inlined);
      }
    },
    visitor: {
      MemberExpression: function (path, state) {
        var node = path.node;

        if (node.object.type === "Identifier") {
          var name = $util.getPropertyName(node);

          if (name != null) {
            var binding = path.scope.getBinding(node.object.name);

            if (binding != null) {
              if (binding.rollup_plugin_purs_typeclass == null) {
                binding.rollup_plugin_purs_typeclass = false;

                makeTypeclass(state, binding, binding.path, binding.path.node);
              }

              var typeclass = binding.rollup_plugin_purs_typeclass;

              if (typeclass !== false && $util.hasKey(typeclass, name)) {
                ++state.inlined;

                // TODO loc
                path.replaceWith(typeclass[name]);
              }
            }
          }
        }
      }
    }
  };
};
