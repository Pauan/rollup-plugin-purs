"use strict";

var $isReference = require("is-reference");


function isFunctionExpression(node) {
  return node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";
}

exports.isFunctionExpression = isFunctionExpression;


function isFunction(node) {
  return node.type === "FunctionDeclaration" || isFunctionExpression(node);
}

exports.isFunction = isFunction;


function isReference(parent, node) {
  return $isReference(node, parent);
}

exports.isReference = isReference;
