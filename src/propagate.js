"use strict";


// TODO DirectiveLiteral
// TODO TemplateLiteral
function isLiteral(x) {
  return (x.type === "RegExpLiteral") ||
         (x.type === "NullLiteral") ||
         (x.type === "StringLiteral") ||
         (x.type === "BooleanLiteral") ||
         (x.type === "NumericLiteral");
}


// https://github.com/babel/babylon/blob/master/ast/spec.md
// TODO Decorator
// TODO Directive
// TODO DirectiveLiteral
// TODO Import
// TODO BindExpression ?
// TODO CallExpression with IIFE ?
// TODO NewExpression with IIFE ?
// TODO TemplateLiteral
// TODO TaggedTemplateExpression
// TODO TemplateElement
// TODO ClassBody
// TODO ClassMethod
// TODO ClassProperty
// TODO ClassDeclaration
// TODO ClassExpression
// TODO MetaProperty
function isPureExpression(x) {
  return (x === null) ||
         (x.type === "RegExpLiteral") || // TODO are regexps pure...?
         (x.type === "NullLiteral") ||
         (x.type === "StringLiteral") ||
         (x.type === "BooleanLiteral") ||
         (x.type === "NumericLiteral") ||
         // TODO is this pure ?
         (x.type === "Super") ||
         (x.type === "ThisExpression") ||
         (x.type === "ArrowFunctionExpression") ||
         (x.type === "ArrayExpression" && x.elements.every(isPureExpression)) ||
         (x.type === "ObjectExpression" && x.properties.every(isPureExpression)) ||
         // TODO is this correct ?
         (x.type === "ObjectProperty" && isPureExpression(x.key) && isPureExpression(x.value)) ||
         // TODO is this correct ?
         (x.type === "ObjectMethod" && isPureExpression(x.key) && isPureExpression(x.value)) ||
         // TODO is this pure ?
         (x.type === "SpreadProperty" && isPureExpression(x.argument)) ||
         (x.type === "FunctionExpression") ||
         (x.type === "UnaryExpression" && x.operator !== "delete" && isPureExpression(x.argument)) ||
         (x.type === "BinaryExpression" && isPureExpression(x.left) && isPureExpression(x.right)) ||
         (x.type === "LogicalExpression" && isPureExpression(x.left) && isPureExpression(x.right)) ||
         (x.type === "ConditionalExpression" &&
          isPureExpression(x.test) &&
          isPureExpression(x.consequent) &&
          isPureExpression(x.alternate)) ||
         (x.type === "SequenceExpression" && x.expressions.every(isPureExpression));
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
      if (x.expressions.every(isPureExpression) && isSimple(last)) {
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
          var declaration = binding.path.node;

          if (declaration.type === "VariableDeclarator" &&
              declaration.id.type === "Identifier" &&
              // TODO is this check necessary ?
              declaration.id.name === node.name &&
              // TODO propagate undefined variables ?
              declaration.init != null) {

            var replace = isSimple(declaration.init);

            if (replace !== null &&
                // Don't replace it if the new name is the same as the old name
                !(replace.type === "Identifier" &&
                  replace.name === declaration.id.name)) {

              // Don't replace it if the new identifier is shadowed
              if (replace.type === "Identifier" &&
                  // TODO better check for this ?
                  path.scope.getBinding(replace.name) !== binding.scope.getBinding(replace.name)) {
                // TODO loc
                // TODO replace with _this.warn (https://github.com/rollup/rollup/issues/1282)
                console.warn("Could not replace " + node.name + " with " + replace.name);

              } else {
                // TODO is this correct ?
                if (replace.type === "Identifier") {
                  path.scope.getBinding(replace.name).reference(path);
                }

                binding.dereference();

                if (!binding.referenced) {
                  // TODO is this correct ?
                  binding.scope.removeOwnBinding(declaration.id.name);
                  binding.path.remove();
                }

                path.replaceWith(replace);
              }
            }
          }
        }
      }
    }
  };
};
