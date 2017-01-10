var $recast = require("recast");
var $utils = require("rollup-pluginutils");
var $path = require("path");
var $fs = require("fs");


function isValidIdentifier(x) {
  return /^[$_a-zA-Z'][$_a-zA-Z0-9']*$/.test(x);
}


function stringToIdentifier(x) {
  if (x.type === "Literal" && typeof x.value === "string" && isValidIdentifier(x.value)) {
    return {
      type: "Identifier",
      name: x.value.replace(/'/g, "$prime"),
      loc: x.loc
    };

  } else {
    return null;
  }
}


function toIdentifier(x) {
  if (x.type === "Identifier") {
    return x;

  } else {
    return stringToIdentifier(x);
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


function exportVar(path, imports, exports, identifier, expression, loc) {
  if (expression.type === "Identifier") {
    // TODO adjust the loc ?
    setExport.call(this, exports, identifier.name, expression);

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
        // TODO adjust the loc ?
        setExport.call(this, exports, identifier.name, expression);

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

  if (isUndefined(path, identifier.name)) {
    // TODO adjust the loc ?
    setExport.call(this, exports, identifier.name, identifier);

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

  } else {
    // TODO maybe this should warn instead ?
    this.error("Variable " + identifier.name + " already exists");
  }
}


function setExport(exports, name, value) {
  if (exports[name] != null) {
    this.error("Variable " + name + " is already exported");

  } else {
    exports[name] = value;
  }
}


function pursPath(options, path) {
  // TODO should this use resolve ?
  return $path.resolve($path.join(options.outputDir, path, "index.js"));
}


var entryPath = "\0rollup-plugin-purs:entry-point";


function isUndefined(path, name) {
  return path.scope.lookup(name) === null;
}


function isGlobal(path, name) {
  var scope = path.scope.lookup(name);
  return scope !== null && scope.isGlobal;
}


function isUndefinedIdentifier(path, node, name) {
  return node.type === "Identifier" &&
         node.name === name &&
         isUndefined(path, node.name);
}


function isProperty(x, name) {
  return (!x.computed && x.property.type === "Identifier" && x.property.name === name) ||
         (x.computed && x.property.type === "Literal" && x.property.value === name);
}


function replaceExport(path, exports, name) {
  var scope = path.scope.lookup(name);

  var exported = exports[name];

  if (exported != null) {
    if (scope === null || scope.isGlobal) {
      // TODO adjust the source maps ?
      path.replace(exported);

    } else {
      this.error("Variable " + name + " is defined in a sub-scope");
    }

  } else {
    this.error("Variable " + name + " is not exported");
  }
}


function makeUncurried(path, id, top, body) {
  // Only decurry 1-argument functions
  if (top.params.length === 1) {
    var params = [top.params];

    var x = top;

    while (x.body.body.length === 1 &&
           x.body.body[0].type === "ReturnStatement" &&
           x.body.body[0].argument !== null &&
           x.body.body[0].argument.type === "FunctionExpression" &&
           // Only decurry 1-argument functions
           x.body.body[0].argument.params.length === 1) {
      x = x.body.body[0].argument;
      params.push(x.params);
    }

    if (x !== top) {
      // TODO better flatten function ?
      var flattened = [].concat.apply([], params);

      // TODO guarantee that collisions cannot occur ?
      var temp = path.scope.declareTemporary(id.name + "__private_do_not_use_uncurried__" + flattened.length + "__");

      // TODO is this correct ?
      temp.loc = id.loc;

      // TODO hacky
      // TODO use path.scope.lookup ?
      if (path.scope.curried == null) {
        path.scope.curried = {};
      }

      path.scope.curried[id.name] = {
        params: params,
        identifier: temp
      };

      body.push({
        type: "VariableDeclaration",
        kind: "var",
        declarations: [{
          type: "VariableDeclarator",
          id: temp,
          init: {
            type: "FunctionExpression",
            id: null,
            params: flattened,
            body: x.body,
            loc: top.loc
          },
          loc: top.loc
        }],
        loc: top.loc
      });

      x.body = {
        type: "BlockStatement",
        body: [{
          type: "ReturnStatement",
          argument: {
            type: "CallExpression",
            callee: temp,
            arguments: flattened,
            // TODO is this loc correct ?
            loc: x.body.loc
          },
          // TODO is this loc correct ?
          loc: x.body.loc
        }],
        // TODO is this loc correct ?
        loc: x.body.loc
      };
    }
  }
}

function getCurriedCall(path, top) {
  var args = [];

  var x = top;

  while (x.type === "CallExpression") {
    args.push(x.arguments);
    x = x.callee;
  }

  args.reverse();

  if (x.type === "Identifier") {
    var scope = path.scope.lookup(x.name);

    if (scope != null &&
        scope.curried != null &&
        x.name in scope.curried) {
      var curried = scope.curried[x.name];

      if (isArgumentsSaturated(curried.params, args)) {
        return {
          type: "CallExpression",
          callee: curried.identifier,
          // TODO better flatten function
          arguments: [].concat.apply([], args),
          // TODO is this loc correct ?
          loc: top.loc
        };
      }
    }
  }

  return null;
}

function isArgumentsSaturated(expected, actual) {
  var length = expected.length;

  if (length === actual.length) {
    for (var i = 0; i < length; ++i) {
      if (expected[i].length !== actual[i].length) {
        return false;
      }
    }

    return true;

  } else {
    return false;
  }
}


function makeInlined(path, id, top, body) {

}

function getInlinedCall(path, top) {
  return null;
}


module.exports = function (options) {
  if (options == null) {
    options = {};
  }

  if (options.outputDir == null) {
    options.outputDir = "output";
  }

  if (options.runMain == null) {
    options.runMain = true;
  }

  if (options.uncurry == null) {
    options.uncurry = true;
  }

  if (options.inline == null) {
    options.inline = true;
  }

  var filter = $utils.createFilter(options.include, options.exclude);

  var entry = null;

  return {
    name: "purs",

    // TODO hacky
    options: function (rollup) {
      if (options.runMain &&
          rollup.entry != null &&
          rollup.entry !== entryPath &&
          // TODO a bit hacky
          $path.extname(rollup.entry) === ".purs") {
        entry = rollup.entry;
        rollup.entry = entryPath;
      }
    },

    resolveId: function (filePath) {
      // TODO hacky
      if (filePath === entryPath) {
        return filePath;

      } else if ($path.extname(filePath) === ".purs") {
        // TODO hacky
        return new Promise(function (resolve, reject) {
          $fs.readFile(filePath, { encoding: "utf8" }, function (err, file) {
            if (err) {
              reject(err);

            } else {
              // TODO super hacky
              var a = /(?:^|\n|\r\n) *module +([^ ]+)/.exec(file);

              if (a) {
                resolve(pursPath(options, a[1]));

              } else {
                reject(new Error("Could not detect module name for file " + filePath));
              }
            }
          });
        });
      }
    },

    // TODO hacky
    // This creates a main entry point that calls the `main` function of the main PureScript module
    load: function (filePath) {
      if (filePath === entryPath) {
        // TODO better stringification for the path ?
        // TODO source maps for this ?
        return "import { main } from " + JSON.stringify(entry) + "; main();";
      }
    },

    transform: function (code, filePath) {
      // TODO better filtering ?
      if (!filter(filePath)) return;

      // TODO test if this optimization actually makes it faster or not
      if (!/exports|module|require/.test(code)) return;

      var _this = this;

      var ast = $recast.parse(code, {
        sourceFileName: filePath
      });

      var imports = {};
      var exports = {};

      var moduleOverwritten = false;

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
                    isUndefinedIdentifier(path, x.init.callee, "require") &&
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
              // TODO handle module.exports.foo ?
              if (isUndefinedIdentifier(path, x.expression.left.object, "exports")) {
                // TODO what about computed expressions ?
                var identifier = toIdentifier(x.expression.left.property);

                // exports.foo = bar;
                if (identifier !== null) {
                  if (moduleOverwritten) {
                    _this.warn("Export " + identifier.name + " is ignored");
                  }

                  body.push(exportVar.call(_this, path, imports, exports, identifier, x.expression.right, x.loc));

                } else {
                  body.push(x);
                }

              // module.exports = foo;
              } else if (isUndefinedIdentifier(path, x.expression.left.object, "module") &&
                         isProperty(x.expression.left, "exports")) {
                moduleOverwritten = true;

                for (var key in exports) {
                  _this.warn("Export " + key + " is ignored");
                }

                // module.exports = { ... };
                if (x.expression.right.type === "ObjectExpression") {
                  x.expression.right.properties.forEach(function (x) {
                    // TODO what about computed expressions ?
                    var identifier = toIdentifier(x.key);

                    // foo: bar
                    if (identifier !== null) {
                      // TODO handle get/set different ?
                      body.push(exportVar.call(_this, path, imports, exports, identifier, x.value, x.loc));

                    } else {
                      _this.warn("Invalid module export: " + $recast.print(x).code);
                    }
                  });
                }

                // TODO guarantee that collisions cannot occur ?
                var temp = path.scope.declareTemporary("__private_do_not_use_default__");

                // TODO is this correct ?
                temp.loc = x.expression.left.loc;

                setExport.call(_this, exports, "default", temp);

                // var temp = foo;
                body.push({
                  type: "VariableDeclaration",
                  kind: "var",
                  declarations: [{
                    type: "VariableDeclarator",
                    id: temp,
                    init: x.expression.right,
                    loc: x.loc
                  }],
                  loc: x.loc
                });

                // export default temp;
                body.push({
                  type: "ExportDefaultDeclaration",
                  declaration: temp,
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

          path.scope.scan(true);

          this.traverse(path);
        },

        visitMemberExpression: function (path) {
          var node = path.node;

          var identifier = stringToIdentifier(node.property);

          // foo["bar"] = qux;
          if (identifier !== null && node.computed) {
            // foo.bar = qux;
            node.computed = false;
            node.property = identifier;
          }

          // TODO handle module.exports.foo ?
          if (isUndefinedIdentifier(path, node.object, "exports") &&
              // TODO is this correct ?
              !node.computed &&
              node.property.type === "Identifier" &&
              // TODO is this correct ?
              !moduleOverwritten) {
            replaceExport.call(_this, path, exports, node.property.name);

          } else if (isUndefinedIdentifier(path, node.object, "module") &&
                     isProperty(node, "exports") &&
                     // TODO is this correct ?
                     moduleOverwritten) {
            replaceExport.call(_this, path, exports, "default");
          }

          this.traverse(path);
        },

        visitIdentifier: function (path) {
          var node = path.node;

          if (isUndefinedIdentifier(path, node, "require")) {
            _this.warn("Invalid " + $recast.print(node).code);

          } else if (isUndefinedIdentifier(path, node, "exports")) {
            _this.warn("Invalid " + $recast.print(node).code);

          } else if (isUndefinedIdentifier(path, node, "module")) {
            _this.warn("Invalid " + $recast.print(node).code);
          }

          this.traverse(path);
        }
      });


      var out = $recast.print(ast, {
        // TODO is this correct ?
        sourceMapName: filePath + ".map"
      });

      //console.log(out.code);

      return out;
    },


    // Decurrying optimization
    transformBundle: function (code) {
      var _this = this;

      var ast = $recast.parse(code, {
        // TODO is this correct ?
        sourceFileName: "\0rollup-plugin-purs:bundle"
      });

      function optimizeUncurry(path) {
        var node = path.node;

        var body = [];

        node.body.forEach(function (x) {
          if (x.type === "FunctionDeclaration") {
            if (options.uncurry) {
              makeUncurried(path, x.id, x, body);
            }

          } else if (x.type === "VariableDeclaration") {
            x.declarations.forEach(function (x) {
              if (x.init !== null && x.init.type === "FunctionExpression") {
                if (options.uncurry) {
                  makeUncurried(path, x.id, x.init, body);
                }
              }
            });
          }

          body.push(x);
        });

        node.body = body;

        this.traverse(path);
      }

      function optimizeInline(path) {
        var node = path.node;

        var body = [];

        node.body.forEach(function (x) {
          if (x.type === "FunctionDeclaration") {
            if (options.inline) {
              makeInlined(path, x.id, x, body);
            }

          } else if (x.type === "VariableDeclaration") {
            x.declarations.forEach(function (x) {
              if (x.init !== null && x.init.type === "FunctionExpression") {
                if (options.inline) {
                  makeInlined(path, x.id, x.init, body);
                }
              }
            });
          }

          body.push(x);
        });

        node.body = body;

        this.traverse(path);
      }

      $recast.types.visit(ast, {
        visitProgram: optimizeUncurry,
        visitBlockStatement: optimizeUncurry,

        visitCallExpression: function (path) {
          var node = path.node;

          if (options.uncurry) {
            var uncurried = getCurriedCall(path, node);

            if (uncurried !== null) {
              path.replace(uncurried);
            }
          }

          this.traverse(path);
        }
      });

      $recast.types.visit(ast, {
        visitProgram: optimizeInline,
        visitBlockStatement: optimizeInline,

        visitCallExpression: function (path) {
          var node = path.node;

          if (options.inline) {
            var inlined = getInlinedCall(path, node);

            if (inlined !== null) {
              path.replace(inlined);
            }
          }

          this.traverse(path);
        }
      });

      var out = $recast.print(ast, {
        // TODO is this correct ?
        sourceMapName: "\0rollup-plugin-purs:bundle.map"
      });

      //console.log(out.code);

      return out;
    }
  };
};
