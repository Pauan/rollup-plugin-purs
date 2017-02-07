"use strict";

var $util = require("./util");
var $scope = require("./scope");
var $traverseFunction = require("./function");
var $walk = require("./walk");
var $match = require("./match");


function liftToBlock(state, node) {
  var binding = $scope.defineUnique(state, "block");

  // TODO loc
  state.block.push(variableDeclaration("const", binding.identifier, node, node));

  // TODO loc
  return binding.identifier;
}


function $traverseExpression(parent, node, state, lift) {
  if ($match.isFunctionExpression(node)) {
    $traverseFunction(parent, node, state, node.id);
    return node;

  } else if (node.type === "Identifier") {
    if ($match.isReference(parent, node)) {
      var binding = $scope.lookupVar(state, node.name);

      if (binding == null) {
        $scope.markGlobal(state, node.name);

      } else {
        binding.uses.push(node);
      }
    }

    return node;

  } else if (node.type === "Literal" || node.type === "ThisExpression") {
    return node;

  // TODO what about `this` with arrow functions vs regular functions ?
  } else if (node.type === "CallExpression" && $match.isFunctionExpression(node.callee)) {
    return optimizeIIFE(parent, node, state);

  } else if (lift) {
    if ((node.type === "UpdateExpression") ||
        (node.type === "UnaryExpression" && node.operator === "delete")) {
      node.argument = $traverseExpression(node, node.argument, state, true);

      return liftToBlock(state, node);

    } else if (node.type === "AssignmentExpression") {
      // TODO what about patterns ?
      // TODO should left be before right ?
      node.left = $traverseExpression(node, node.left, state, true);
      node.right = $traverseExpression(node, node.right, state, true);

      return liftToBlock(state, node);

    // TODO this is a little bit strict...
    /*} else if (node.type === "MemberExpression") {
      node.object = $traverseExpression(node, node.object, state, true);
      node.property = $traverseExpression(node, node.property, state, true);

      return liftToBlock(state, node);*/

    } else if (node.type === "CallExpression" || node.type === "NewExpression") {
      node.callee = $traverseExpression(node, node.callee, state, true);

      node.arguments = node.arguments.map(function (x) {
        return $traverseExpression(node, x, state, true);
      });

      return liftToBlock(state, node);
    }
  }

  $walk(node, state, function (parent, node, state) {
    // TODO should this use true or false ?
    return $traverseExpression(parent, node, state, true);
  });

  return node;
}

module.exports = $traverseExpression;
