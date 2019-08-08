"use strict";


exports.setLoc = function (a, b) {
  // TODO is this correct ?
  a.start = b.start;
  a.end = b.end;
  a.loc = b.loc;
  return a;
};


exports.pushAll = function (a, b) {
  var length = b.length;

  for (var i = 0; i < length; ++i) {
    a.push(b[i]);
  }
};


exports.flatten = function (a) {
  // TODO better flatten function ?
  return [].concat.apply([], a);
};


exports.hasKey = function (obj, key) {
  return {}.hasOwnProperty.call(obj, key);
};


exports.eachObject = function (obj, fn) {
  Object.keys(obj).forEach(function (key) {
    fn(key, obj[key]);
  });
};


// TODO prevent an infinite loop from occurring ?
exports.matches = function (string, re) {
  const output = [];

  for (;;) {
    const a = re.exec(string);

    if (a == null) {
      return output;

    } else {
      output.push(a.slice(1));
    }
  }
};


exports.withFunctionDefinition = function (binding, fn) {
  var definition = binding.path.node;

  if (definition.type === "FunctionDeclaration") {
    fn(binding, binding.path, definition.id, definition);

  } else if (definition.type === "VariableDeclarator" &&
             definition.id.type === "Identifier" &&
             definition.init != null &&
             definition.init.type === "FunctionExpression") {
    fn(binding, binding.path.get("init"), definition.id, definition.init);

  } else {
    // TODO loc
    // TODO better warning
    //console.warn("Unknown type: " + definition.type);
  }
};


exports.getPropertyName = function (node) {
  if (node.computed) {
    // node["foo"]
    if (node.property.type === "StringLiteral") {
      return node.property.value;
    }

  // node.foo
  } else if (node.property.type === "Identifier") {
    return node.property.name;
  }

  return null;
};


exports.expressionStatement = function (node) {
  return {
    type: "ExpressionStatement",
    expression: node,
    start: node.start,
    end: node.end,
    loc: node.loc
  };
};


exports.statements = function (body, parent) {
  if (body.length === 1) {
    return body[0];

  } else {
    return {
      type: "BlockStatement",
      body: body,
      start: parent.start,
      end: parent.end,
      loc: parent.loc
    };
  }
};


exports.print = function (node) {
  return babel.transformFromAst({
    type: "Program",
    body: [node]
  }, null, {
    babelrc: false,
    code: true,
    ast: false,
    sourceMaps: false,
    plugins: []
  }).code;
};


// https://github.com/babel/babylon/blob/master/ast/spec.md
// TODO Import ?
// TODO BindExpression ?
// TODO TemplateLiteral ?
// TODO TaggedTemplateExpression ?
// TODO ClassExpression ?
// TODO MetaProperty ?
// TODO DirectiveLiteral ?
// TODO CallExpression with IIFE ?
// TODO NewExpression with IIFE ?
// TODO WithStatement ?
// TODO TryStatement ?
// TODO CatchClause ?
// TODO WhileStatement ?
// TODO DoWhileStatement ?
// TODO ForStatement ?
// TODO ForInStatement ?
// TODO ForOfStatement ?
// TODO ObjectPattern ?
// TODO ArrayPattern ?
// TODO AssignmentPattern ?
function isPure(node, strict) {
      // TODO this is only needed for ArrayExpression
  if (node === null ||
      node.type === "Identifier" ||
      // TODO is this correct ? what about inner classes ?
      node.type === "Super" ||
      // TODO is this correct ? what about inner functions ?
      node.type === "ThisExpression" ||
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      node.type === "NullLiteral" ||
      node.type === "StringLiteral" ||
      node.type === "BooleanLiteral" ||
      node.type === "NumericLiteral" ||
      node.type === "EmptyStatement") {
    return true;

  } else if (node.type === "MemberExpression" ||
             // TODO can regexps be treated as always pure ?
             node.type === "RegExpLiteral" ||
             node.type === "DebuggerStatement") {
    return !strict;

  // TODO is this necessary ?
  } else if (node.type === "YieldExpression" ||
             // TODO is this necessary ?
             node.type === "AwaitExpression" ||
             node.type === "UpdateExpression" ||
             node.type === "AssignmentExpression" ||
             node.type === "CallExpression" ||
             node.type === "NewExpression") {
    return false;

  } else if (node.type === "ArrayExpression") {
    return node.elements.every(function (x) { return isPure(x, strict); });

  } else if (node.type === "ObjectExpression") {
    return node.properties.every(function (x) { return isPure(x, strict); });

  } else if (node.type === "ObjectProperty" ||
             node.type === "ObjectMethod") {
    return isPure(node.key, strict) &&
           isPure(node.value, strict);

  } else if (node.type === "RestElement" ||
             node.type === "SpreadElement") {
    return isPure(node.argument, strict);

  } else if (node.type === "UnaryExpression") {
    return node.operator !== "delete" &&
           isPure(node.argument, strict);

  } else if (node.type === "BinaryExpression" ||
             node.type === "LogicalExpression") {
    return isPure(node.left, strict) &&
           isPure(node.right, strict);

  } else if (node.type === "ConditionalExpression") {
    return isPure(node.test, strict) &&
           isPure(node.alternate, strict) &&
           isPure(node.consequent, strict);

  } else if (node.type === "SequenceExpression") {
    return node.expressions.every(function (x) { return isPure(x, strict); });

  } else if (node.type === "Program" ||
             node.type === "BlockStatement") {
    return node.body.every(function (x) { return isPure(x, strict); });

  } else if (node.type === "ExpressionStatement") {
    return isPure(node.expression, strict);

  // TODO is this correct ?
  } else if (node.type === "LabeledStatement") {
    return isPure(node.body, strict);

  } else if (node.type === "IfStatement") {
    return isPure(node.test, strict) &&
           isPure(node.consequent, strict) &&
           isPure(node.alternate, strict);

  } else if (node.type === "SwitchStatement") {
    return isPure(node.discriminant, strict) &&
           node.cases.every(function (x) { return isPure(x, strict); });

  } else if (node.type === "SwitchCase") {
    return isPure(node.test, strict) &&
           // TODO special case break ?
           node.consequent.every(function (x) { return isPure(x, strict); });

  // TODO throw an error instead ?
  } else {
    return false;
  }
}

exports.isPure = isPure;
