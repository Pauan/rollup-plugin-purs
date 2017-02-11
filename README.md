# rollup-plugin-purs

Bundle PureScript modules with Rollup


## Installation

```bash
npm install --save-dev rollup-plugin-purs
```


## Usage

Here is an example configuration:

```js
import purs from "rollup-plugin-purs";

export default {
  entry: "src/Main.purs",
  dest: "bundle.js",
  format: "iife",
  sourceMap: true,
  plugins: [
    purs()
  ]
};
```

This plugin does **not** compile PureScript code, so you will first need to run `pulp build` (or equivalent) before using this plugin.


## Options

These are the default options:

```js
purs({
  include: undefined,
  exclude: undefined,
  outputDir: "output",  // Directory where the PureScript files are located
  runMain: true,        // Whether to call the `main` function or not
  debug: false,         // Displays additional warnings and statistics
  optimizations: {
    uncurry: true,      // Whether to apply the uncurrying optimization or not
    inline: true,       // Whether to inline some functions or not
  }
})
```

The default options should be fine for most use cases.


## Comment pragmas

You can disable certain warnings by including a special comment in your code:

```
// rollup-plugin-purs ignore dynamic exports
```

```
// rollup-plugin-purs ignore dynamic require
```

```
// rollup-plugin-purs ignore dynamic module
```

Each comment disables a specific warning.

The comments must be exactly the same as above, and they must be placed at the top-level of your code, with zero spaces to the left of the comment.


## Optimizations

In addition to the uncurrying and inlining optimizations, there are some optimizations which are *always* applied:

* Dead code elimination

* Constant propagation/folding


## Planned optimizations

* Typeclass instance inlining

* Common subexpression elimination


## License

MIT
