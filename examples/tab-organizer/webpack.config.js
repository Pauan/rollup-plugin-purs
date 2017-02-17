var webpack = require("webpack");
var path = require("path");


module.exports = {
  entry: {
    "webpack": path.join(__dirname, "Main.js")
  },

  output: {
    path: path.join(__dirname, "dist", "js"),
    filename: "[name].js"
  },

  module: {
    loaders: [
      {
        test: /\.(?:js|purs)$/,
        exclude: /node_modules/,
        loader: "./purs-loader.js"
      }
    ]
  }
};
