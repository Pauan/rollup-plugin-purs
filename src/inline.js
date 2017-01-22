var $recast = require("recast");
var $util = require("./util");


function makeInlined(path, id, top, body) {
  var body = top.body.body;

  if (body.length === 1 &&
      body[0].type === "ReturnStatement" &&
      // Don't inline curried functions
      body[0].argument.type !== "FunctionExpression" &&
      top.params.every(function (x) { return x.type === "Identifier"; })) {

    var seen = {};

    top.params.forEach(function (x) {
      seen[x.name] = 0;
    });

    $recast.types.visit(body[0].argument, {
      visitIdentifier: function (path) {
        var node = path.node;

        if ($util.hasKey(seen, node.name)) {
          ++seen[node.name];
        }

        this.traverse(path);
      }
    });

    if (top.params.every(function (x) { return seen[x.name] <= 1; })) {
      var indexes = {};

      top.params.forEach(function (x, i) {
        indexes[x.name] = i;
      });

      // TODO hacky
      // TODO use path.scope.lookup ?
      if (path.scope.inlined == null) {
        path.scope.inlined = {};
      }

      path.scope.inlined[id.name] = {
        params: top.params,
        indexes: indexes,
        expression: body[0].argument
      };
    }
  }
}

function getInlinedCall(path, top) {
  if (top.callee.type === "Identifier") {
    var name = top.callee.name;

    var scope = path.scope.lookup(name);

    if (scope != null &&
        scope.inlined != null &&
        $util.hasKey(scope.inlined, name)) {
      var inlined = scope.inlined[name];

      if (top.arguments.length === inlined.params.length) {
        // TODO better deep copy function
        var copy = JSON.parse(JSON.stringify(inlined.expression, function (key, value) {
          // TODO super hacky
          // TODO needed to avoid Error transforming bundle with 'purs' plugin: lines.skipSpaces is not a function
          if (key !== "lines") {
            return value;
          }
        }));

        $recast.types.visit(copy, {
          visitIdentifier: function (path) {
            var node = path.node;

            if ($util.hasKey(inlined.indexes, node.name)) {
              var indexes = inlined.indexes[node.name];
              // TODO adjust the loc ?
              path.replace(top.arguments[indexes]);
            }

            this.traverse(path);
          }
        });

        // TODO adjust the loc ?
        return copy;
      }
    }
  }

  return null;
}


module.exports = function (options, ast) {
  function optimizeInline(path) {
    var node = path.node;

    var body = [];

    node.body.forEach(function (x) {
      if (x.type === "FunctionDeclaration") {
        if (options.inline) {
          makeInlined(path, x.id, x, body);
        }

      } else if (x.type === "VariableDeclaration") {
        x.declarations.forEach(function (x) {
          if (x.init !== null && x.init.type === "FunctionExpression") {
            if (options.inline) {
              makeInlined(path, x.id, x.init, body);
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
    visitProgram: optimizeInline,
    visitBlockStatement: optimizeInline,

    visitCallExpression: function (path) {
      var node = path.node;

      if (options.inline) {
        var inlined = getInlinedCall(path, node);

        if (inlined !== null) {
          path.replace(inlined);
        }
      }

      this.traverse(path);
    }
  });
};
