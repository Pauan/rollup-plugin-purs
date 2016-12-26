var purs = require("../index.js");

export default {
  entry: "test/Main.purs",
  dest: "bundle.js",
  format: "es",
  plugins: [
    purs({
      outputDir: "../output"
    })
  ]
};
