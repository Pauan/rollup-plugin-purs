#! /usr/bin/env node

var $fs = require("fs");
var $convert = require("../src/convert");


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

$fs.readFile(filename, { encoding: "utf8" }, function (err, file) {
  if (err) {
    throw err;

  } else {
    console.log($convert.call(context, file, filename).code);
  }
});
