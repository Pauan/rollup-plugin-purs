"use strict";

var $babel = require("babel-core");
var $util = require("./util");


// TODO handle unicode
function isValidIdentifier(x) {
  return /^[$_a-zA-Z'][$_a-zA-Z0-9']*$/.test(x);
}


function toIdentifier(state, x, computed) {
  if (x.type === "StringLiteral") {
    if (isValidIdentifier(x.value)) {
      if (/'/.test(x.value)) {
        state.opts.warn("Primes are not allowed in JavaScript identifiers: " + x.value, x.start);
      }

      return {
        type: "Identifier",
        name: x.value.replace(/'/g, "$prime"),
        start: x.start,
        end: x.end,
        loc: x.loc
      };

    } else {
      return null;
    }

  } else if (!computed && x.type === "Identifier") {
    return x;

  } else {
    return null;
  }
}


function mergeLoc(x, y) {
  return {
    start: x.start,
    end: y.end
  };
}


function exportTempVar(state, body, path, identifier, expression, loc) {
  // TODO guarantee that collisions cannot occur ?
  var temp = path.scope.generateUidIdentifier(identifier.name);

  // TODO is this correct ?
  temp.loc = identifier.loc;

  // TODO adjust the loc ?
  setExport(state, identifier.name, temp);

  // TODO maybe use const ?
  // var temp = expression;
  body.push({
    type: "VariableDeclaration",
    kind: "var",
    declarations: [{
      type: "VariableDeclarator",
      id: temp,
      init: expression,
      // TODO mergeLoc(temp.loc, expression.loc) ?
      loc: loc
    }],
    loc: loc
  });

  // export { temp as identifier };
  body.push({
    type: "ExportNamedDeclaration",
    declaration: null,
    specifiers: [{
      type: "ExportSpecifier",
      local: temp,
      exported: identifier,
      // TODO mergeLoc(temp.loc, identifier.loc) ?
      loc: loc
    }],
    source: null,
    loc: loc
  });
}


function exportVar(state, body, path, identifier, expression, loc) {
  if (expression.type === "Identifier" &&
      // TODO is this check correct ?
      !isUndefined(path, expression.name)) {
    // TODO adjust the loc ?
    setExport(state, identifier.name, expression);

    // export { expression as identifier };
    body.push({
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
    });
    return;

  // TODO does this need to check that the expression identifier is defined ?
  } else if (expression.type === "MemberExpression" &&
             expression.object.type === "Identifier" &&
             $util.hasKey(state.imports, expression.object.name)) {
    var file = state.imports[expression.object.name];
    var from = toIdentifier(state, expression.property, expression.computed);

    if (from !== null) {
      // TODO adjust the loc ?
      setExport(state, identifier.name, expression);

      // export { from as identifier } from file;
      body.push({
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
      });
      return;
    }
  }

  if (isUndefined(path, identifier.name)) {
    exportTempVar(state, body, path, identifier, expression, loc);

  } else {
    // TODO maybe this should warn instead ?
    // TODO is this the correct loc ?
    state.opts.error("Variable " + identifier.name + " already exists", identifier.start);
  }
}


function setExport(state, name, value) {
  if ($util.hasKey(state.exports, name)) {
    // TODO loc
    state.opts.error("Variable " + name + " is already exported");

  } else {
    state.exports[name] = value;
  }
}


function isUndefined(path, name) {
  // TODO is this correct ?
  return !path.scope.hasBinding(name, true);
}


function isUndefinedIdentifier(path, node) {
  return node.type === "Identifier" &&
         isUndefined(path, node.name);
}


// TODO what if the variable isn't exported ?
function replaceExport(state, path, identifier, loc) {
  if ($util.hasKey(state.exports, identifier.name)) {
    // TODO adjust the source maps ?
    return state.exports[identifier.name];

  } else {
    // TODO make this faster ?
    var top = path.findParent(function (path) { return path.isProgram(); });

    // TODO does it need to mangle the name ?
    var temp = path.scope.generateUidIdentifier(identifier.name);

    temp.loc = identifier.loc;

    // export { temp as identifier };
    top.node.body.unshift({
      type: "ExportNamedDeclaration",
      declaration: null,
      specifiers: [{
        type: "ExportSpecifier",
        local: temp,
        exported: identifier,
        loc: loc
      }],
      source: null,
      loc: loc
    });

    // TODO use unshiftContainer ?
    // var temp;
    top.node.body.unshift({
      type: "VariableDeclaration",
      kind: "var",
      declarations: [{
        type: "VariableDeclarator",
        id: temp,
        init: null,
        loc: loc
      }],
      loc: loc
    });

    state.exports[identifier.name] = temp;
    return temp;
  }
}


function isRequireCall(path, node) {
  return node.type === "CallExpression" &&
         isUndefinedIdentifier(path, node.callee) &&
         node.callee.name === "require" &&
         node.arguments.length === 1 &&
         node.arguments[0].type === "StringLiteral";
}


function transformCommonJS(babel) {
  return {
    pre: function () {
      this.imports = {};
      this.exports = {};
      this.moduleOverwritten = false;
    },
    visitor: {
      Program: function (path, state) {
        var node = path.node;

        var body = [];

        node.body.forEach(function (x) {
          if (x.type === "VariableDeclaration") {
            var declarations = [];

            x.declarations.forEach(function (x) {
              // TODO handle other patterns rather than only identifiers ?
              // var foo = require("bar");
              if (x.id.type === "Identifier" &&
                  x.init !== null &&
                  isRequireCall(path, x.init)) {
                var file = x.init.arguments[0];

                state.imports[x.id.name] = file;

                body.push({
                  type: "ImportDeclaration",
                  specifiers: [{
                    type: "ImportNamespaceSpecifier",
                    local: x.id,
                    loc: x.id.loc
                  }],
                  source: file,
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
                     x.expression.type === "StringLiteral" &&
                     x.expression.value === "use strict") {
            // Do nothing

          // require("foo");
          } else if (x.type === "ExpressionStatement" &&
                     isRequireCall(path, x.expression)) {
            var file = x.expression.arguments[0];

            body.push({
              type: "ImportDeclaration",
              specifiers: [],
              source: file,
              // TODO if there is only one assignment, use the source map for the whole declaration
              loc: x.loc
            });

          } else if (x.type === "ExpressionStatement" &&
                     x.expression.type === "AssignmentExpression" &&
                     x.expression.operator === "=" &&
                     x.expression.left.type === "MemberExpression" &&
                     isUndefinedIdentifier(path, x.expression.left.object)) {
            var identifier = toIdentifier(state, x.expression.left.property, x.expression.left.computed);

            if (identifier !== null) {
              // TODO handle module.exports.foo ?
              // exports.foo = bar;
              if (x.expression.left.object.name === "exports") {
                if (state.moduleOverwritten) {
                  // TODO is identifier.start correct ?
                  state.opts.warn("Export " + identifier.name + " is ignored", identifier.start);
                }

                exportVar(state, body, path, identifier, x.expression.right, x.loc);

              // module.exports = foo;
              } else if (x.expression.left.object.name === "module" &&
                         identifier.name === "exports") {
                state.moduleOverwritten = true;

                for (var key in state.exports) {
                  if ($util.hasKey(state.exports, key)) {
                    // TODO loc
                    state.opts.warn("Export " + key + " is ignored");
                  }
                }

                // module.exports = require("foo");
                if (isRequireCall(path, x.expression.right)) {
                  var file = x.expression.right.arguments[0];

                  body.push({
                    type: "ExportAllDeclaration",
                    source: file,
                    loc: x.loc
                  });

                } else {
                  // module.exports = { ... };
                  if (x.expression.right.type === "ObjectExpression") {
                    x.expression.right.properties.forEach(function (x) {
                      // TODO what about computed expressions ?
                      var identifier = toIdentifier(state, x.key, x.computed);

                      // foo: bar
                      if (identifier !== null) {
                        // TODO handle get/set different ?
                        exportVar(state, body, path, identifier, x.value, x.loc);

                      } else {
                        // TODO is this the correct loc ?
                        state.opts.warn("Invalid module export", x.start);
                      }
                    });
                  }

                  exportTempVar(state, body, path, {
                    type: "Identifier",
                    name: "default",
                    // TODO is this correct ?
                    loc: x.expression.left.loc
                  }, x.expression.right, x.loc);
                }

              } else {
                body.push(x);
              }

            } else {
              body.push(x);
            }

          } else {
            body.push(x);
          }
        });

        node.body = body;
      },

      AssignmentExpression: function (path, state) {
        var node = path.node;

        // module.exports = foo;
        if (node.operator === "=" &&
            node.left.type === "MemberExpression" &&
            isUndefinedIdentifier(path, node.left.object) &&
            node.left.object.name === "module") {
          var identifier = toIdentifier(state, node.left.property, node.left.computed);

          if (identifier !== null &&
              identifier.name === "exports") {
            // TODO code duplication
            state.moduleOverwritten = true;

            // TODO code duplication
            for (var key in state.exports) {
              if ($util.hasKey(state.exports, key)) {
                // TODO loc
                state.opts.warn("Export " + key + " is ignored");
              }
            }

            // module.exports = { ... };
            if (node.right.type === "ObjectExpression") {
              // TODO handle get/set different ?
              node.right.properties.forEach(function (x) {
                // TODO what about computed expressions ?
                var identifier = toIdentifier(state, x.key, x.computed);

                // foo: bar
                if (identifier !== null) {
                  // TODO handle this better if it is an identifier ?
                  x.value = {
                    type: "AssignmentExpression",
                    operator: "=",
                    left: replaceExport(state, path, identifier),
                    right: x.value,
                    loc: x.value.loc
                  };

                } else {
                  // TODO is this the correct loc ?
                  state.opts.warn("Invalid module export", x.start);
                }
              });
            }
          }
        }
      },


      MemberExpression: function (path, state) {
        var node = path.node;

        var identifier = toIdentifier(state, node.property, node.computed);

        if (identifier !== null) {
          node.computed = false;
          node.property = identifier;

          if (isUndefinedIdentifier(path, node.object)) {
            // TODO handle module.exports.foo ?
            // exports.foo
            if (node.object.name === "exports") {
              path.replaceWith(replaceExport(state, path, identifier));

            // module.exports
            } else if (node.object.name === "module" &&
                       identifier.name === "exports") {
              path.replaceWith(replaceExport(state, path, {
                type: "Identifier",
                name: "default",
                // TODO is this correct ?
                loc: node.loc
              }));
            }
          }
        }
      },

      ReferencedIdentifier: function (path, state) {
        var node = path.node;

        if (isUndefinedIdentifier(path, node)) {
          if (node.name === "require") {
            if (state.opts.warnOnDynamicRequire) {
              state.opts.warn("Dynamic require", node.start);
            }

          } else if (node.name === "exports") {
            if (state.opts.warnOnDynamicExports) {
              state.opts.warn("Dynamic exports", node.start);
            }

          } else if (node.name === "module") {
            if (state.opts.warnOnDynamicModule) {
              state.opts.warn("Dynamic module", node.start);
            }
          }
        }
      }
    }
  };
}


module.exports = function (code, filePath) {
  var warnOnDynamicExports = true;
  var warnOnDynamicRequire = true;
  var warnOnDynamicModule = true;

  var comments = $util.matches(code, /(?:^|\n|\r\n)\/\/ rollup-plugin-purs (.+)/g);

  comments.forEach(function (a) {
    var x = a[0];

    switch (x) {
    case "ignore dynamic exports":
      warnOnDynamicExports = false;
      break;
    case "ignore dynamic require":
      warnOnDynamicRequire = false;
      break;
    case "ignore dynamic module":
      warnOnDynamicModule = false;
      break;
    default:
      throw new Error("Unknown rollup-plugin-purs pragma: " + x);
    }
  });

  // TODO what about sourceRoot ?
  return $babel.transform(code, {
    babelrc: false,
    ast: false,
    // TODO is this correct ?
    filename: filePath,
    sourceMaps: true,
    plugins: [
      [transformCommonJS, {
        warn: this.warn,
        error: this.error,
        warnOnDynamicExports: warnOnDynamicExports,
        warnOnDynamicRequire: warnOnDynamicRequire,
        warnOnDynamicModule: warnOnDynamicModule
      }]
    ]
  });
};
