var $recast = require("recast");
var $utils = require("rollup-pluginutils");


var b = $recast.types.builders;


function isValidIdentifier(x) {
  return /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(x);
}


function toIdentifier(x) {
  if (x.type === "Identifier") {
    return x;

  } else if (x.type === "Literal" && typeof x.value === "string" && isValidIdentifier(x.value)) {
    // TODO source maps
    return b.identifier(x.value);

  } else {
    return null;
  }
}


function exportVar(imports, identifier, expression) {
  if (expression.type === "Identifier") {
    // TODO source maps
    return b.exportNamedDeclaration(null, [
      b.exportSpecifier(expression, identifier)
    ]);

  } else if (expression.type === "MemberExpression" &&
             expression.object.type === "Identifier") {
    var file = imports[expression.object.name];

    if (file != null) {
      var from = toIdentifier(expression.property);

      if (from !== null) {
        // TODO source maps
        return b.exportNamedDeclaration(null, [
          b.exportSpecifier(from, identifier)
        ], file);
      }
    }
  }

  // TODO source maps
  return b.exportNamedDeclaration(b.variableDeclaration("var", [
    b.variableDeclarator(identifier, expression)
  ]));
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

      var imports = {};

      var node = ast.program;

      var body = [];

      node.body.forEach(function (x) {
        if (x.type === "VariableDeclaration") {
          var declarations = [];

          x.declarations.forEach(function (x) {
            // TODO handle other patterns rather than only identifiers ?
            // var foo = require("bar");
            if (x.id.type === "Identifier" &&
                x.init !== null &&
                x.init.type === "CallExpression" &&
                x.init.callee.type === "Identifier" &&
                x.init.callee.name === "require" &&
                x.init.arguments.length === 1 &&
                x.init.arguments[0].type === "Literal" &&
                typeof x.init.arguments[0].value === "string") {
              var file = x.init.arguments[0];

              imports[x.id.name] = file;

              // TODO source maps
              body.push(b.importDeclaration([
                b.importNamespaceSpecifier(x.id)
              ], file));

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
            // TODO what about computed expressions ?
            var identifier = toIdentifier(x.expression.left.property);

            // exports.foo = bar;
            if (identifier !== null) {
              body.push(exportVar(imports, identifier, x.expression.right));

            } else {
              body.push(x);
            }

          // module.exports = foo;
          } else if (x.expression.left.object.name === "module") {
            // module.exports = { ... };
            if (x.expression.right.type === "ObjectExpression") {
              x.expression.right.properties.forEach(function (x) {
                // TODO what about computed expressions ?
                var identifier = toIdentifier(x.key);

                // foo: bar
                if (identifier !== null) {
                  // TODO handle get/set different ?
                  body.push(exportVar(imports, identifier, x.value));
                }
              });
            }

            // TODO source maps
            body.push(b.exportDefaultDeclaration(x.expression.right));

          } else {
            body.push(x);
          }

        } else {
          body.push(x);
        }
      });

      node.body = body;

      var out = $recast.print(ast);

      //console.log(out.code);

      return out;
    }
  };
};
