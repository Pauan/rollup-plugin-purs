"use strict";

var $util = require("./util");


var checkVisitor = {
  // TODO handle NewExpression as well ?
  CallExpression: function (path, state) {
    var node = path.node;

    if (node.callee.type === "Identifier") {
      var binding = path.scope.getBinding(node.callee.name);

      // TODO check if the binding is constant ?
      if (binding != null) {
        // TODO handle aliasing
        if (state.seen.indexOf(binding) === -1) {
          state.seen.push(binding);

          // TODO a bit hacky
          $util.withFunctionDefinition(binding, function (binding, path, id, node) {
            // TODO make this faster ?
            path.get("body").traverse(checkVisitor, state);
          });

        } else {
          state.recursive = true;
          path.stop();
        }
      }
    }
  },
  Function: function (path, state) {
    state.function = true;
    path.stop();
  }
};


function canInlineFunction(path, node) {
  // Only inline if each argument is used at most once
  return node.params.every(function (x) {
    if (x.type === "Identifier") {
      var binding = path.scope.getBinding(x.name);

      console.assert(binding != null);

      return binding.constant && binding.references <= 1;

    } else {
      return false;
    }
  });
}


function canInline(path, node) {
  // TODO check node.id ?
  return node.body.body.length === 1 &&
         node.body.body[0].type === "ReturnStatement" &&
         canInlineFunction(path, node);
}


function makeInlined(binding, path, id, top) {
  if (binding.constant && canInline(path, top)) {
    var state = {
      function: false,
      recursive: false,
      seen: [binding] // TODO should this start with the binding or not ?
    };

    path.get("body").traverse(checkVisitor, state);

    if (!state.function && !state.recursive) {
      binding.rollup_plugin_purs_inlined = {
        params: top.params,
        body: top.body,
        loc: top.loc
      };
    }
  }
}


module.exports = function (babel) {
  return {
    pre: function () {
      this.inlined = 0;
      this.uninlined = 0;
      this.cantInlined = 0;
    },
    post: function () {
      if (this.opts.debug) {
        // TODO does this go to stdout or stderr ?
        console.info("");
        console.info("* Debug inlining");
        console.info(" * Function calls (inlined): " + this.inlined);
        console.info(" * Function calls (not inlined): " + this.uninlined);
        console.info(" * Function calls (can't inline): " + this.cantInlined);
      }
    },
    visitor: {
      CallExpression: function (path, state) {
        var node = path.node;

        if (node.callee.type === "Identifier") {
          var binding = path.scope.getBinding(node.callee.name);

          if (binding != null) {
            if (binding.rollup_plugin_purs_inlined == null) {
              binding.rollup_plugin_purs_inlined = false;

              $util.withFunctionDefinition(binding, makeInlined);
            }

            var inlined = binding.rollup_plugin_purs_inlined;

            // TODO what about unused arguments ?
            if (inlined !== false) {
              ++state.inlined;

              node.callee = {
                type: "FunctionExpression",
                id: null,
                // TODO should it copy this ?
                params: JSON.parse(JSON.stringify(inlined.params)),
                // TODO better copying ?
                body: JSON.parse(JSON.stringify(inlined.body)),
                loc: inlined.loc
              };

            } else {
              ++state.uninlined;
            }

          } else {
            ++state.cantInlined;
          }

        } else {
          ++state.cantInlined;
        }
      }
    }
  };
};
