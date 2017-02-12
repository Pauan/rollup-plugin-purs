"use strict";


exports.makeBroadcaster = function () {
  return {
    index: 0,
    length: 0,
    listeners: []
  };
};


function hasListeners(broadcaster) {
  return broadcaster.listeners.length !== 0;
}


function send(broadcaster, value) {
  // TODO remove this later
  if (broadcaster.index !== 0) {
    throw new Error("Invalid state");
  }

  // TODO remove this later
  if (broadcaster.length !== 0) {
    throw new Error("Invalid state");
  }

  var listeners = broadcaster.listeners;

  // This causes it to not trigger listeners which are added while sending a value
  broadcaster.length = listeners.length;

  // All of this extra code is needed when a listener is removed while sending a value
  for (;;) {
    var index = broadcaster.index;

    if (index < broadcaster.length) {
      listeners[index](value)();

      ++broadcaster.index;

    } else {
      break;
    }
  }

  broadcaster.index = 0;
  broadcaster.length = 0;
}

exports.broadcastImpl = function (unit) {
  return function (value) {
    return function (broadcaster) {
      return function () {
        send(broadcaster, value);
        return unit;
      };
    };
  };
};


function receive(broadcaster, listener, unit) {
  broadcaster.listeners.push(listener);

  // TODO is this necessary ?
  var killed = false;

  return function () {
    if (!killed) {
      killed = true;

      // TODO make this faster ?
      var index = broadcaster.listeners.indexOf(listener);

      // TODO throw an error if it's not found ?
      if (index !== -1) {
        // TODO make this faster ?
        broadcaster.listeners.splice(index, 1);

        // This is needed when a listener is removed while sending a value
        if (index < broadcaster.length) {
          --broadcaster.length;

          // TODO test this
          if (index <= broadcaster.index) {
            --broadcaster.index;
          }
        }
      }
    }

    return unit;
  };
}

exports.eventsImpl = function (unit) {
  return function (broadcaster) {
    // TODO maybe store this directly on the broadcaster ?
    return function (push) {
      // TODO make this faster
      return receive(broadcaster, push, unit);
    };
  };
};


exports.receiveImpl = function (push) {
  return function (events) {
    return function () {
      return events(push);
    };
  };
};


// TODO test this
exports.mapImpl = function (fn) {
  return function (events) {
    return function (push) {
      return events(function (value) {
        return push(fn(value));
      });
    };
  };
};


// TODO test this
exports.filterMapImpl = function (noop, maybe) {
  return function (fn) {
    return function (events) {
      return function (push) {
        return events(function (value) {
          return maybe(noop)(push)(fn(value));
        });
      };
    };
  };
};


// TODO test this
exports.partitionMapImpl = function (makeRecord, noop, either) {
  return function (fn) {
    return function (events) {
      function left(push) {
        return events(function (value) {
          // TODO don't call `fn` twice ?
          return either(push)(noop)(fn(value));
        });
      }

      function right(push) {
        return events(function (value) {
          // TODO don't call `fn` twice ?
          return either(noop)(push)(fn(value));
        });
      }

      return makeRecord(left)(right);
    };
  };
};
