var $walk = require("./walk");
var $util = require("./util");
var $isReference = require("is-reference");


// TODO maybe use walk instead ?
/*function isPure(x) {
  return (x === null) ||
         (x.type === "Program" && x.body.body(isPure)) ||
         (x.type === "EmptyStatement") ||
         (x.type === "BlockStatement" && x.body.every(isPure)) ||
         (x.type === "ExpressionStatement" && isPure(x.expression)) ||
         (x.type === "IfStatement" && isPure(x.test) && isPure(x.consequent) && isPure(x.alternate)) ||
         (x.type === "LabeledStatement" && isPure(x.body)) ||
         // TODO should this be considered pure ?
         (x.type === "BreakStatement") ||
         // TODO should this be considered pure ?
         (x.type === "ContinueStatement") ||
         // TODO should this be considered pure ?
         (x.type === "WithStatement" && isPure(x.object) && isPure(x.body)) ||
         (x.type === "SwitchStatement" && isPure(x.discriminant) && x.cases.every(isPure)) ||
         // TODO should this be considered pure ?
         (x.type === "ReturnStatement" && isPure(x.argument)) ||
         // TODO should this be considered pure ?
         (x.type === "ThrowStatement" && isPure(x.argument)) ||
         // TODO what about non-standard extensions ?
         (x.type === "TryStatement" && isPure(x.block) && isPure(x.handler) && isPure(x.finalizer)) ||
         // TODO what about non-standard extensions ?
         // TODO what about patterns ?
         (x.type === "CatchClause" && isPure(x.body)) ||
         (x.type === "WhileStatement" &&
         ;
}*/


// TODO what about MemberExpression ?
// TODO DoExpression
// TODO BindExpression
// TODO MetaProperty
// TODO DirectiveLiteral
// TODO SpreadProperty
// TODO GeneratorExpression
// TODO ComprehensionExpression
// TODO TaggedTemplateExpression
// TODO TemplateLiteral
// TODO what about AwaitExpression ?
// TODO TypeCastExpression
// TODO JSXMemberExpression
// TODO JSXExpressionContainer
// TODO JSXElement
// TODO JSXEmptyExpression
// TODO JSXText
// TODO check for other expressions
function isPureExpression(x) {
  return (x === null) ||
         (x.type === "FunctionExpression") ||
         (x.type === "ThisExpression") ||
         (x.type === "ArrayExpression" && x.elements.every(isPureExpression)) ||
         (x.type === "ObjectExpression" && x.properties.every(isPureExpression)) ||
         (x.type === "Property" && isPureExpression(x.key) && isPureExpression(x.value)) ||
         (x.type === "SequenceExpression" && x.expressions.every(isPureExpression)) ||
         (x.type === "UnaryExpression" && x.operator !== "delete" && isPureExpression(x.argument)) ||
         (x.type === "BinaryExpression" && isPureExpression(x.left) && isPureExpression(x.right)) ||
         (x.type === "LogicalExpression" && isPureExpression(x.left) && isPureExpression(x.right)) ||
         (x.type === "ConditionalExpression" &&
          isPureExpression(x.test) &&
          isPureExpression(x.consequent) &&
          isPureExpression(x.alternate)) ||
         (x.type === "Identifier") ||
         (x.type === "Literal") ||
         // TODO is this an expression ?
         (x.type === "Noop") ||
         // TODO is this correct ?
         (x.type === "Super") ||
         (x.type === "ParenthesizedExpression" && isPureExpression(x.expression)) ||
         (x.type === "ObjectMethod") ||
         // TODO is this correct ?
         (x.type === "ObjectProperty" && isPureExpression(x.key) && isPureExpression(x.value)) ||
         (x.type === "ArrowFunctionExpression") ||
         (x.type === "SpreadElement" && isPureExpression(x.argument)) ||
         (x.type === "ClassExpression" && isPureExpression(x.superClass) && x.implements.every(isPureExpression)) ||
         (x.type === "ClassImplements" && isPureExpression(x.superClass)) ||
         (x.type === "SpreadProperty" && isPureExpression(x.argument));
}


function isSimple(x) {
  if (x.type === "Identifier" ||
      // TODO What about regexps ?
      x.type === "Literal") {
    return x;

  } else if (x.type === "SequenceExpression") {
    if (x.expressions.length > 0) {
      var last = x.expressions[x.expressions.length - 1];

      // TODO make this more efficient ?
      // TODO only require purity for all but the last element
      // TODO even if the expressions aren't pure, we can still return the last element
      if (x.expressions.every(isPureExpression) && isSimple(last)) {
        return last;

      } else {
        return null;
      }

    } else {
      return x;
    }

  } else {
    return null;
  }
}


function findReferences(ast, scope) {
  return $walk.scope(ast, scope, function (parent, node, scope, traverse) {
    if (node.type === "VariableDeclaration") {
      var declarations = [];

      node.declarations.forEach(function (x) {
        if (x.id.type === "Identifier" &&
            x.init !== null) {
          var replace = isSimple(x.init);

          if (replace !== null &&
              // Don't propagate it if the new name is the same as the old name
              !(replace.type === "Identifier" &&
                replace.name === x.id.name)) {
            if (scope.propagating == null) {
              scope.propagating = {};
            }

            scope.propagating[x.id.name] = replace;

          } else {
            declarations.push(x);
          }

        } else {
          declarations.push(x);
        }
      });

      if (declarations.length === 0) {
        return {
          type: "EmptyStatement",
          loc: node.loc
        };

      } else {
        node.declarations = declarations;
      }
    }

    traverse(node);
    return node;
  });
}


function replaceReferences(ast, scope) {
  var _this = this;

  return $walk.scope(ast, scope, function (parent, node, scope, traverse) {
    var newNode = node;

    var originalScope = null;

    for (;;) {
      // TODO is the $isReference needed ?
      if (newNode.type === "Identifier" && $isReference(newNode, parent)) {
        var def = $util.lookup(scope, newNode.name);

        if (def != null &&
            def.propagating != null &&
            $util.hasKey(def.propagating, newNode.name)) {
          originalScope = def;
          newNode = def.propagating[newNode.name];

        } else {
          break;
        }

      } else {
        break;
      }
    }

    // TODO does this need to use $isReference ?
    if (newNode !== node &&
        newNode.type === "Identifier" &&
        // TODO is this correct ?
        originalScope !== $util.lookup(scope, newNode.name)) {
      // TODO loc
      // TODO replace with _this.warn (https://github.com/rollup/rollup/issues/1282)
      console.warn("Could not replace " + node.name + " with " + newNode.name);

      newNode = node;
    }

    traverse(newNode);
    return newNode;
  });
}


module.exports = function (ast, scope) {
  return replaceReferences.call(this, findReferences.call(this, ast, scope), scope);
};
