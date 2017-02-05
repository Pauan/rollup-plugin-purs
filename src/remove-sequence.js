"use strict";


module.exports = function (babel) {
  return {
    visitor: {
      SequenceExpression: function (path) {
        var node = path.node;

        if (node.expressions.length === 1) {
          path.replaceWith(node.expressions[0]);
        }
      }
    }
  };
};
