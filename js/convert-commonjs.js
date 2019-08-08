import * as $fs from "fs";

var args = process.argv.slice(2);

var filename = args[0];

var context = {
  warn: function (code) {
    console.warn("Warning: " + code);
  },
  error: function (code) {
    throw new Error(code);
  }
};

import("../pkg/index").then(($rust) => {
  return new Promise((resolve, reject) => {
    $fs.readFile(filename, { encoding: "utf8" }, function (err, file) {
      if (err) {
        reject(err);

      } else {
        resolve($rust.convert(context, file, filename));
      }
    });
  });
}).then((s) => {
  console.log(s);
}).catch(console.error);
