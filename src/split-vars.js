"use strict";


module.exports = function (babel) {
  return {
    visitor: {
      VariableDeclaration: {
        // TODO should this use enter or exit ?
        exit: function (path, state) {
          var node = path.node;

          if (node.declarations.length > 1) {
            var last = node.declarations.pop();

            path.insertBefore(node.declarations.map(function (x) {
              // TODO loc
              return {
                type: "VariableDeclaration",
                kind: node.kind,
                declarations: [x]
              };
            }));

            node.declarations = [last];
          }
        }
      }
    }
  };
};
