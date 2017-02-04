"use strict";

var $util = require("./util");


var dereference = {
  ReferencedIdentifier: function (path) {
    var binding = path.scope.getBinding(path.node.name);

    if (binding != null) {
      console.log(path.node.name);
      binding.dereference();
    }
  }
};


var visitor = {
  Identifier: {
    exit: function (path) {
      var node = path.node;

      // TODO hacky
      if (path.parent.type === "VariableDeclarator" &&
          path.parent.id === node) {
        var binding = path.scope.getBinding(node.name);

        if (binding != null && binding.constant && binding.references === 1) {
          //var definition = binding.path.node;

          console.assert(path.parent === binding.path.node);
          console.assert(binding.identifier.type === "Identifier");
          console.assert(node.name === binding.identifier.name);

          //console.log("2", path.node.name, definition.type);

          console.log(binding.identifier.name, binding.path.node.type);

          binding.path.get("init").traverse(dereference);

          binding.path.remove();
          // TODO is this correct ?
          binding.scope.removeOwnBinding(binding.identifier.name);

          path.skip();
          binding.path.skip();

          /*if (definition.type === "FunctionDeclaration") {
          } else if (definition.type === "VariableDeclarator") {
          }*/
        }
      }
      //console.log(binding.path.node);
    }
  }
};


module.exports = function (babel) {
  return {
    visitor: visitor
  };
};
