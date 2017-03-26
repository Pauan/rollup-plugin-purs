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
  include: undefined,     // Glob pattern for files/directories to include
  exclude: undefined,     // Glob pattern for files/directories to exclude
  outputDir: "output",    // Directory where the PureScript files are located
  runMain: true,          // Whether to call the `main` function or not
  debug: false,           // Displays additional warnings and statistics
  optimizations: {
    uncurry: true,        // Whether to apply the uncurrying optimization or not
    inline: true,         // Whether to inline some functions or not
    removeDeadCode: true  // Whether to remove dead code or not
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

These are the optimizations which can be turned on or off:

* `uncurry`

  Replace curried functions with uncurried functions, for improved performance and smaller file size

* `inline`

  Inline some functions, which can increase performance and decrease the file size.

  It also inlines typeclass instance methods when it can.

* `removeDeadCode`

  Removes code which is not used. This dramatically reduces the file size.

In addition to the above optimizations, there are some optimizations which are *always* applied:

* Constant propagation/folding


## Planned optimizations

* Common subexpression elimination


## License

MIT
