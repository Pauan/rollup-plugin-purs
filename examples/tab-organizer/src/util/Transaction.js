"use strict";


// TODO https://github.com/purescript/purescript/issues/2290
var globalTransactionId;

globalTransactionId = 0;


function runTransaction1(transaction) {
  var state = [];

  try {
    var value = transaction(state);

    var length = state.length;

    if (length !== 0) {
      var id = globalTransactionId++;

      for (var i = 0; i < length; ++i) {
        // TODO what if this throws an error ?
        state[i].commit(id);
      }

      // TODO better detection for whether the state has changed or not ?
      // TODO is this needed ?
      if (state.length !== length) {
        throw new Error("Invalid transaction state");
      }
    }

    return value;

  } catch (e) {
    var i = state.length;

    // Must traverse it in reverse order
    while (i--) {
      state[i].rollback();
    }

    throw e;
  }
}

exports.runTransaction = function (transaction) {
  return function () {
    return runTransaction1(transaction);
  };
};


exports.runTransactionsImpl = function (unit) {
  return function (a) {
    var length = a.length;

    function transaction(state) {
      for (var i = 0; i < length; ++i) {
        a[i](state);
      }

      return unit;
    }

    return function () {
      return runTransaction1(transaction);
    };
  };
};


exports.mapImpl = function (f) {
  return function (transaction) {
    return function (state) {
      return f(transaction(state));
    };
  };
};


// TODO test this
// TODO verify that this follows the Apply laws
exports.applyImpl = function (transaction1) {
  return function (transaction2) {
    return function (state) {
      var a = transaction1(state);
      var b = transaction2(state);
      return a(b);
    };
  };
};


// TODO test this
// TODO verify that this follows the Bind laws
exports.bindImpl = function (transaction) {
  return function (f) {
    return function (state) {
      var a = transaction(state);
      return f(a)(state);
    };
  };
};


exports.pureImpl = function (value) {
  return function (state) {
    return value;
  };
};


// TODO move this someplace else ?
function noop() {}

// TODO test this
exports.onCommitImpl = function (unit) {
  return function (eff) {
    return function (state) {
      state.push({
        rollback: noop,
        commit: function () {
          eff();
        }
      });

      return unit;
    };
  };
};
