"use strict";


exports.makeImpl = function (Broadcaster) {
  return function (receive) {
    return function (unit) {
      return function (value) {
        return function (state) {
          var self = {
            snapshot: {
              id: 0,
              value: value
            },

            listeners: Broadcaster(),

            // TODO is this correct ?
            // TODO can this be made faster ?
            view: {
              snapshot: function () {
                return self.snapshot;
              },
              subscribe: function (push) {
                // TODO make this faster ?
                return receive(function (id) {
                  return function () {
                    push(id);
                    return unit;
                  };
                })(self.listeners)();
              }
            }
          };

          return self;
        };
      };
    };
  };
};


exports.viewImpl = function (mutable) {
  return mutable.view;
};


exports.get = function (mutable) {
  return function (state) {
    return mutable.snapshot.value;
  };
};


// TODO test this
exports.setImpl = function (send) {
  return function (unit) {
    return function (newValue) {
      return function (mutable) {
        return function (state) {
          var oldSnapshot = mutable.snapshot;

          // Optimization for speed: if the value hasn't changed, then there's no reason to push
          if (oldSnapshot.value !== newValue) {
            // TODO do this per `Mutable` rather than per `set`
            state.push({
              rollback: function () {
                mutable.snapshot = oldSnapshot;
              },
              commit: function (id) {
                return send(id)(mutable.listeners)();
              }
            });

            mutable.snapshot = {
              // TODO is this correct ?
              id: oldSnapshot.id + 1,
              value: newValue
            };
          }

          return unit;
        };
      };
    };
  };
};
