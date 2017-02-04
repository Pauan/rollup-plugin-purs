var purs = require("../index.js");

export default {
  entry: "Main.purs",
  dest: "bundle.js",
  format: "iife",
  sourceMap: true,
  treeshake: true,
  plugins: [
    purs({
      inline: true,
      uncurry: true
    })
  ]
};
