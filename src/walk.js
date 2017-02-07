"use strict";


function isObject(x) {
  return x != null && typeof x === "object";
}

function walkArray(array, node, state, fn) {
  var length = array.length;

  for (var i = 0; i < length; ++i) {
    var value = array[i];

    // TODO is this correct ?
    if (value != null) {
      console.assert(typeof value.type === "string");

      array[i] = fn(node, value, state);
    }
  }
}

function walk(node, state, fn) {
  console.assert(typeof node.type === "string");

  // TODO is this necessary ?
  var keys = Object.keys(node);

  var length = keys.length;

  for (let i = 0; i < length; ++i) {
    var key = keys[i];
    var value = node[key];

    if (isObject(value)) {
      if (Array.isArray(value)) {
        walkArray(value, node, state, fn);

      } else if (typeof value.type === "string") {
        node[key] = fn(node, value, state);
      }
    }
  }
}

module.exports = walk;
