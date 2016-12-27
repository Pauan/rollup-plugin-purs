var $recast = require("recast");
var $utils = require("rollup-pluginutils");
var $path = require("path");
var $fs = require("fs");


function isValidIdentifier(x) {
  return /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(x);
}


function toIdentifier(x) {
  if (x.type === "Identifier") {
    return x;

  } else if (x.type === "Literal" && typeof x.value === "string" && isValidIdentifier(x.value)) {
    return {
      type: "Identifier",
      name: x.value,
      loc: x.loc
    };

  } else {
    return null;
  }
}


function mergeLoc(x, y) {
  return {
    start: x.start,
    end: y.end,
    // TODO is this correct ?
    lines: x.lines,
    // TODO is this correct ?
    indent: x.indent
  };
}


function exportVar(imports, identifier, expression, loc) {
  if (expression.type === "Identifier") {
    // export { expression as identifier };
    return {
      type: "ExportNamedDeclaration",
      declaration: null,
      specifiers: [{
        type: "ExportSpecifier",
        local: expression,
        exported: identifier,
        loc: mergeLoc(expression.loc, identifier.loc)
      }],
      source: null,
      loc: loc
    };

  } else if (expression.type === "MemberExpression" &&
             expression.object.type === "Identifier") {
    var file = imports[expression.object.name];

    if (file != null) {
      var from = toIdentifier(expression.property);

      if (from !== null) {
        // export { from as identifier } from file;
        return {
          type: "ExportNamedDeclaration",
          declaration: null,
          specifiers: [{
            type: "ExportSpecifier",
            local: from,
            exported: identifier,
            loc: mergeLoc(from.loc, identifier.loc)
          }],
          source: file,
          loc: loc
        };
      }
    }
  }

  // export var identifier = expression;
  return {
    type: "ExportNamedDeclaration",
    declaration: {
      type: "VariableDeclaration",
      kind: "var",
      declarations: [{
        type: "VariableDeclarator",
        id: identifier,
        init: expression,
        loc: mergeLoc(identifier.loc, expression.loc)
      }],
      loc: loc
    },
    specifiers: [],
    source: null,
    loc: loc
  };
}


function pursPath(options, path) {
  // TODO should this use resolve ?
  return $path.resolve($path.join(options.outputDir, path, "index.js"));
}


var entryPath = "\0rollup-plugin-purs:entry-point";


function isGlobal(path, name) {
  return path.scope.lookup(name) === null;
}


function isGlobalIdentifier(path, node, name) {
  return node.type === "Identifier" &&
         node.name === name &&
         isGlobal(path, node.name);
}


module.exports = function (options) {
  if (options == null) {
    options = {};
  }

  if (options.outputDir == null) {
    options.outputDir = "output";
  }

  var filter = $utils.createFilter(options.include, options.exclude);

  var entry = null;

  return {
    name: "purs",

    // TODO hacky
    options: function (rollup) {
      if (rollup.entry != null &&
          rollup.entry !== entryPath &&
          $path.extname(rollup.entry) === ".purs") {
        entry = rollup.entry;
        rollup.entry = entryPath;
      }
    },

    resolveId: function (id) {
      // TODO hacky
      if (id === entryPath) {
        return id;

      } else if ($path.extname(id) === ".purs") {
        // TODO hacky
        return new Promise(function (resolve, reject) {
          $fs.readFile(id, { encoding: "utf8" }, function (err, file) {
            if (err) {
              reject(err);

            } else {
              // TODO super hacky
              var a = /(?:^|\n|\r\n) *module +([^ ]+)/.exec(file);

              if (a) {
                resolve(pursPath(options, a[1]));

              } else {
                reject(new Error("Could not detect module name for file " + id));
              }
            }
          });
        });
      }
    },

    // TODO hacky
    // This creates a main entry point that calls the `main` function of the main PureScript module
    load: function (id) {
      if (id === entryPath) {
        // TODO better stringification for the path ?
        // TODO source maps for this ?
        return "import { main } from " + JSON.stringify(entry) + "; main();";
      }
    },

    transform: function (code, id) {
      // TODO better filtering ?
      if (!filter(id)) return;

      var ast = $recast.parse(code, {
        sourceFileName: id
      });

      var imports = {};

      $recast.types.visit(ast, {
        visitProgram: function (path) {
          var node = path.node;

          var body = [];

          node.body.forEach(function (x) {
            if (x.type === "VariableDeclaration") {
              var declarations = [];

              x.declarations.forEach(function (x) {
                // TODO handle other patterns rather than only identifiers ?
                // var foo = require("bar");
                if (x.init !== null &&
                    x.init.type === "CallExpression" &&
                    isGlobalIdentifier(path, x.init.callee, "require") &&
                    x.id.type === "Identifier" &&
                    x.init.arguments.length === 1 &&
                    x.init.arguments[0].type === "Literal" &&
                    typeof x.init.arguments[0].value === "string") {
                  var file = x.init.arguments[0];

                  imports[x.id.name] = file;

                  body.push({
                    type: "ImportDeclaration",
                    specifiers: [{
                      type: "ImportNamespaceSpecifier",
                      local: x.id,
                      loc: x.id.loc
                    }],
                    source: file,
                    importKind: "value",
                    // TODO if there is only one assignment, use the source map for the whole declaration
                    loc: x.loc
                  });

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
                       x.expression.left.type === "MemberExpression") {
              if (isGlobalIdentifier(path, x.expression.left.object, "exports")) {
                // TODO what about computed expressions ?
                var identifier = toIdentifier(x.expression.left.property);

                // exports.foo = bar;
                if (identifier !== null) {
                  body.push(exportVar(imports, identifier, x.expression.right, x.loc));

                } else {
                  body.push(x);
                }

              // module.exports = foo;
              } else if (isGlobalIdentifier(path, x.expression.left.object, "module")) {
                // module.exports = { ... };
                if (x.expression.right.type === "ObjectExpression") {
                  x.expression.right.properties.forEach(function (x) {
                    // TODO what about computed expressions ?
                    var identifier = toIdentifier(x.key);

                    // foo: bar
                    if (identifier !== null) {
                      // TODO handle get/set different ?
                      body.push(exportVar(imports, identifier, x.value, x.loc));

                    } else {
                      throw new Error("Invalid module export: " + $recast.print(x).code);
                    }
                  });
                }

                // export default foo;
                body.push({
                  type: "ExportDefaultDeclaration",
                  declaration: x.expression.right,
                  loc: x.loc
                });

              } else {
                body.push(x);
              }

            } else {
              body.push(x);
            }
          });

          node.body = body;

          this.traverse(path);
        },

        visitMemberExpression: function (path) {
          var node = path.node;

          // foo["bar"] = qux;
          if (node.computed &&
              node.property.type === "Literal" &&
              typeof node.property.value === "string" &&
              isValidIdentifier(node.property.value)) {
            node.computed = false;
            // foo.bar = qux;
            node.property = {
              type: "Identifier",
              name: node.property.value,
              loc: node.property.loc
            };
          }

          if (isGlobalIdentifier(path, node.object, "exports")) {
            throw new Error("Invalid exports: " + $recast.print(node).code);

          } else if (isGlobalIdentifier(path, node.object, "module")) {
            throw new Error("Invalid module: " + $recast.print(node).code);
          }

          this.traverse(path);
        },

        visitCallExpression: function (path) {
          var node = path.node;

          if (isGlobalIdentifier(path, node.callee, "require")) {
            throw new Error("Invalid require: " + $recast.print(node).code);
          }

          this.traverse(path);
        }
      });

      var out = $recast.print(ast, {
        // TODO is this correct ?
        sourceMapName: id + ".map"
      });

      //console.log(out.code);

      return out;
    }
  };
};
