"use strict";


function makeState(parent) {
  // TODO is it faster to lazily initialize the arrays only when needed ?
  return {
    parent: parent,
    afterInsert: [],
    beforeRemove: []
  };
}

// TODO don't allow for calling this after the element has been inserted ?
function beforeRemove(state, f) {
  state.beforeRemove.push(f);
}

// TODO test this
function afterInsert(state, f) {
  // TODO is this correct ?
  if (state.afterInsert === null) {
    throw new Error("Element is already inserted");
  }

  for (;;) {
    // TODO what if the parent is killed ?
    if (state.parent === null || state.parent.afterInsert === null) {
      state.afterInsert.push(f);
      return;

    } else {
      state = state.parent;
    }
  }
}

function triggerInsert(state) {
  var a = state.afterInsert;

  // TODO is this correct ?
  state.parent = null;
  state.afterInsert = null;

  var length = a.length;

  for (var i = 0; i < length; ++i) {
    a[i]();
  }
}

function triggerRemove(state) {
  // TODO is this correct ?
  if (state.afterInsert !== null) {
    throw new Error("Killed before the element was inserted");
  }

  var a = state.beforeRemove;

  state.beforeRemove = null;

  var length = a.length;

  for (var i = 0; i < length; ++i) {
    a[i]();
  }
}


function setChildren(state, e, children) {
  var length = children.length;

  for (var i = 0; i < length; ++i) {
    e.appendChild(children[i](state));
  }
}


function stateObserve(state, observe, view, f) {
  var resource = observe(function (value) {
    // TODO make this more efficient ?
    return function () {
      return f(value);
    };
  })(view)();

  // TODO test this
  beforeRemove(state, resource);
}


// TODO is this correct ?
function setStyle1(style, key, value, important) {
  style.removeProperty(key);

  if (value === "") {
    return true;

  } else {
    style.setProperty(key, value, important);

    return style.getPropertyValue(key) !== "";
  }
}

// TODO test this
function setStylePrefixValues(style, prefix, key, value, important) {
  if (prefix in style) {
    if (!(setStyle1(style, prefix, value, important) ||
          setStyle1(style, prefix, "-webkit-" + value, important) ||
          setStyle1(style, prefix, "-moz-" + value, important) ||
          setStyle1(style, prefix, "-ms-" + value, important) ||
          setStyle1(style, prefix, "-o-" + value, important))) {
      // TODO should this throw an error ?
      console.warn("Invalid style value \"" + key + "\": \"" + value + "\"");
    }

    return true;

  } else {
    return false;
  }
}

// TODO test this
// TODO can this be made faster ?
function setStyle(style, key, value, important) {
  if (!(setStylePrefixValues(style, key, key, value, important) ||
        setStylePrefixValues(style, "-webkit-" + key, key, value, important) ||
        setStylePrefixValues(style, "-moz-" + key, key, value, important) ||
        setStylePrefixValues(style, "-ms-" + key, key, value, important) ||
        setStylePrefixValues(style, "-o-" + key, key, value, important))) {
    // TODO should this throw an error ?
    console.warn("Invalid style key \"" + key + "\": \"" + value + "\"");
  }
}


// TODO browser prefixes ?
// TODO test this
// TODO should this warn or error ?
function setProperty(element, key, value) {
  if (key in element) {
    var oldValue = element[key];

    element[key] = value;

    var newValue = element[key];

    // TODO better detection ?
    if (newValue === oldValue && oldValue !== value) {
      // TODO should this throw an error ?
      console.warn("Invalid property value \"" + key + "\": \"" + value + "\"");
    }

  } else {
    // TODO should this throw an error ?
    console.warn("Invalid property key \"" + key + "\": \"" + value + "\"");
  }
}


exports.beforeRemoveImpl = function (unit) {
  return function (eff) {
    return function (state) {
      return function () {
        beforeRemove(state, eff);
        return unit;
      };
    };
  };
};


exports.afterInsertImpl = function (unit) {
  return function (eff) {
    return function (state) {
      return function () {
        afterInsert(state, eff);
        return unit;
      };
    };
  };
};


exports.appendChildArray = function (unit) {
  return function (state, info, children) {
    setChildren(state, info.element, children);
    return unit;
  };
};


exports.appendChildStreamArray = function (eachDelta) {
  return function (arrayDelta) {
    return function (unit) {
      return function (state, info, children) {
        var element = info.element;

        var childStates = [];

        function kill() {
          var length = childStates.length;

          for (var i = 0; i < length; ++i) {
            triggerRemove(childStates[i]);
          }
        }

        function onReplace(array) {
          // TODO is it faster or slower to use a document fragment ?
          var fragment = document.createDocumentFragment();

          var length = array.length;

          var newStates = new Array(length);

          for (var i = 0; i < length; ++i) {
            newStates[i] = makeState(state);
            fragment.appendChild(array[i](newStates[i]));
          }

          if (childStates.length !== 0) {
            kill();
            // TODO can this be made faster ?
            element.innerHTML = "";
          }

          childStates = newStates;

          element.appendChild(fragment);

          // TODO avoid looping twice ?
          for (var i = 0; i < length; ++i) {
            triggerInsert(childStates[i]);
          }

          return unit;
        }

        function onInsert(index) {
          return function (value) {
            var newState = makeState(state);

            // TODO test this
            // TODO is this actually faster ?
            if (index === childStates.length) {
              childStates.push(newState);

              // TODO should this allow for arrays ?
              element.appendChild(value(newState));

            } else {
              childStates.splice(index, 0, newState);

              // TODO should this allow for arrays ?
              element.insertBefore(value(newState), element.childNodes[index]);
            }

            triggerInsert(newState);

            return unit;
          };
        }

        function onUpdate(index) {
          return function (value) {
            var oldState = childStates[index];

            var newState = makeState(state);

            childStates[index] = newState;

            var html = value(newState);

            // TODO test this
            triggerRemove(oldState);

            // TODO should this allow for arrays ?
            element.replaceChild(html, element.childNodes[index]);

            triggerInsert(newState);

            return unit;
          };
        }

        function onRemove(index) {
          var oldState = childStates[index];

          // TODO faster code for `pop`?
          childStates.splice(index, 1);

          triggerRemove(oldState);

          element.removeChild(element.childNodes[index]);

          return unit;
        }

        var choose = arrayDelta(onReplace)(onInsert)(onUpdate)(onRemove);

        var resource = eachDelta(function (delta) {
          // TODO make this more efficient ?
          return function () {
            return choose(delta);
          };
        })(children)();

        // TODO test this
        beforeRemove(state, resource);

        // TODO test this
        beforeRemove(state, kill);
      };
    };
  };
};


exports.makeTextString = function (state, text) {
  return document.createTextNode(text);
};


exports.makeTextView = function (observe) {
  return function (unit) {
    return function (state, text) {
      var e = document.createTextNode("");

      // TODO guarantee that this is called synchronously ?
      stateObserve(state, observe, text, function (value) {
        // http://jsperf.com/textnode-performance
        e.data = value;
        return unit;
      });

      return e;
    };
  };
};


exports.renderImpl = function (unit) {
  return function (parent) {
    return function (html) {
      return function () {
        var state = makeState(null);

        var child = html(state);

        parent.appendChild(child);

        triggerInsert(state);

        // TODO what if this is called twice ?
        return function () {
          triggerRemove(state);
          parent.removeChild(child);
          return unit;
        };
      };
    };
  };
};


exports.unsafeSetPropertyValue = function (state, element, key, value) {
  setProperty(element, key, value);
};


exports.unsafeSetPropertyView = function (observe) {
  return function (unit) {
    return function (state, element, key, value) {
      stateObserve(state, observe, value, function (value) {
        setProperty(element, key, value);
        return unit;
      });
    };
  };
};


exports.unsafePropertyImpl = function (setProperty) {
  return function (key) {
    return function (value) {
      return function (state, info) {
        if (info.properties[key] == null) {
          info.properties[key] = true;

        } else {
          throw new Error("Property already exists \"" + key + "\"");
        }

        return setProperty(state, info.element, key, value);
      };
    };
  };
};


// TODO receive the style rather than the element
exports.unsafeSetStyleValue = function (state, element, key, value, important) {
  setStyle(element.style, key, value, important);
};


exports.unsafeSetStyleView = function (observe) {
  return function (unit) {
    // TODO receive the style rather than the element
    return function (state, element, key, value, important) {
      stateObserve(state, observe, value, function (value) {
        setStyle(element.style, key, value, important);
        return unit;
      });
    };
  };
};
