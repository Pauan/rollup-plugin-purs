var $recast = require("recast");
var $utils = require("rollup-pluginutils");


var b = $recast.types.builders;


function toIdentifier(x) {
  if (x.type === "Identifier") {
    return x;

  } else if (x.type === "Literal" && typeof x.value === "string") {
    return b.identifier(x.value);

  } else {
    return null;
  }
}


module.exports = function (options) {
  if (options == null) {
    options = {};
  }

  var filter = $utils.createFilter(options.include, options.exclude);

  return {
    name: "purs",

    transform: function (code, id) {
      if (!filter(id)) return;

      var ast = $recast.parse(code);

      var body = [];

      ast.program.body.forEach(function (x) {
        if (x.type === "VariableDeclaration") {
          var declarations = [];

          x.declarations.forEach(function (x) {
            // var foo = require("bar");
            if (x.init !== null &&
                x.init.type === "CallExpression" &&
                x.init.callee.type === "Identifier" &&
                x.init.callee.name === "require" &&
                x.init.arguments.length === 1 &&
                x.init.arguments[0].type === "Literal" &&
                typeof x.init.arguments[0].value === "string") {
              // TODO source maps
              body.push(b.importDeclaration([
                b.importNamespaceSpecifier(x.id)
              ], x.init.arguments[0]));

            } else {
              declarations.push(x);
            }
          });

          if (declarations.length !== 0) {
            x.declarations = declarations;
            body.push(x);
          }

        // "use strict";
        } else if (x.type === "ExpressionStatement" &&
                   x.expression.type === "Literal" &&
                   x.expression.value === "use strict") {
          // Do nothing

        } else if (x.type === "ExpressionStatement" &&
                   x.expression.type === "AssignmentExpression" &&
                   x.expression.operator === "=" &&
                   x.expression.left.type === "MemberExpression" &&
                   x.expression.left.object.type === "Identifier") {
          if (x.expression.left.object.name === "exports") {
            var identifier = toIdentifier(x.expression.left);

            // exports.foo = bar;
            if (identifier !== null) {
              // TODO source maps
              body.push(b.exportNamedDeclaration(b.variableDeclaration("var", [
                b.variableDeclarator(identifier, x.expression.right)
              ])));

            } else {
              body.push(x);
            }

          } else if (x.expression.left.object.name === "module") {
            // module.exports = { ... };
            if (x.expression.right.type === "ObjectExpression") {
              x.expression.right.properties.forEach(function (x) {
                // TODO handle get/set different ?
                // TODO source maps
                body.push(b.exportNamedDeclaration(b.variableDeclaration("var", [
                  b.variableDeclarator(toIdentifier(x.key), x.value)
                ])));
              });

            // module.exports = foo;
            } else {
              body.push(b.exportDefaultDeclaration(x.expression.right));
            }

          } else {
            body.push(x);
          }

        } else {
          body.push(x);
        }
      });

      ast.program.body = body;

      return $recast.print(ast);
    }
  };
};
