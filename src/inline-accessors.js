"use strict";

module.exports = function inlineAccessors(babel){
  return {
    pre: function(){
      this.accessorsInlined = 0;
    },
    post: function(){
      if (this.opts.debug) {
        console.info("");
        console.info("* Accessor inlining statistics");
        console.info(" * Accessors inlined: " + this.accessorsInlined);
      }
    },
    visitor: {
      CallExpression: {
        exit: function (path, state){
          const propertyName = getPropertyFromPropertyAccessor(path.node.callee);
          if (!propertyName){return; }

          // debugger;
          path.replaceWith({
            type: "MemberExpression",
            computed: false,
            property: {type: "Identifier", name: propertyName},
            object: path.node.arguments[0]
          });
          this.accessorsInlined++;
        }
      }
    }
  };
};

// Returns the name of the property being accessed if the callee of a CallExpression
// does nothing more than access a property. If it's not such a "PropertyAccessor"
// function, we return null
function getPropertyFromPropertyAccessor(callee){
  const isPropertyAccessor =
        callee.type === "FunctionExpression" &&
        callee.body.type === "BlockStatement" &&
        callee.body.body.length === 1 &&
        callee.body.body[0].type === "ReturnStatement" &&
        callee.body.body[0].argument.type === "MemberExpression";
  return isPropertyAccessor ?
    callee.body.body[0].argument.property.name :
    null;
}
