var $walk = require("./walk");
var $util = require("./util");
var $isReference = require("is-reference");


function isSimple(id, init) {
  return (init.type === "Identifier" &&
          // Don't propagate it if the new name is the same as the old name
          id.name !== init.name) ||
         // TODO What about regexps ?
         init.type === "Literal";
}


function findReferences(ast, scope) {
  return $walk.scope(ast, scope, function (parent, node, scope, traverse) {
    if (node.type === "VariableDeclaration") {
      var declarations = [];

      node.declarations.forEach(function (x) {
        if (x.id.type === "Identifier" &&
            x.init !== null &&
            isSimple(x.id, x.init)) {
          if (scope.propagating == null) {
            scope.propagating = {};
          }

          scope.propagating[x.id.name] = x.init;

        } else {
          declarations.push(x);
        }
      });

      if (declarations.length === 0) {
        return {
          type: "EmptyStatement",
          loc: node.loc
        };

      } else {
        node.declarations = declarations;
      }
    }

    traverse(node);
    return node;
  });
}


function replaceReferences(ast, scope) {
  var _this = this;

  return $walk.scope(ast, scope, function (parent, node, scope, traverse) {
    var newNode = node;

    var originalScope = null;

    for (;;) {
      // TODO is the $isReference needed ?
      if (newNode.type === "Identifier" && $isReference(newNode, parent)) {
        var def = $util.lookup(scope, newNode.name);

        if (def != null &&
            def.propagating != null &&
            $util.hasKey(def.propagating, newNode.name)) {
          originalScope = def;
          newNode = def.propagating[newNode.name];

        } else {
          break;
        }

      } else {
        break;
      }
    }

    // TODO does this need to use $isReference ?
    if (newNode !== node &&
        newNode.type === "Identifier" &&
        // TODO is this correct ?
        originalScope !== $util.lookup(scope, newNode.name)) {
      // TODO loc
      // TODO replace with _this.warn (https://github.com/rollup/rollup/issues/1282)
      console.warn("Could not replace " + node.name + " with " + newNode.name);

      newNode = node;
    }

    traverse(newNode);
    return newNode;
  });
}


module.exports = function (ast, scope) {
  return replaceReferences.call(this, findReferences.call(this, ast, scope), scope);
};
