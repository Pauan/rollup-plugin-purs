var purs = require("../dist/index.js");

export default {
  input: "Main.purs",
  output: {
    file: "bundle.js",
    format: "iife",
    sourcemap: true
  },
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
