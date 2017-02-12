"use strict";


exports.mapImpl = function (f) {
  return function (view) {
    var oldSnapshot = null;
    var parentSnapshot = null;

    return {
      snapshot: function () {
        var newSnapshot = view.snapshot();

        if (oldSnapshot === null ||
            (parentSnapshot.id !== newSnapshot.id &&
             // TODO is this optimization okay ?
             parentSnapshot.value !== newSnapshot.value)) {

          parentSnapshot = newSnapshot;

          oldSnapshot = {
            id: newSnapshot.id,
            value: f(newSnapshot.value)
          };
        }

        return oldSnapshot;
      },
      subscribe: view.subscribe
    };
  };
};


// TODO test this
// TODO verify that this follows the Apply laws
exports.applyImpl = function (view1) {
  return function (view2) {
    var oldId = 0;
    var oldSnapshot = null;

    var oldSnapshot1 = null;
    var oldSnapshot2 = null;

    return {
      snapshot: function () {
        var newSnapshot1 = view1.snapshot();
        var newSnapshot2 = view2.snapshot();

        if (oldSnapshot === null ||

            (oldSnapshot1.id !== newSnapshot1.id &&
             // TODO is this optimization okay ?
             oldSnapshot1.value !== newSnapshot1.value) ||

            (oldSnapshot2.id !== newSnapshot2.id &&
             // TODO is this optimization okay ?
             oldSnapshot2.value !== newSnapshot2.value)) {

          oldSnapshot1 = newSnapshot1;
          oldSnapshot2 = newSnapshot2;

          oldSnapshot = {
            id: oldId,
            // TODO don't push if the new value is the same as the old value ?
            // TODO what if this throws an exception ?
            value: newSnapshot1.value(newSnapshot2.value)
          };

          ++oldId;
        }

        return oldSnapshot;
      },
      subscribe: function (push) {
        var cleanup1 = view1.subscribe(push);
        var cleanup2 = view2.subscribe(push);

        return function () {
          cleanup1();
          return cleanup2();
        };
      }
    };
  };
};


exports.pureImpl = function (unit) {
  function noop() {
    return unit;
  }

  function noopSubscribe(push) {
    return noop;
  }

  return function (a) {
    var snapshot = {
      id: 0,
      value: a
    };

    return {
      snapshot: function () {
        return snapshot;
      },
      subscribe: noopSubscribe
    };
  };
};


// TODO test this
// TODO verify that this follows the Bind laws
exports.bindImpl = function (parent) {
  return function (f) {
    var oldId = 0;
    var oldSnapshot = null;

    var oldParentSnapshot = null;

    var child = null;
    var oldChildSnapshot = null;

    function snapshot() {
      var newParentSnapshot = parent.snapshot();

      if (oldParentSnapshot === null ||
          (oldParentSnapshot.id !== newParentSnapshot.id &&
           // TODO is this optimization okay ?
           oldParentSnapshot.value !== newParentSnapshot.value)) {

        oldParentSnapshot = newParentSnapshot;

        // TODO if the new child view has the same value as the old child view, maybe it shouldn't push
        oldChildSnapshot = null;

        child = f(newParentSnapshot.value);
      }

      var newChildSnapshot = child.snapshot();

      if (oldChildSnapshot === null ||
          (oldChildSnapshot.id !== newChildSnapshot.id &&
           // TODO is this optimization okay ?
           oldChildSnapshot.value !== newChildSnapshot.value)) {

        oldChildSnapshot = newChildSnapshot;

        oldSnapshot = {
          id: oldId,
          value: newChildSnapshot.value
        };

        ++oldId;
      }

      return oldSnapshot;
    }

    return {
      snapshot: snapshot,

      // TODO if the new transaction id is the same as the old transaction id, don't update anything
      subscribe: function (push) {
        // TODO is this correct ?
        // TODO make this faster
        snapshot();

        // TODO is this correct ?
        // TODO check the old parent snapshot ?
        var cleanup1 = parent.subscribe(function (newTransaction) {
          // TODO is this correct ?
          // TODO make this faster
          snapshot();

          var old = cleanup2;

          cleanup2 = child.subscribe(push);

          old();

          push(newTransaction);
        });

        var cleanup2 = child.subscribe(push);

        return function () {
          cleanup1();
          return cleanup2();
        };
      }
    };
  };
};


exports.currentValue = function (view) {
  return function (state) {
    return view.snapshot().value;
  };
};


// TODO test this
exports.observe = function (push) {
  return function (view) {
    return function () {
      var oldId = null;

      var oldSnapshot = view.snapshot();

      // TODO should this push or subscribe first ?
      push(oldSnapshot.value)();

      return view.subscribe(function (newId) {
        if (oldId === null || oldId !== newId) {
          oldId = newId;

          var newSnapshot = view.snapshot();

          if (oldSnapshot.id !== newSnapshot.id &&
              // TODO is this optimization okay ?
              oldSnapshot.value !== newSnapshot.value) {

            oldSnapshot = newSnapshot;

            push(newSnapshot.value)();
          }
        }
      });
    };
  };
};
