"use strict";

var $babel = require("babel-core");
var $util = require("./util");


function isValidIdentifier(x) {
  return /^[$_a-zA-Z'][$_a-zA-Z0-9']*$/.test(x);
}


function stringToIdentifier(state, x) {
  if (x.type === "StringLiteral" && isValidIdentifier(x.value)) {
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
}


function toIdentifier(state, x) {
  if (x.type === "Identifier") {
    return x;

  } else {
    return stringToIdentifier(state, x);
  }
}


function mergeLoc(x, y) {
  return {
    start: x.start,
    end: y.end
  };
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
    var from = toIdentifier(state, expression.property);

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
        loc: mergeLoc(temp.loc, expression.loc)
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
        loc: mergeLoc(temp.loc, identifier.loc)
      }],
      source: null,
      loc: loc
    });

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


function isUndefinedIdentifier(path, node, name) {
  return node.type === "Identifier" &&
         node.name === name &&
         isUndefined(path, node.name);
}


function isProperty(x, name) {
  return (!x.computed && x.property.type === "Identifier" && x.property.name === name) ||
         (x.computed && x.property.type === "StringLiteral" && x.property.value === name);
}


function replaceExport(state, name) {
  if ($util.hasKey(state.exports, name)) {
    // TODO check that the exported variable isn't bound ?
    // TODO adjust the source maps ?
    return state.exports[name];

  } else {
    // TODO loc
    state.opts.error("Variable " + name + " is not exported");
  }

  return null;
}


function isRequireCall(path, node) {
  return node.type === "CallExpression" &&
         isUndefinedIdentifier(path, node.callee, "require") &&
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
                     x.expression.left.type === "MemberExpression") {
            // TODO handle module.exports.foo ?
            if (isUndefinedIdentifier(path, x.expression.left.object, "exports")) {
              // TODO what about computed expressions ?
              var identifier = toIdentifier(state, x.expression.left.property);

              // exports.foo = bar;
              if (identifier !== null) {
                if (state.moduleOverwritten) {
                  // TODO is identifier.start correct ?
                  state.opts.warn("Export " + identifier.name + " is ignored", identifier.start);
                }

                exportVar(state, body, path, identifier, x.expression.right, x.loc);

              } else {
                body.push(x);
              }

            // module.exports = foo;
            } else if (isUndefinedIdentifier(path, x.expression.left.object, "module") &&
                       isProperty(x.expression.left, "exports")) {
              state.moduleOverwritten = true;

              for (var key in state.exports) {
                if ($util.hasKey(state.exports, key)) {
                  // TODO loc
                  state.opts.warn("Export " + key + " is ignored");
                }
              }

              // module.exports = { ... };
              if (x.expression.right.type === "ObjectExpression") {
                x.expression.right.properties.forEach(function (x) {
                  // TODO what about computed expressions ?
                  var identifier = toIdentifier(state, x.key);

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

              // TODO guarantee that collisions cannot occur ?
              var temp = path.scope.generateUidIdentifier("default");

              // TODO is this correct ?
              temp.loc = x.expression.left.loc;

              setExport(state, "default", temp);

              // TODO maybe use const ?
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
      },

      MemberExpression: function (path, state) {
        var node = path.node;

        var identifier = stringToIdentifier(state, node.property);

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
            !state.moduleOverwritten) {
          path.replaceWith(replaceExport(state, node.property.name));

        } else if (isUndefinedIdentifier(path, node.object, "module") &&
                   isProperty(node, "exports") &&
                   // TODO is this correct ?
                   state.moduleOverwritten) {
          path.replaceWith(replaceExport(state, "default"));
        }
      },

      ReferencedIdentifier: function (path, state) {
        var node = path.node;

        if (state.opts.warnOnDynamicRequire && isUndefinedIdentifier(path, node, "require")) {
          state.opts.warn("Dynamic require", node.start);

        } else if (state.opts.warnOnDynamicExports && isUndefinedIdentifier(path, node, "exports")) {
          state.opts.warn("Dynamic exports", node.start);

        } else if (state.opts.warnOnDynamicModule && isUndefinedIdentifier(path, node, "module")) {
          state.opts.warn("Dynamic module", node.start);
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
