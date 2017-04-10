# rollup-plugin-purs

Bundles PureScript modules with Rollup


## Why Rollup?

Here are the file sizes for the `examples/tab-organizer` program:

| Bundler            | Unminified | JSMin      | UglifyJS   |
| ------------------ | ---------: | ---------: | ---------: |
| rollup-plugin-purs | `112.2 kB` | `70.3 kB`  | `35.7 kB`  |
| purs bundle        | `157.8 kB` | `107.2 kB` | `65.2 kB`  |
| webpack            | `977.4 kB` | `654.0 kB` | `178.8 kB` |


## Installation

1. Add the following to your `package.json`:

   ```json
   "devDependencies": {
     "rollup": "^0.41.6",
     "rollup-plugin-purs": "^1.0.35"
   },
   "scripts": {
     "build": "rollup --config"
   }
   ```

2. Run `npm install`

3. Place this code into a file called `rollup.config.js`:

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

4. This plugin does **not** compile PureScript code, so you will need to run `pulp build -- --source-maps` (or equivalent)

5. Run `npm run build`

6. The final bundle is in the `bundle.js` file. Enjoy the smaller file size and optimizations!

You can see an example program in the `examples/pulp init` folder.


## Options

These are the default options:

```js
purs({
  include: undefined,      // Glob pattern for files/directories to include
  exclude: undefined,      // Glob pattern for files/directories to exclude
  buildDir: "output",      // Directory where the `purs compile` files are located
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


## Optimizations

These are the optimizations which can be turned on or off:

* `uncurry`

  Replaces curried functions with uncurried functions, for improved performance and smaller file size.

* `inline`

  Inlines some functions, which can increase performance and decrease the file size.

  It also inlines typeclass instance methods when it can. This can dramatically improve performance and reduce the file size.

* `removeDeadCode`

  Removes code which is not used. This dramatically reduces the file size.

* `assumePureVars`

  When there is a variable assignment like `var foo = ...` it will assume that the `...` is pure. When used in combination with `removeDeadCode`, this significantly reduces the file size.

  If `assumePureVars` is `false`, then `rollup-plugin-purs` only removes unused variables if it can prove that the variables are pure. But sometimes it won't remove unused variables, because it's not smart enough to realize that the variables are pure.

  If `assumePureVars` is `true`, then `rollup-plugin-purs` will remove all unused variables, even if it can't prove that the variables are pure.

  PureScript variables are always pure, so `assumePureVars` is safe. But if you do weird things with the FFI, or if you use an unsafe PureScript function, or if you import a JavaScript library, then `assumePureVars` might break your program.

In addition to the above optimizations, there are some optimizations which are *always* applied:

* Constant propagation / folding


## Planned optimizations

* Common subexpression elimination


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


## Converting from CommonJS to ES6 modules

This package also contains a `convert-commonjs` program which can be used to convert a file from CommonJS to ES6 modules.

You can run `node_modules/.bin/convert-commonjs input.js > output.js` which will take the `input.js` file (which is CommonJS) and will output to the `output.js` file (which is ES6 modules).


## License

MIT
