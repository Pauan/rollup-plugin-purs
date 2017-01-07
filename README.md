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
  sourceMap: true,
  plugins: [
    purs(),
    resolve()
  ]
};
```

In addition to `rollup-plugin-purs`, you will also need to use the [`rollup-plugin-node-resolve`](https://github.com/rollup/rollup-plugin-node-resolve) plugin.


## License

MIT