"use strict";

var $util = require("./util");


// TODO BindExpression ?
// TODO handle ConditionalExpression ?
// TODO handle LogicalExpression ?
module.exports = function (babel) {
  function liftToBlock(path) {
    if (!babel.types.isStatement(path.parent)) {
      var node = path.node;

      // TODO guarantee that collisions cannot occur ?
      // TODO loc ?
      var temp = path.scope.generateUidIdentifier();

      console.log(node.type);

      //path.insertBefore([]);

/*
      // TODO loc ?
      path.scope.push({
        id: temp,
        init: node,
        kind: "const"
      });*/

      path.replaceWithMultiple([
        {
          type: "VariableDeclaration",
          kind: "var",
          declarations: [{
            type: "VariableDeclarator",
            id: temp,
            init: node,
            start: node.start,
            end: node.end,
            loc: node.loc
          }],
          start: node.start,
          end: node.end,
          loc: node.loc
        },

        {
          type: "ExpressionStatement",
          expression: temp,
          start: temp.start,
          end: temp.end,
          loc: temp.loc
        }
      ]);

      path.skip();
    }
  }

  /*function withBlock(obj) {
    return {
      enter: function (path, state) {
        state.blocks.push([]);
      },
      exit: obj.exit
    };
  }*/

  function blockStatement(node) {
    if (node.type === "BlockStatement") {
      return node;

    } else {
      return {
        type: "BlockStatement",
        body: [node],
        directives: [],
        start: node.start,
        end: node.end,
        loc: node.loc
      };
    }
  }

  function blockStatementBody(path) {
    path.node.body = blockStatement(path.node.body);
  }

  return {
    /*pre: function () {
      this.blocks = [];
    },*/
    visitor: {
      /*Program: withBlock({
        exit: function (path, state) {
          path.node.body = state.blocks.pop();
        }
      }),

      BlockStatement: withBlock({
        exit: function (path, state) {
          path.node.body = state.blocks.pop();
        }
      }),

      SwitchCase: withBlock({
        exit: function (path, state) {
          path.node.consequent = state.blocks.pop();
        }
      }),

      // TODO test this
      ClassBody: withBlock({
        exit: function (path, state) {
          path.node.body = state.blocks.pop();
        }
      }),*/

      // TODO test this
      LabeledStatement: blockStatementBody,
      WhileStatement: blockStatementBody,
      DoWhileStatement: blockStatementBody,
      ForStatement: blockStatementBody,
      ForInStatement: blockStatementBody,
      ForOfStatement: blockStatementBody,

      IfStatement: function (path) {
        var node = path.node;

        node.consequent = blockStatement(node.consequent);

        if (node.alternate != null) {
          node.alternate = blockStatement(node.alternate);
        }
      },

      /*Statement: function (path, state) {
        console.assert(state.blocks.length > 0);

        state.blocks[state.blocks.length - 1].push(path.node);
      },*/

      // TODO is this necessary ?
      YieldExpression: liftToBlock,
      // TODO is this necessary ?
      AwaitExpression: liftToBlock,
      UpdateExpression: liftToBlock,
      AssignmentExpression: liftToBlock,
      CallExpression: liftToBlock,
      NewExpression: liftToBlock,

      UnaryExpression: function (path) {
        if (path.node.operator === "delete") {
          liftToBlock(path);
        }
      }
    }
  };
};
