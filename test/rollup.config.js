var purs = require("../index.js");

export default {
  entry: "test/Main.purs",
  dest: "bundle.js",
  format: "es",
  sourceMap: true,
  treeshake: true,
  plugins: [
    purs({
      outputDir: "../output"
    })
  ]
};
