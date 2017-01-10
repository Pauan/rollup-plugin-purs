var $recast = require("recast");


function makeInlined(path, id, top, body) {

}

function getInlinedCall(path, top) {
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
