"use strict";


module.exports = function (babel) {
  return {
    visitor: {
      // TODO make this faster ?
      BindingIdentifier: function (path) {
        var binding = path.scope.getBinding(path.node.name);

        if (binding != null) {
          if (!binding.referenced) {
            // TODO is this correct ?
            binding.scope.removeOwnBinding(path.node.name);
            binding.path.remove();
          }
        }
      }
    }
  };
};
