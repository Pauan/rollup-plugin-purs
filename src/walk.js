function isObject(x) {
  return x != null && typeof x === "object";
}

function walk(node, fn) {
  function run(parent, node, key) {
    var value = node[key];

    if (isObject(value)) {
      if (Array.isArray(value)) {
        var length = value.length;

        for (var i = 0; i < length; ++i) {
          run(parent, value, i);
        }

      } else if (value.type != null) {
        node[key] = fn(parent, value, traverse);
      }
    }
  }

  // TODO guarantee that the `type` property exists ?
  function traverse(node) {
    // TODO is this necessary ?
    var keys = Object.keys(node);

    var length = keys.length;

    for (let i = 0; i < length; ++i) {
      run(node, node, keys[i]);
    }
  }

  return fn(null, node, traverse);
}

exports.raw = walk;

exports.scope = function (ast, scope, fn) {
  return walk(ast, function (parent, node, traverse) {
    if (node.scope != null) {
      scope = node.scope;
    }

    try {
      return fn(parent, node, scope, traverse);

    } finally {
      // TODO is this correct ?
      if (node.scope != null) {
        scope = scope.parent;
      }
    }
  });
};
