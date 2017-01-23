function isObject(x) {
  return x != null && typeof x === "object";
}

function walk(node, fn) {
  function run(parent, key) {
    var value = parent[key];

    if (isObject(value)) {
      if (Array.isArray(value)) {
        var length = value.length;

        for (var i = 0; i < length; ++i) {
          run(value, i);
        }

      } else if (value.type != null) {
        parent[key] = fn(value, traverse);
      }
    }
  }

  function traverse(node) {
    // TODO is this necessary ?
    var keys = Object.keys(node);

    var length = keys.length;

    for (let i = 0; i < length; ++i) {
      run(node, keys[i]);
    }
  }

  return fn(node, traverse);
}

exports.raw = walk;

exports.scope = function (ast, scope, fn) {
  return walk(ast, function (node, traverse) {
    if (node.scope != null) {
      scope = node.scope;
    }

    try {
      return fn(node, scope, traverse);

    } finally {
      // TODO is this correct ?
      if (node.scope != null) {
        scope = scope.parent;
      }
    }
  });
};
