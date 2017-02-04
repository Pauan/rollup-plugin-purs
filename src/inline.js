"use strict";

var $util = require("./util");


var checkVisitor = {
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
  if (canInline(path, top)) {
    var state = {
      function: false,
      recursive: false,
      seen: [binding] // TODO should this start with the binding or not ?
    };

    path.get("body").traverse(checkVisitor, state);

    if (!state.function && !state.recursive) {
      binding.rollup_plugin_purs_inlined = {
        name: id,
        params: top.params.map(function (x) { return x.name; }),
        body: top.body,
        loc: top.loc,
        expression: top.body.body[0].argument
      };
    }
  }
}


// TODO loc
var _void = {
  type: "UnaryExpression",
  operator: "void",
  argument: {
    type: "NumericLiteral",
    value: 0
  },
  prefix: true
};


var inlineVisitor = {
  ReferencedIdentifier: function (path, state) {
    var node = path.node;

    // TODO maybe it should lookup ?
    // TODO make this faster
    var index = state.params.indexOf(node.name);

    if (index !== -1) {
      if (index < state.arguments.length) {
        path.replaceWith(state.arguments[index]);

      } else {
        path.replaceWith(_void);
      }
    }
  }
};


module.exports = function (babel) {
  return {
    visitor: {
      CallExpression: function (path) {
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
              // TODO is this copy needed ?
              // TODO better copying ?
              var copy = JSON.parse(JSON.stringify(inlined.expression));

              // TODO super hacky
              path.replaceWith({
                type: "SequenceExpression",
                expressions: [copy],
                loc: copy.loc
              });

              path.traverse(inlineVisitor, {
                params: inlined.params,
                arguments: node.arguments
              });
            }
          }
        }
      }
    }
  };
};
