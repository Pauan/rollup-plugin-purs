var $walk = require("./walk");
var $util = require("./util");
var $isReference = require("is-reference");


module.exports = function (ast, scope) {
  return $walk.scope(ast, scope, function (parent, node, scope, traverse) {
    if (node.type === "Identifier" && $isReference(node, parent)) {
      var def = $util.lookup(scope, node.name);

      if (def != null) {
        if (def.renamed == null) {
          def.renamed = {};
        }

        if (!$util.hasKey(def.renamed, node.name)) {
          def.renamed[node.name] = $util.makeTemporary(def, node.name);
        }

        return {
          type: "Identifier",
          name: def.renamed[node.name],
          loc: node.loc
        };
      }
    }

    traverse(node);

    return node;
  });
};
