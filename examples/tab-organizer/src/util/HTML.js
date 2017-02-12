"use strict";


function preventDefault(e) {
  e.preventDefault();
}


exports.onImpl = function (name) {
  return function (f) {
    return function (state, info) {
      // TODO should this use true or false ?
      info.element.addEventListener(name, function (e) {
        f(e)();
      }, true);
    };
  };
};


exports.onClickImpl = function (makeEvent, button) {
  return function (f) {
    return function (state, info) {
      var element = info.element;

      // TODO what about blur, etc. ?
      function mouseup(e) {
        removeEventListener("mouseup", mouseup, true);

        // TODO is this correct ?
        if (e.button === button && element.contains(e.target)) {
          // TODO what about Macs ?
          f(makeEvent(e.shiftKey)(e.ctrlKey)(e.altKey))();
        }
      }

      if (button === 2) {
        element.addEventListener("contextmenu", preventDefault, true);
      }

      // TODO should this use true or false ?
      element.addEventListener("mousedown", function (e) {
        addEventListener("mouseup", mouseup, true);
      }, true);
    };
  };
};


exports.widget = function (f) {
  return function (state) {
    return f(state)()(state);
  };
};


function setTraits(state, info, attrs) {
  var length = attrs.length;

  for (var i = 0; i < length; ++i) {
    attrs[i](state, info);
  }
}

exports.htmlImpl = function (appendChild) {
  return function (tag) {
    return function (attrs) {
      return function (children) {
        return function (state) {
          var element = document.createElement(tag);

          var info = {
            // TODO use createElementNS ?
            element: element,
            styles: {},
            properties: {}
          };

          // This must be before `setTraits`, because otherwise setting the `value` of a `<select>` doesn't work
          appendChild(state, info, children);
          setTraits(state, info, attrs);

          return element;
        };
      };
    };
  };
};


exports.textImpl = function (makeText) {
  return function (text) {
    return function (state) {
      return makeText(state, text);
    };
  };
};


exports.styleImpl = function (setStyle) {
  return function (important) {
    return function (key) {
      return function (value) {
        return function (state, info) {
          if (info.styles[key] == null) {
            info.styles[key] = true;

          } else {
            throw new Error("Style already exists \"" + key + "\"");
          }

          // TODO pass in the style rather than the element
          return setStyle(state, info.element, key, value, important);
        };
      };
    };
  };
};


exports.body = function () {
  return document.body;
};


exports.trait = function (traits) {
  return function (state, info) {
    setTraits(state, info, traits);
  };
};


// TODO test this
exports.onDragImpl = function (makeEvent) {
  return function (makePosition) {
    function getEvent(element, initialX, initialY, e) {
      var x = e.clientX;
      var y = e.clientY;
      var box = element.getBoundingClientRect();
      var position = makePosition(box.left)(box.top)(box.width)(box.height);
      return makeEvent(initialX)(initialY)(x)(y)(position);
    }

    return function (threshold) {
      return function (onStart) {
        return function (onMove) {
          return function (onEnd) {
            return function (state, info) {
              var element = info.element;
              var initialX = null;
              var initialY = null;
              var dragging = false;

              // TODO preventDefault ?
              // TODO stopPropagation ?
              function mousemove(e) {
                var event = getEvent(element, initialX, initialY, e);

                if (dragging) {
                  onMove(event)();

                } else if (threshold(event)()) {
                  dragging = true;
                  onStart(event)();
                }
              }

              // TODO preventDefault ?
              // TODO stopPropagation ?
              function mouseup(e) {
                // TODO don't create this if dragging is false ?
                var event = getEvent(element, initialX, initialY, e);

                initialX = null;
                initialY = null;

                removeEventListener("mousemove", mousemove, true);
                removeEventListener("mouseup", mouseup, true);

                if (dragging) {
                  dragging = false;

                  onEnd(event)();
                }
              }

              element.addEventListener("mousedown", function (e) {
                // TODO support other buttons ?
                // TODO support shift/ctrl/alt
                // TODO what about Macs ?
                if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                  initialX = e.clientX;
                  initialY = e.clientY;

                  addEventListener("mousemove", mousemove, true);
                  // TODO what about `blur` or other events ?
                  addEventListener("mouseup", mouseup, true);

                  var event = getEvent(element, initialX, initialY, e);

                  dragging = threshold(event)();

                  if (dragging) {
                    onStart(event)();
                  }
                }
              }, true);
            };
          };
        };
      };
    };
  };
};
