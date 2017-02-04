"use strict";


module.exports = function (babel) {
  return {
    visitor: {
      // TODO make this faster ?
      // TODO maybe this shouldn't use BindingIdentifier ?
      BindingIdentifier: function (path) {
        var node = path.node;

        var binding = path.scope.getBinding(node.name);

        // TODO is this correct ?
        // TODO use !binding.scope.hasUid(node.name) ?
        if (binding != null && !binding.rollup_plugin_purs_renamed) {
          // TODO is this necessary ?
          binding.rollup_plugin_purs_renamed = true;

          // TODO guarantee that collisions cannot occur ?
          var temp = binding.scope.generateUidIdentifier(node.name);

          // TODO is this correct ?
          temp.loc = node.loc;

          // TODO make this faster ?
          // TODO is this correct ?
          binding.scope.rename(node.name, temp.name);

          console.assert(binding.scope.getBinding(temp.name) === binding);
        }
      }
    }
  };
};
