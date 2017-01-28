"use strict";

var $util = require("./util");


var inlineVisitor = {
  // TODO handle NewExpression as well ?
  CallExpression: function (path, state) {
    var node = path.node;

    if (node.callee.type === "Identifier") {
      var binding = path.scope.getBinding(node.callee.name);

      if (binding != null) {
        // TODO handle aliasing
        if (state.seen.indexOf(binding) === -1) {
          state.seen.push(binding);

          // TODO a bit hacky
          $util.withFunctionDefinition(binding, function (binding, path, id, node) {
            // TODO make this faster ?
            path.get("body").traverse(inlineVisitor, state);
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


function makeInlined(binding, path, id, top) {
  var body = top.body.body;

  if (body.length === 1 &&
      body[0].type === "ReturnStatement") {

    // Only inline if each argument is used at most once
    // TODO we can lift this restriction later, with better IIFE inlining techniques
    /*var seenOnce = top.params.every(function (x) {
      if (x.type === "Identifier") {
        var binding = path.scope.getBinding(x.name);

        console.assert(binding != null);

        return binding.constant && binding.references <= 1;

      } else {
        return false;
      }
    });*/

    var state = {
      function: false,
      recursive: false,
      seen: [binding] // TODO should this start with the binding or not ?
    };

    path.get("body").traverse(inlineVisitor, state);

    if (!state.function && !state.recursive) {
      binding.rollup_plugin_purs_inlined = {
        name: id,
        params: top.params,
        body: top.body,
        loc: top.loc
      };
    }
  }
}



module.exports = function (babel) {
  return {
    visitor: {
      CallExpression: {
        exit: function (path) {
          var node = path.node;

          if (node.callee.type === "Identifier") {
            var binding = path.scope.getBinding(node.callee.name);

            if (binding != null) {
              if (binding.rollup_plugin_purs_inlined == null) {
                binding.rollup_plugin_purs_inlined = false;

                $util.withFunctionDefinition(binding, makeInlined);
              }

              var inlined = binding.rollup_plugin_purs_inlined;

              if (inlined !== false) {
                node.callee = {
                  type: "FunctionExpression",
                  // TODO is this needed ?
                  //id: inlined.name,
                  params: inlined.params,
                  body: inlined.body,
                  // TODO is this correct ?
                  loc: inlined.loc
                };
              }
            }
          }
        }
      }
    }
  };
};
