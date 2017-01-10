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
import resolve from "rollup-plugin-node-resolve";

export default {
  entry: "src/Main.purs",
  dest: "bundle.js",
  format: "iife",
  sourceMap: true,
  plugins: [
    purs(),
    resolve()
  ]
};
```

In addition to `rollup-plugin-purs`, you will also need to use the [`rollup-plugin-node-resolve`](https://github.com/rollup/rollup-plugin-node-resolve) plugin.

This plugin does **not** compile PureScript code, so you will first need to run `pulp build` (or equivalent) before using this plugin.


## Options

These are the default options:

```js
purs({
  include: undefined,
  exclude: undefined,
  outputDir: "output",  // Directory where the PureScript files are located
  runMain: true,        // Whether to call the `main` function or not
  uncurry: true         // Whether to apply the uncurrying optimization or not
})
```


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


## License

MIT
