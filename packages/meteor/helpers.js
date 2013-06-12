// XXX namespacing -- find a better home for these?

if (Meteor.isServer)
  var Future = Npm.require('fibers/future');

if (typeof __meteor_runtime_config__ === 'object' &&
    __meteor_runtime_config__.meteorRelease)
  Meteor.release = __meteor_runtime_config__.meteorRelease;

_.extend(Meteor, {
  // _get(a,b,c,d) returns a[b][c][d], or else undefined if a[b] or
  // a[b][c] doesn't exist.
  _get: function (obj /*, arguments */) {
    for (var i = 1; i < arguments.length; i++) {
      if (!(arguments[i] in obj))
        return undefined;
      obj = obj[arguments[i]];
    }
    return obj;
  },

  // _ensure(a,b,c,d) ensures that a[b][c][d] exists. If it does not,
  // it is created and set to {}. Either way, it is returned.
  _ensure: function (obj /*, arguments */) {
    for (var i = 1; i < arguments.length; i++) {
      var key = arguments[i];
      if (!(key in obj))
        obj[key] = {};
      obj = obj[key];
    }

    return obj;
  },

  // _delete(a, b, c, d) deletes a[b][c][d], then a[b][c] unless it
  // isn't empty, then a[b] unless it isn't empty.
  _delete: function (obj /*, arguments */) {
    var stack = [obj];
    var leaf = true;
    for (var i = 1; i < arguments.length - 1; i++) {
      var key = arguments[i];
      if (!(key in obj)) {
        leaf = false;
        break;
      }
      obj = obj[key];
      if (typeof obj !== "object")
        break;
      stack.push(obj);
    }

    for (var i = stack.length - 1; i >= 0; i--) {
      var key = arguments[i+1];

      if (leaf)
        leaf = false;
      else
        for (var other in stack[i][key])
          return; // not empty -- we're done

      delete stack[i][key];
    }
  },

  // XXX should take a `this` argument? so far doing a lot of
  // _wrapAsync(foo.bar).call(foo)
  // XXX CAVEATS: can't pass a non-callback function as the last argument.
  // Removes any arguments that are undefined.
  // To be sure that fn can be used with _wrapAsync,
  //   - fn should not take any function arguments except the callback
  //   - if fn's last given defined argument is a function, then fn should treat
  //     that as the callback. fn(x, y, z, undefined, ..., undefined) should
  //     treat z as the callback if z is a function.
  _wrapAsync: function (fn) {
    return function (/* arguments */) {
      var self = this;
      var fut;
      var logErr = function (e) {
        if (e)
          Meteor._debug("Exception in callback of async function", e.stack);
      };
      var newArgs = Array.prototype.slice.call(arguments);
      var callback;

      while (newArgs.length &&
             typeof(newArgs[newArgs.length - 1]) === "undefined")
        newArgs.pop();

      if (newArgs.length && newArgs[newArgs.length - 1] instanceof Function) {
        callback = newArgs.pop();
      } else {
        if (Meteor.isClient) {
          callback = logErr;
        } else {
          fut = new Future();
          callback = fut.resolver();
        }
      }
      newArgs.push(Meteor.bindEnvironment(callback, logErr));
      fn.apply(self, newArgs);
      if (fut)
        return fut.wait();
      return undefined;
    };
  }
});
