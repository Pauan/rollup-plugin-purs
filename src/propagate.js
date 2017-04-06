"use strict";

var $util = require("./util");


// TODO DirectiveLiteral
// TODO TemplateLiteral
function isLiteral(x) {
  return (x.type === "RegExpLiteral") ||
         (x.type === "NullLiteral") ||
         (x.type === "StringLiteral") ||
         (x.type === "BooleanLiteral") ||
         (x.type === "NumericLiteral");
}


function isSimple(x) {
  if (x.type === "Identifier" ||
      // TODO What about regexps ?
      isLiteral(x)) {
    return x;

  } else if (x.type === "SequenceExpression") {
    if (x.expressions.length > 0) {
      var last = x.expressions[x.expressions.length - 1];

      // TODO make this more efficient ?
      // TODO only require purity for all but the last element
      // TODO even if the expressions aren't pure, we can still return the last element
      // TODO use assumePureVars ?
      if (x.expressions.every(function (x) { return $util.isPure(x, false); }) && isSimple(last)) {
        return last;

      } else {
        return null;
      }

    } else {
      return x;
    }

  } else {
    return null;
  }
}


module.exports = function (babel) {
  return {
    visitor: {
      ReferencedIdentifier: function (path) {
        var node = path.node;

        var binding = path.scope.getBinding(node.name);

        // Don't replace it if the variable is mutated
        if (binding != null && binding.constant) {
          if (binding.rollup_plugin_purs_propagated == null) {
            binding.rollup_plugin_purs_propagated = false;

            var declaration = binding.path.node;

            if (declaration.type === "VariableDeclarator" &&
                declaration.id.type === "Identifier" &&
                // TODO is this check necessary ?
                declaration.id.name === node.name &&
                // TODO propagate undefined variables ?
                declaration.init != null) {

              var simple = isSimple(declaration.init);

              if (simple !== null &&
                  // Don't replace it if the new name is the same as the old name
                  !(simple.type === "Identifier" &&
                    simple.name === declaration.id.name)) {
                binding.rollup_plugin_purs_propagated = simple;
              }
            }
          }

          var replace = binding.rollup_plugin_purs_propagated;

          if (replace !== false) {
            // Don't replace it if the new identifier is shadowed
            if (replace.type === "Identifier" &&
                // TODO better check for this ?
                // TODO what about checking whether the binding is constant or not ?
                path.scope.getBinding(replace.name) !== binding.scope.getBinding(replace.name)) {
              // TODO loc
              // TODO replace with _this.warn (https://github.com/rollup/rollup/issues/1282)
              console.warn("Could not replace " + node.name + " with " + replace.name);

            } else {
              path.replaceWith(replace);
            }
          }
        }
      }
    }
  };
};
