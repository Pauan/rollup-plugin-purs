"use strict";

module.exports = function (babel) {
  return {
    visitor: {
      VariableDeclaration: function (path, state) {
        var parent = path.parentPath.node;
        var node = path.node;

        // TODO is this correct ?
        if (parent.type !== "ForStatement" &&
            parent.type !== "ForInStatement" &&
            parent.type !== "ForOfStatement") {
          if (node.declarations.length > 1) {
            path.replaceWithMultiple(node.declarations.map(function (x) {
              // TODO loc
              return {
                type: "VariableDeclaration",
                kind: node.kind,
                declarations: [x]
              };
            }));
          }
        }
      }
    }
  };
};
