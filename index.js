"use strict";

var $babel = require("babel-core");
var $utils = require("rollup-pluginutils");
var $path = require("path");
var $fs = require("fs");

var $convert = require("./src/convert");
var $uncurry = require("./src/uncurry");
var $inline = require("./src/inline");
var $rename = require("./src/rename");
var $propagate = require("./src/propagate");
var $removeSequence = require("./src/remove-sequence");
var $removeIIFE = require("./src/remove-iife");
var $typeclass = require("./src/typeclass");
var $deadCode = require("./src/dead-code");


function pursPath(options, path) {
  // TODO should this use resolve ?
  return $path.resolve($path.join(options.outputDir, path, "index.js"));
}


var entryPath = "\0rollup-plugin-purs:entry-point";


module.exports = function (options) {
  if (options == null) {
    options = {};
  }

  if (options.outputDir == null) {
    options.outputDir = "output";
  }

  if (options.runMain == null) {
    options.runMain = true;
  }

  if (options.debug == null) {
    options.debug = true;
  }

  if (options.optimizations == null) {
    options.optimizations = {};
  }

  // TODO remove this in 2.0.0
  if (options.uncurry != null) {
    console.warn("rollup-plugin-purs: uncurry option is deprecated, use optimizations.uncurry instead");
    options.optimizations.uncurry = options.uncurry;
  }

  // TODO remove this in 2.0.0
  if (options.inline != null) {
    console.warn("rollup-plugin-purs: inline option is deprecated, use optimizations.inline instead");
    options.optimizations.inline = options.inline;
  }

  if (options.optimizations.uncurry == null) {
    options.optimizations.uncurry = true;
  }

  if (options.optimizations.inline == null) {
    options.optimizations.inline = true;
  }

  if (options.optimizations.removeDeadCode == null) {
    options.optimizations.removeDeadCode = true;
  }

  if (options.optimizations.assumePureVars == null) {
    options.optimizations.assumePureVars = true;
  }

  var filter = $utils.createFilter(options.include, options.exclude);

  var entry = null;

  return {
    name: "purs",

    // TODO hacky
    options: function (rollup) {
      // We use a better treeshaking algorithm than Rollup, so we disable Rollup's treeshaking for faster speed
      // TODO set this to false later
      rollup.treeshake = true;

      if (options.runMain &&
          rollup.entry != null &&
          rollup.entry !== entryPath) {
        entry = rollup.entry;
        rollup.entry = entryPath;
      }
    },

    resolveId: function (filePath, importer) {
      // TODO is this correct ?
      if (/\u0000/.test(filePath)) {
        return filePath;

      } else {
        // TODO is this correct ?
        var dir = (importer == null
          ? process.cwd()
          : $path.dirname(importer));

        // TODO is this path correct ?
        // TODO apply the `filter` to the ID ?
        var fullPath = $path.join(dir, filePath);

        if ($path.extname(filePath) === ".purs") {
          // TODO hacky
          return new Promise(function (resolve, reject) {
            $fs.readFile(fullPath, { encoding: "utf8" }, function (err, file) {
              if (err) {
                reject(err);

              } else {
                // TODO super hacky
                var a = /(?:^|\n|\r\n) *module +([^ \n\r\(]+)/.exec(file);

                if (a) {
                  resolve(pursPath(options, a[1]));

                } else {
                  reject(new Error("Could not detect module name for file " + fullPath));
                }
              }
            });
          });

        // TODO hacky
        } else {
          return new Promise(function (resolve, reject) {
            $fs.stat(fullPath, function (err, stat) {
              if (err) {
                // TODO better error handling
                resolve(null);

              // TODO is this correct ?
              // TODO only do this for the outputDir ?
              } else if (stat.isDirectory()) {
                resolve($path.join(fullPath, "index.js"));

              } else {
                resolve(fullPath);
              }
            });
          });
        }
      }
    },

    // TODO hacky
    // This creates a main entry point that calls the `main` function of the main PureScript module
    load: function (filePath) {
      if (filePath === entryPath) {
        // TODO better stringification for the path ?
        // TODO source maps for this ?
        return "import { main } from " + JSON.stringify(entry) + "; main();";
      }
    },

    transform: function (code, filePath) {
      // TODO better filtering ?
      if (!filter(filePath)) return;

      // TODO test if this optimization actually makes it faster or not
      if (!/exports|module|require/.test(code)) return;

      return $convert.call(this, code, filePath);
    },

    transformBundle: function (code) {
      /*return $babel.transform("foo", {
        babelrc: false,
        ast: false,
        filename: "\0rollup-plugin-purs:bundle",
        sourceMaps: true,
        plugins: [
          function (babel) {
            return {
              visitor: {
                Identifier: {
                  enter: function (path) {
                    if (path.node.name === "foo") {
                      path.replaceWith({
                        type: "FunctionExpression",
                        id: null,
                        params: [{
                          type: "Identifier",
                          name: "bar"
                        }],
                        body: {
                          type: "BlockStatement",
                          body: [{
                            type: "ExpressionStatement",
                            expression: {
                              type: "Identifier",
                              name: "bar"
                            }
                          }]
                        }
                      });
                    }
                  }
                }
              }
            };
          },

          function (babel) {
            return {
              visitor: {
                Identifier: {
                  enter: function (path) {
                    console.log(path.node.name, path.scope.getBinding(path.node.name) != null);
                  }
                }
              }
            };
          }
        ]
      });*/

      // TODO what about sourceRoot ?
      var info = $babel.transform(code, {
        babelrc: false,
        code: false,
        ast: true,
        sourceMaps: false,
        // TODO is this correct ?
        filename: "\0rollup-plugin-purs:bundle",
        plugins: [
          $rename,
          // TODO better way of handling this ?
          $propagate
        ]
      });

      var plugins = [];

      // TODO better way of handling this ?
      plugins.push($propagate);

      if (options.optimizations.inline) {
        plugins.push([$inline, { debug: options.debug }]);
        plugins.push([$typeclass, { debug: options.debug }]);
      }

      if (options.optimizations.uncurry) {
        plugins.push([$uncurry, { debug: options.debug }]);
      }

      plugins.push([$removeIIFE, { debug: options.debug }]);

      plugins.push($removeSequence);

      // TODO is this the correct place for this ?
      plugins.push("transform-do-expressions");

      // TODO do we need transform-es2015-block-scoped-functions ?
      // TODO is this the correct place for this ?
      plugins.push("transform-es2015-block-scoping");

      // TODO use babel-preset-babili ?
      // TODO use "minify-dead-code-elimination" ?
      plugins.push("minify-constant-folding");

      if (options.optimizations.removeDeadCode) {
        // TODO is this the correct `code` to use ?
        info = $babel.transformFromAst(info.ast, null, {
          babelrc: false,
          code: false,
          ast: true,
          sourceMaps: false,
          plugins: plugins
        });

        plugins = [
          [$deadCode, {
            debug: options.debug,
            assumePureVars: options.optimizations.assumePureVars
          }]
        ];
      }

      // TODO is this the correct `code` to use ?
      return $babel.transformFromAst(info.ast, null, {
        babelrc: false,
        code: true,
        ast: false,
        sourceMaps: true,
        plugins: plugins
      });
    }
  };
};
