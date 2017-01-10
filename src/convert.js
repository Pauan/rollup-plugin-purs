var $recast = require("recast");
var $util = require("./util");


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
    if ($util.hasKey(imports, expression.object.name)) {
      var file = imports[expression.object.name];
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
  if ($util.hasKey(exports, name)) {
    this.error("Variable " + name + " is already exported");

  } else {
    exports[name] = value;
  }
}


function isUndefined(path, name) {
  return path.scope.lookup(name) === null;
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

  if ($util.hasKey(exports, name)) {
    var exported = exports[name];

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


module.exports = function (code, filePath) {
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
              if ($util.hasKey(exports, key)) {
                _this.warn("Export " + key + " is ignored");
              }
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
        _this.warn("Dynamic " + $recast.print(node).code);

      } else if (isUndefinedIdentifier(path, node, "exports")) {
        _this.warn("Dynamic " + $recast.print(node).code);

      } else if (isUndefinedIdentifier(path, node, "module")) {
        _this.warn("Dynamic " + $recast.print(node).code);
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
};
