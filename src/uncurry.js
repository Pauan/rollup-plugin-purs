"use strict";


function makeUncurried(binding, id, top) {
  // TODO use a Symbol ?
  if (binding.rollup_plugin_purs_uncurried == null) {
    binding.rollup_plugin_purs_uncurried = false;

    // Only decurry 1-argument functions
    if (top.params.length === 1) {
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
        // TODO better flatten function ?
        var flattened = [].concat.apply([], params);

        // TODO guarantee that collisions cannot occur ?
        var temp = binding.scope.generateUidIdentifier(id.name + "_uncurried");

        // TODO is this correct ?
        temp.loc = id.loc;

        // TODO use a Symbol ?
        binding.rollup_plugin_purs_uncurried = {
          id: id,
          uid: temp,
          params: params,
        };

        var body = {
          type: "VariableDeclarator",
          id: temp,
          init: {
            type: "FunctionExpression",
            id: null,
            params: flattened,
            body: x.body,
            loc: top.loc
          }
        };

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
          // TODO is this loc correct ?
          loc: x.body.loc
        };

        // TODO hacky
        if (binding.path.node.type === "VariableDeclarator") {
          binding.path.insertBefore(body);

        } else {
          binding.path.insertBefore({
            type: "VariableDeclaration",
            kind: "var",
            declarations: [body],
            loc: top.loc
          });
        }
      }
    }
  }

  if (binding.rollup_plugin_purs_uncurried !== false) {
    // TODO use a Symbol ?
    return binding.rollup_plugin_purs_uncurried;

  } else {
    return null;
  }
}


function getUncurriedCall(path, node) {
  if (node.type === "Identifier") {
    var binding = path.scope.getBinding(node.name);

    // binding.rollup_plugin_purs_uncurried
    if (binding != null) {
      var definition = binding.path.node;

      if (definition.type === "FunctionDeclaration") {
        return makeUncurried(binding, definition.id, definition);

      } else if (definition.type === "VariableDeclarator" &&
                 definition.id.type === "Identifier" &&
                 definition.init != null &&
                 definition.init.type === "FunctionExpression") {
        return makeUncurried(binding, definition.id, definition.init);
      }
    }
  }

  return null;
}


function isArgumentsSaturated(expected, actual) {
  var length = expected.length;

  if (length === actual.length) {
    for (var i = 0; i < length; ++i) {
      if (expected[i].length !== actual[i].length) {
        return false;
      }
    }

    return true;

  } else {
    return false;
  }
}


module.exports = function (babel) {
  return {
    visitor: {
      CallExpression: {
        // TODO a little hacky that it uses exit
        exit: function (path) {
          var node = path.node;

          var args = [];

          while (node.type === "CallExpression") {
            args.push(node.arguments);
            node = node.callee;
          }

          var uncurried = getUncurriedCall(path, node);

          if (uncurried != null) {
            args.reverse();

            if (isArgumentsSaturated(uncurried.params, args)) {
              path.replaceWith({
                type: "CallExpression",
                callee: uncurried.uid,
                // TODO better flatten function
                arguments: [].concat.apply([], args),
                // TODO is this loc correct ?
                loc: path.node.loc
              });
            }
          }
        }
      }
    }
  };
};
