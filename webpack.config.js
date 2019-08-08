const path = require("path");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");

const dist = path.resolve(__dirname, "dist");

module.exports = {
  mode: "production",
  target: "node",
  entry: {
    "index": "./js/index.js",
    "convert-commonjs": "./js/convert-commonjs.js"
  },
  output: {
    path: dist,
    filename: "[name].js",
    libraryTarget: "commonjs2",
    libraryExport: "default"
  },
  plugins: [
    new WasmPackPlugin({
      crateDirectory: __dirname,
      extraArgs: "--out-name index"
    }),
  ]
};
