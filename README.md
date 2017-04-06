# rollup-plugin-purs

Bundle PureScript modules with Rollup


## Why Rollup?

Here are the file sizes for the `examples/tab-organizer` program:

| Bundler            | Unminified | JSMin      | UglifyJS   |
| ------------------ | ---------: | ---------: | ---------: |
| rollup-plugin-purs | `118.4 kB` | `75.5 kB`  | `40.1 kB`  |
| psc-bundle         | `165.3 kB` | `112.2 kB` | `69.2 kB`  |
| webpack            | `944.9 kB` | `639.2 kB` | `176.8 kB` |


## Installation

```bash
npm install --save-dev rollup
npm install --save-dev rollup-plugin-purs
```


## Usage

1. Here is an example configuration:

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

   Place the above code into a file called `rollup.config.js`

2. This plugin does **not** compile PureScript code, so you will need to run `pulp build` (or equivalent)

3. Run `rollup`

4. The final bundle is in the `bundle.js` file. Enjoy the smaller file size and optimizations!


## Options

These are the default options:

```js
purs({
  include: undefined,      // Glob pattern for files/directories to include
  exclude: undefined,      // Glob pattern for files/directories to exclude
  outputDir: "output",     // Directory where the PureScript files are located
  runMain: true,           // Whether to call the `main` function or not
  debug: true,             // Displays additional warnings and statistics
  optimizations: {
    uncurry: true,         // Whether to apply the uncurrying optimization or not
    inline: true,          // Whether to inline some functions or not
    removeDeadCode: true,  // Whether to remove dead code or not
    assumePureVars: true   // Whether to assume that variable assignment is always pure
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

* `assumePureVars`

  Assumes that any variable assignment like `var foo = ...` is pure. When used in combination with `removeDeadCode`, this significantly reduces the file size.

In addition to the above optimizations, there are some optimizations which are *always* applied:

* Constant propagation/folding


## Planned optimizations

* Common subexpression elimination


## License

MIT
