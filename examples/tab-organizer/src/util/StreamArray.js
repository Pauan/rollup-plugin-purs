"use strict";


exports.mapWithIndexImpl = function (eachDelta, arrayDelta, make, view, modify, set, runTransactions) {
  return function (Replace, Insert, Update, Remove, Just, Nothing, increment, decrement) {
    return function (f) {
      return function (stream) {
        // TODO don't rely upon this implementation detail ?
        return function (onValue, onError, onComplete) {
          return function () {
            var indexes = [];

            function onReplace(array) {
              return function () {
                var length = array.length;

                indexes = new Array(length);

                var output = new Array(length);

                for (var i = 0; i < length; ++i) {
                  indexes[i] = make(Just(i))();
                  output[i] = f(view(indexes[i]))(array[i]);
                }

                return onValue(Replace(output))();
              };
            }

            function onInsert(index) {
              return function (v) {
                return function () {
                  var mut = make(Just(index))();

                  indexes.splice(index, 0, mut);

                  var value = f(view(mut))(v);

                  var length = indexes.length;

                  var transactions = [];

                  for (var i = index + 1; i < length; ++i) {
                    transactions.push(modify(increment)(indexes[i]));
                  }

                  runTransactions(transactions)();

                  return onValue(Insert(index)(value))();
                };
              };
            }

            function onUpdate(index) {
              return function (v) {
                return function () {
                  var mut = indexes[index];
                  var value = f(view(mut))(v);
                  return onValue(Update(index)(value))();
                };
              };
            }

            function onRemove(index) {
              return function () {
                var mut = indexes[index];

                indexes.splice(index, 1);

                var length = indexes.length;

                var transactions = [];

                // TODO make this faster ?
                transactions.push(set(Nothing)(mut));

                for (var i = index; i < length; ++i) {
                  transactions.push(modify(decrement)(indexes[i]));
                }

                runTransactions(transactions)();

                return onValue(Remove(index))();
              };
            }

            return eachDelta(arrayDelta(onReplace)(onInsert)(onUpdate)(onRemove))(onError)(onComplete)(stream)();
          };
        };
      };
    };
  };
};
