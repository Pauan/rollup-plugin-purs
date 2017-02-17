"use strict"

/*
 * Webpack 2 loader that can take CommonJS output by psc and convert
 * it into tree shakable ES6 modules. No transpiling required.
 */
var $purs = require("rollup-plugin-purs");


var context = {
  warn: function (code) {
    console.warn("Warning: " + code);
  },
  error: function (code) {
    throw new Error(code);
  }
};


var convert = $purs({
  runMain: false
});


module.exports = function (code) {
  this.cacheable();

  var filename = this.resourcePath;

  /*

  $rollup.rollup({
    entry: { path: filename, contents: code },
    plugins: [
      $purs({
        runMain: false,
        debug: true,
        optimizations: {
          uncurry: true,
          inline: false
        }
      }),
      $memory()
    ]
  })
  .then(function (bundle) {
    const info = bundle.generate({ format: "es" });
    callback(null, info.code, info.map);
  })
  .catch(callback);*/

  var info = convert.transform.call(context, code, filename);

  if (info == null) {
    return code;

  } else {
    this.callback(null, info.code, info.map);
  }
};
