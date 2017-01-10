var $recast = require("recast");
var $util = require("./util");


function makeUncurried(path, id, top, body) {
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
      var temp = path.scope.declareTemporary(id.name + "__private_do_not_use_uncurried__" + flattened.length + "__");

      // TODO is this correct ?
      temp.loc = id.loc;

      // TODO hacky
      // TODO use path.scope.lookup ?
      if (path.scope.curried == null) {
        path.scope.curried = {};
      }

      path.scope.curried[id.name] = {
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


function getCurriedCall(path, top) {
  var args = [];

  var x = top;

  while (x.type === "CallExpression") {
    args.push(x.arguments);
    x = x.callee;
  }

  args.reverse();

  if (x.type === "Identifier") {
    var scope = path.scope.lookup(x.name);

    if (scope != null &&
        scope.curried != null &&
        $util.hasKey(scope.curried, x.name)) {
      var curried = scope.curried[x.name];

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


module.exports = function (options, ast) {
  function optimizeUncurry(path) {
    var node = path.node;

    var body = [];

    node.body.forEach(function (x) {
      if (x.type === "FunctionDeclaration") {
        if (options.uncurry) {
          makeUncurried(path, x.id, x, body);
        }

      } else if (x.type === "VariableDeclaration") {
        x.declarations.forEach(function (x) {
          if (x.init !== null && x.init.type === "FunctionExpression") {
            if (options.uncurry) {
              makeUncurried(path, x.id, x.init, body);
            }
          }
        });
      }

      body.push(x);
    });

    node.body = body;

    this.traverse(path);
  }

  $recast.types.visit(ast, {
    visitProgram: optimizeUncurry,
    visitBlockStatement: optimizeUncurry,

    visitCallExpression: function (path) {
      var node = path.node;

      if (options.uncurry) {
        var uncurried = getCurriedCall(path, node);

        if (uncurried !== null) {
          path.replace(uncurried);
        }
      }

      this.traverse(path);
    }
  });
};
