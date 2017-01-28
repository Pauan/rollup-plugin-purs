"use strict";


module.exports = function (babel) {
  return {
    visitor: {
      ReferencedIdentifier: function (path) {
        var node = path.node;

        var binding = path.scope.getBinding(node.name);

        if (binding != null && !binding.rollup_plugin_purs_renamed) {
          binding.rollup_plugin_purs_renamed = true;

          // TODO is this correct ?
          if (!binding.scope.hasUid(node.name)) {
            // TODO guarantee that collisions cannot occur ?
            var temp = binding.scope.generateUidIdentifier(node.name);

            // TODO is this correct ?
            temp.loc = node.loc;

            binding.scope.rename(node.name, temp.name);

            console.assert(binding.scope.getBinding(temp.name) === binding);
          }
        }
      }
    }
  };
};
