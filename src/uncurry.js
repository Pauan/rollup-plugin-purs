"use strict";

var $util = require("./util");


function makeUncurried(binding, path, id, top) {
  console.assert(path.node === top);

  // Only decurry 1-argument functions
  if (binding.constant && top.params.length === 1) {
    var params = [top.params];

    var x = top;

    while (x.body.body.length === 1 &&
           x.body.body[0].type === "ReturnStatement" &&
           x.body.body[0].argument !== null &&
           x.body.body[0].argument.type === "FunctionExpression" &&
           // Only decurry 1-argument functions
           x.body.body[0].argument.params.length === 1) {
      x = x.body.body[0].argument;
      params.push(x.params);
    }

    if (x !== top) {
      var flattened = $util.flatten(params);

      // TODO guarantee that collisions cannot occur ?
      var temp = binding.scope.generateUidIdentifier(id.name + "_uncurried");

      // TODO is this correct ?
      temp.loc = id.loc;

      // TODO use a Symbol ?
      binding.rollup_plugin_purs_uncurried = {
        id: id,
        uid: temp,
        params: params,
        flattened: flattened
      };

      // TODO is this correct ?
      // TODO maybe this should set unique to true ?
      // TODO loc ?
      binding.scope.push({
        kind: "const",
        id: temp,
        init: {
          type: "FunctionExpression",
          id: null,
          params: flattened,
          body: x.body,
          loc: top.loc
        }
      });

      x.body = {
        type: "BlockStatement",
        body: [{
          type: "ReturnStatement",
          argument: {
            type: "CallExpression",
            callee: temp,
            arguments: flattened,
            // TODO is this loc correct ?
            loc: x.body.loc
          },
          // TODO is this loc correct ?
          loc: x.body.loc
        }],
        directives: [],
        // TODO is this loc correct ?
        loc: x.body.loc
      };

      path.visit();
    }
  }
}


function getUncurriedCall(path, node) {
  if (node.type === "Identifier") {
    var binding = path.scope.getBinding(node.name);

    if (binding != null) {
      // TODO use a Symbol ?
      if (binding.rollup_plugin_purs_uncurried == null) {
        binding.rollup_plugin_purs_uncurried = false;

        $util.withFunctionDefinition(binding, makeUncurried);
      }

      if (binding.rollup_plugin_purs_uncurried !== false) {
        // TODO use a Symbol ?
        return binding.rollup_plugin_purs_uncurried;
      }
    }
  }

  return null;
}


module.exports = function (babel) {
  return {
    pre: function () {
      this.uncurriedSaturated = 0;
      this.uncurriedUnsaturated = 0;
      this.regular = 0;
      this.curried = 0;
    },
    post: function () {
      if (this.opts.debug) {
        // TODO does this go to stdout or stderr ?
        console.info("");
        console.info("* Debug uncurrying");
        console.info(" * Curried function calls (saturated): " + this.uncurriedSaturated);
        console.info(" * Curried function calls (synthesized): " + this.uncurriedUnsaturated);
        console.info(" * Curried function calls (unoptimized): " + this.curried);
        console.info(" * Regular function calls: " + this.regular);
      }
    },
    visitor: {
      // TODO what about NewExpression ?
      CallExpression: function (path, state) {
        var node = path.node;

        var args = [];

        while (node.type === "CallExpression") {
          args.push(node.arguments);
          node = node.callee;
        }

        var uncurried = getUncurriedCall(path, node);

        if (uncurried != null) {
          args.reverse();

          var flattened = [];

          var body = {
            type: "CallExpression",
            callee: uncurried.uid,
            arguments: flattened
          };

          if (args.length >= uncurried.params.length) {
            ++state.uncurriedSaturated;

            for (var i = uncurried.params.length - 1; i >= 0; --i) {
              $util.pushAll(flattened, args[i]);
            }

            for (var i = uncurried.params.length; i < args.length; ++i) {
              body = {
                type: "CallExpression",
                callee: body,
                arguments: args[i]
              };
            }

          } else {
            ++state.uncurriedUnsaturated;

            // TODO remove this later
            var created = false;

            for (var i = uncurried.params.length - 1; i >= args.length; --i) {
              // TODO make a copy of the params ?
              $util.pushAll(flattened, uncurried.params[i]);

              body = {
                type: "FunctionExpression",
                id: null,
                // TODO make a copy of the params ?
                params: uncurried.params[i],
                body: {
                  type: "BlockStatement",
                  body: [{
                    type: "ReturnStatement",
                    argument: body
                  }],
                  directives: []
                }
              };

              created = true;
            }

            console.assert(created === true);

            for (var i = args.length - 1; i >= 0; --i) {
              $util.pushAll(flattened, args[i]);
            }
          }

          flattened.reverse();

          path.replaceWith(body);

        } else {
          var curried = 0;

          for (var i = 0; i < args.length; ++i) {
            // Curried functions always take a single argument
            if (args[i].length === 1) {
              ++curried;

            } else {
              break;
            }
          }

          // TODO is this check correct ?
          if (args.length > 1 && curried > 0) {
            ++state.curried;

          } else {
            ++state.regular;
          }
        }
      }
    }
  };
};
