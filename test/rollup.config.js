var purs = require("../index.js");

export default {
  entry: "Main.purs",
  dest: "bundle.js",
  format: "iife",
  sourceMap: true,
  plugins: [
    purs({
      debug: true,
      optimizations: {
        inline: true,
        uncurry: true
      }
    })
  ]
};
