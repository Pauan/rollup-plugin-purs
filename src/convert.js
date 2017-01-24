var $recast = require("recast");
var $utils = require("rollup-pluginutils");
var $walk = require("./walk");
var $util = require("./util");


function isValidIdentifier(x) {
  return /^[$_a-zA-Z'][$_a-zA-Z0-9']*$/.test(x);
}


function stringToIdentifier(x) {
  if (x.type === "Literal" && typeof x.value === "string" && isValidIdentifier(x.value)) {
    if (/'/.test(x.value)) {
      this.warn("Primes are not allowed in JavaScript identifiers: " + x.value);
    }

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
    return stringToIdentifier.call(this, x);
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


function exportVar(body, scope, imports, exports, identifier, expression, loc) {
  if (expression.type === "Identifier") {
    // TODO adjust the loc ?
    setExport.call(this, exports, identifier.name, expression);

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

  } else if (expression.type === "MemberExpression" &&
             expression.object.type === "Identifier" &&
             $util.hasKey(imports, expression.object.name)) {
    var file = imports[expression.object.name];
    var from = toIdentifier.call(this, expression.property);

    if (from !== null) {
      // TODO adjust the loc ?
      setExport.call(this, exports, identifier.name, expression);

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

  if (isUndefined(scope, identifier.name)) {
    // TODO guarantee that collisions cannot occur ?
    var temp = {
      type: "Identifier",
      name: $util.makeTemporary(scope, identifier.name),
      // TODO is this correct ?
      loc: identifier.loc
    };

    // TODO adjust the loc ?
    setExport.call(this, exports, identifier.name, temp);

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
    this.error("Variable " + identifier.name + " already exists");
  }
}


function setExport(exports, name, value) {
  if ($util.hasKey(exports, name)) {
    this.error("Variable " + name + " is already exported");

  } else {
    exports[name] = value;
  }
}


function isUndefined(scope, name) {
  return $util.lookup(scope, name) === null;
}


function isUndefinedIdentifier(scope, node, name) {
  return node.type === "Identifier" &&
         node.name === name &&
         isUndefined(scope, node.name);
}


function isProperty(x, name) {
  return (!x.computed && x.property.type === "Identifier" && x.property.name === name) ||
         (x.computed && x.property.type === "Literal" && x.property.value === name);
}


function replaceExport(scope, exports, name) {
  var scope = $util.lookup(scope, name);

  if ($util.hasKey(exports, name)) {
    var exported = exports[name];

    if (scope === null || scope.isGlobal) {
      // TODO adjust the source maps ?
      return exported;

    } else {
      this.error("Variable " + name + " is defined in a sub-scope");
    }

  } else {
    this.error("Variable " + name + " is not exported");
  }

  return null;
}


module.exports = function (code, filePath) {
  var _this = this;

  var ast = $recast.parse(code, {
    sourceFileName: filePath
  });

  var scope = $utils.attachScopes(ast, "scope");

  var imports = {};
  var exports = {};

  var moduleOverwritten = false;

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

  $walk.scope(ast, scope, function (parent, node, scope, traverse) {
    if (node.type === "Program") {
      var body = [];

      node.body.forEach(function (x) {
        if (x.type === "VariableDeclaration") {
          var declarations = [];

          x.declarations.forEach(function (x) {
            // TODO handle other patterns rather than only identifiers ?
            // var foo = require("bar");
            if (x.init !== null &&
                x.init.type === "CallExpression" &&
                isUndefinedIdentifier(scope, x.init.callee, "require") &&
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
          if (isUndefinedIdentifier(scope, x.expression.left.object, "exports")) {
            // TODO what about computed expressions ?
            var identifier = toIdentifier.call(_this, x.expression.left.property);

            // exports.foo = bar;
            if (identifier !== null) {
              if (moduleOverwritten) {
                _this.warn("Export " + identifier.name + " is ignored");
              }

              exportVar.call(_this, body, scope, imports, exports, identifier, x.expression.right, x.loc);

            } else {
              body.push(x);
            }

          // module.exports = foo;
          } else if (isUndefinedIdentifier(scope, x.expression.left.object, "module") &&
                     isProperty(x.expression.left, "exports")) {
            moduleOverwritten = true;

            for (var key in exports) {
              if ($util.hasKey(exports, key)) {
                _this.warn("Export " + key + " is ignored");
              }
            }

            // module.exports = { ... };
            if (x.expression.right.type === "ObjectExpression") {
              x.expression.right.properties.forEach(function (x) {
                // TODO what about computed expressions ?
                var identifier = toIdentifier.call(_this, x.key);

                // foo: bar
                if (identifier !== null) {
                  // TODO handle get/set different ?
                  exportVar.call(_this, body, scope, imports, exports, identifier, x.value, x.loc);

                } else {
                  _this.warn("Invalid module export: " + $recast.print(x).code);
                }
              });
            }

            // TODO guarantee that collisions cannot occur ?
            var temp = {
              type: "Identifier",
              name: $util.makeTemporary(scope, "default"),
              // TODO is this correct ?
              loc: x.expression.left.loc
            };

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

    } else if (node.type === "MemberExpression") {
      var identifier = stringToIdentifier.call(_this, node.property);

      // foo["bar"] = qux;
      if (identifier !== null && node.computed) {
        // foo.bar = qux;
        node.computed = false;
        node.property = identifier;
      }

      // TODO handle module.exports.foo ?
      if (isUndefinedIdentifier(scope, node.object, "exports") &&
          // TODO is this correct ?
          !node.computed &&
          node.property.type === "Identifier" &&
          // TODO is this correct ?
          !moduleOverwritten) {
        node = replaceExport.call(_this, scope, exports, node.property.name);

      } else if (isUndefinedIdentifier(scope, node.object, "module") &&
                 isProperty(node, "exports") &&
                 // TODO is this correct ?
                 moduleOverwritten) {
        node = replaceExport.call(_this, scope, exports, "default");
      }

    } else if (node.type === "Identifier") {
      if (warnOnDynamicRequire && isUndefinedIdentifier(scope, node, "require")) {
        _this.warn("Dynamic " + $recast.print(node).code);

      } else if (warnOnDynamicExports && isUndefinedIdentifier(scope, node, "exports")) {
        _this.warn("Dynamic " + $recast.print(node).code);

      } else if (warnOnDynamicModule && isUndefinedIdentifier(scope, node, "module")) {
        _this.warn("Dynamic " + $recast.print(node).code);
      }
    }

    traverse(node);
    return node;
  });


  var out = $recast.print(ast, {
    // TODO is this correct ?
    sourceMapName: filePath + ".map"
  });

  //console.log(out.code);

  return out;
};
