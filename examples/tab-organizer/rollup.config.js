import purs from "rollup-plugin-purs";
import sourcemaps from "rollup-plugin-sourcemaps";

export default {
  entry: "src/Main.purs",
  dest: "dist/js/rollup.js",
  format: "iife",
  sourceMap: true,
  plugins: [
    purs({
      debug: true,
      optimizations: {
        uncurry: true,
        inline: true,
        removeDeadCode: true,
        assumePureVars: true
      }
    }),
    //sourcemaps()
  ]
};
