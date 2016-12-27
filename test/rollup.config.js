var purs = require("../index.js");
var resolve = require("rollup-plugin-node-resolve");

export default {
  entry: "Main.purs",
  dest: "bundle.js",
  format: "es",
  sourceMap: true,
  treeshake: true,
  plugins: [
    purs({
      outputDir: "../output"
    }),
    resolve()
  ]
};
