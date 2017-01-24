var $walk = require("./walk");
var $util = require("./util");


function makeUncurried(scope, id, top, body) {
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
      var temp = {
        type: "Identifier",
        name: $util.makeTemporary(scope, id.name + "_uncurried"),
        // TODO is this correct ?
        loc: id.loc
      };

      // TODO hacky
      // TODO use $util.lookup ?
      if (scope.curried == null) {
        scope.curried = {};
      }

      scope.curried[id.name] = {
        params: params,
        identifier: temp
      };

      body.push({
        type: "VariableDeclaration",
        kind: "var",
        declarations: [{
          type: "VariableDeclarator",
          id: temp,
          init: {
            type: "FunctionExpression",
            id: null,
            params: flattened,
            body: x.body,
            loc: top.loc
          },
          loc: top.loc
        }],
        loc: top.loc
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
        // TODO is this loc correct ?
        loc: x.body.loc
      };
    }
  }
}


function getCurriedCall(top, scope) {
  var args = [];

  var x = top;

  while (x.type === "CallExpression") {
    args.push(x.arguments);
    x = x.callee;
  }

  args.reverse();

  if (x.type === "Identifier") {
    var def = $util.lookup(scope, x.name);

    if (def != null &&
        def.curried != null &&
        $util.hasKey(def.curried, x.name)) {
      var curried = def.curried[x.name];

      if (isArgumentsSaturated(curried.params, args)) {
        return {
          type: "CallExpression",
          callee: curried.identifier,
          // TODO better flatten function
          arguments: [].concat.apply([], args),
          // TODO is this loc correct ?
          loc: top.loc
        };
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


function findUncurried(ast, scope) {
  return $walk.scope(ast, scope, function (parent, node, scope, traverse) {
    if (node.type === "Program" || node.type === "BlockStatement") {
      var body = [];

      node.body.forEach(function (x) {
        if (x.type === "FunctionDeclaration") {
          makeUncurried(scope, x.id, x, body);

        } else if (x.type === "VariableDeclaration") {
          x.declarations.forEach(function (x) {
            if (x.init !== null && x.init.type === "FunctionExpression") {
              makeUncurried(scope, x.id, x.init, body);
            }
          });
        }

        body.push(x);
      });

      node.body = body;
    }

    traverse(node);

    return node;
  });
}


function uncurryCalls(ast, scope) {
  return $walk.scope(ast, scope, function (parent, node, scope, traverse) {
    var uncurried = getCurriedCall(node, scope);

    if (uncurried !== null) {
      node = uncurried;
    }

    traverse(node);

    return node;
  });
}


module.exports = function (ast, scope) {
  return uncurryCalls(findUncurried(ast, scope), scope);
};
