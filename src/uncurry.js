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
      // TODO loc ?
      binding.scope.push({
        kind: "const",
        id: temp,
        init: {
          type: "FunctionExpression",
          id: null,
          params: flattened,
          body: $util.cloneDeep(x.body),
          loc: top.loc
        },
        unique: true
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

      path.get("body").visit();
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


function pushAll(path, statements, flattened, a) {
  a.forEach(function (x) {
    // TODO use assumePureVars ?
    if ($util.isPure(x, false)) {
      flattened.push(x);

    } else {
      // TODO guarantee that collisions cannot occur ?
      var temp = $util.setLoc(path.scope.generateUidIdentifier(), x);

      flattened.push(temp);

      statements.push($util.setLoc({
        type: "VariableDeclaration",
        kind: "var",
        declarations: [
          $util.setLoc({
            type: "VariableDeclarator",
            id: temp,
            init: x
          }, temp)
        ]
      }, temp));
    }
  });
}


module.exports = function (babel) {
  return {
    pre: function () {
      this.uncurriedSaturated = 0;
      this.uncurriedUnsaturated = 0;
      this.cantUncurry = 0;
      this.regular = 0;
    },
    post: function () {
      if (this.opts.debug) {
        // TODO does this go to stdout or stderr ?
        console.info("");
        console.info("* Uncurrying statistics");
        console.info(" * Curried function calls (saturated): " + this.uncurriedSaturated);
        console.info(" * Curried function calls (unsaturated): " + this.uncurriedUnsaturated);
        console.info(" * Curried function calls (can't uncurry): " + this.cantUncurry);
        console.info(" * Regular function calls: " + this.regular);
      }
    },
    visitor: {
      // TODO what about NewExpression ?
      CallExpression: {
        exit: function (path, state) {
          var node = path.node;

          console.assert(path.parentPath.node === path.parent);

          if (path.parent.type !== "CallExpression" ||
              path.parent.callee !== node) {
            var args = [];

            while (node.type === "CallExpression") {
              args.push(node.arguments);
              node = node.callee;
            }

            var uncurried = getUncurriedCall(path, node);

            if (uncurried != null) {
              args.reverse();

              var flattened = [];

              var statements = [];

              var body = {
                type: "CallExpression",
                callee: uncurried.uid,
                arguments: flattened
              };

              if (args.length >= uncurried.params.length) {
                for (var i = uncurried.params.length - 1; i >= 0; --i) {
                  if (uncurried.params[i].length !== args[i].length) {
                    ++state.cantUncurry;
                    return;
                  }

                  $util.pushAll(flattened, args[i]);
                }

                for (var i = uncurried.params.length; i < args.length; ++i) {
                  body = {
                    type: "CallExpression",
                    callee: body,
                    arguments: args[i]
                  };
                }

                ++state.uncurriedSaturated;

              } else {
                // TODO remove this later
                var created = false;

                for (var i = uncurried.params.length - 1; i >= args.length; --i) {
                  var params = uncurried.params[i].map(function(node){
                    if (node.type === "Identifier"){
                      var uid = path.scope.generateUidIdentifier(node.name);
                      return Object.assign({}, node, {name: uid.name});
                    } else {
                      return node;
                    }
                  });

                  pushAll(path, statements, flattened, params);

                  body = {
                    type: "FunctionExpression",
                    id: null,
                    // TODO make a copy of the params ?
                    params: params,
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
                  if (uncurried.params[i].length !== args[i].length) {
                    ++state.cantUncurry;
                    return;
                  }

                  pushAll(path, statements, flattened, args[i]);
                }

                ++state.uncurriedUnsaturated;
              }

              flattened.reverse();

              if (statements.length === 0) {
                path.replaceWith(body);

              } else {
                // TODO is this correct ?
                statements.push($util.expressionStatement(body));
                path.replaceWithMultiple(statements);
              }

            } else {
              if (args.length > 1) {
                // Curried functions always take a single argument
                if (args[0].length === 1 &&
                    args[1].length === 1) {
                  ++state.cantUncurry;

                } else {
                  ++state.regular;
                }

              } else {
                ++state.regular;
              }
            }
          }
        }
      }
    }
  };
};
