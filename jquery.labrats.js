/**
 * jQuery Plugin for helping with browser-based Multivariate Testing
 * (c) 2013, Howard Abrams <howard.abrams@gmail.com> and others.
 * See LICENSE.txt for details.
 *
 * The primary function is the `$.labrats()` function, however, other
 * supporting functions may be called for fine-grained control/information.
 */

(function( $ ){

   /**
    * Calls a function based on an assigned test group for a user.
    * The identification key for the user (as well as the name(s) of
    * the test) can be passed in as function arguments along with two
    * or more callback functions (note that their order matters).
    *
    * For instance, for a test that splits the user accounts into three
    * groups, you could do:
    *
    *     $.labrats.configure( { numGroups: 3 } ); // Optional
    *     $.labrats(userid, "Some Test", fn1, fn2, fn3);
    *
    * The other approach to calling this function is with named parameters.
    * For instance, the same example could be written:
    *
    *     $.labrats({ key: userid, name: "Some Test", numGroups:3,
    *                 callbacks: [ fn1, fn2, fn3 ] });
    *
    * This function returns the results of calling one of the callback
    * functions.
    *
    * Note: The size of available pool for tests can be limited (effectively
    * creating a a pool of people in test groups and another control
    * group).  For instance:
    *
    *    $.labrats.group( { key: userId, name: "Another Test", subset: 10,
    *                       callbacks: [ fn1, fn2, fn3 ],
    *                       control: fn4 });
    *
    * Will call the `control` function if the user is part of the 90%
    * control group, otherwise, it calls the appropriate function in
    * the `callbacks` array.
    */

   $.labrats = function(params) {
     // Save off the original numgroups setting...
     var origNumGroups = $.labrats.settings.numGroups;

     if (typeof params === 'object') {
       // The number of groups should be the number of callbacks
       $.labrats.settings.numGroups = params.callbacks.length;

       // Use the new numGroup setting:
       var groupnum = $.labrats.group(params);

       $.labrats.settings.numGroups = origNumGroups;

       if (groupnum == -1) {    // User is part of the control group
         return params.control.apply(this, [groupnum]);
       }
       else {
         return params.callbacks[groupnum].apply(this, [groupnum]);
       }
     }
     else {
       var keys  = [];
       var funcs = [];

       for (var i = 0; i < arguments.length; i++) {
         if (typeof arguments[i] === 'function') {
           funcs.push (arguments[i]);
         }
         else {
           keys.push (arguments[i]);
         }
       }

       // The number of groups should be the number of callbacks
       $.labrats.settings.numGroups = funcs.length;

       var groupnum = $.labrats.group(keys);

       $.labrats.settings.numGroups = origNumGroups;

       if (funcs[groupnum]) {
         return funcs[groupnum].apply(this, [groupnum]);
       }
       else {
         throw("No callback function given for group number: "+groupnum);
       }
     }
   };

   /**
    * Behaves like the utility function, `$.labrats()`, but the callback
    * function is given the jQuery selector results. This allows the callback
    * function to behave as part of a jQuery chain. For instance:
    *
    *     function fn1() {
    *        return this.addClass("shiny-red");
    *     };
    *     function fn2() {
    *        return this.addClass("flashy-blue");
    *     };
    *
    *     var testCfg = { key: id1, callbacks: [ fn1, fn2 ] };
    *     $("#logo-test").labrats(testCfg).click(...);
    *
    * **Note:** Only *named parameters* work as arguments.
    */

   $.fn.labrats = function(params) {
     return $.labrats.apply(this, [params]);
   };

   /**
    * Determines the *group number* assigned to a given user. The number
    * of groups can be specified using the `configure()` function (see below).
    * The user's `key` is passed in as the parameter, but this should
    * also take the name of the test as well.
    *
    * This can either be specified as parameters, as in:
    *
    *     $.labrats.group( userID, "Large Logo Test" );
    *
    * Or as a series of keys in an array. The following is equivalent:
    *
    *     $.labrats.group( [ userID, "Large Logo Test" ] );
    *
    * Or as a collection of named parameters:
    *
    *     $.labrats.group( { key: userID, name: "Large Logo Test",
    *                        numGroups: 2 } );
    *
    * **Note:** This last approach allows you to specify the number of
    * groups (instead of calling the `configure()` function).
    *
    * You can limit the size of available pool (effectively creating a
    * a pool of people in test groups and another *control group*).  For
    * instance:
    *
    *     $.labrats.group( { key: userId, name: "Another Test",
    *                        numGroups: 2, subset: 10 });
    *
    * Will return `-1` if the user is part of the 90% control group,
    * otherwise, it returns either `0` or `1` if it is in one of the
    * 5% sized test groups.
    */

   $.labrats.group = function(params) {
     var key, controlValue,
         numGroups = $.labrats.settings.numGroups,
         subset = 100;

     if ($.isArray(params)) {
       key = $.labrats.key(params);
     }
     else if (typeof params === 'object') {
       if (params.key) {
         key = params.key + params.name;
       }
       else {
         key = $.labrats.getId() + params.name;
       }
       numGroups = params.numGroups || numGroups;

       if (params.subset) {
         subset = params.subset;
         controlValue =
           $.labrats.settings.hash(key) % 100;
       }
     }
     else {
       key = $.labrats.key(arguments);
     }

     if (!key) {
       // Still no key? Use random number stored in cookie
       key = $.labrats.getId();
     }

     if (controlValue && controlValue > subset) {
       return -1;  // In the control group...
     }
     else {
       return $.labrats.settings.hash(key) % numGroups;
     }
   };

   /**
    * A test to see if a particular 'key' is part of the given group.
    * Returns `true` if a given key is in the group number, `false`
    * otherwise.
    *
    * This function can be called either with named parameters, as in:
    *
    *     $.labrats.inGroup( 2, { key: userid, name: testname }
    *
    * Where the first argument is the group number to check, and the
    * second argument is an object similar to what is passed to the
    * `$.labrats.group()` function, including:
    *
    *   - `key` is the identification of the user
    *   - `name` is the test's name
    *   - `subset` is the size of the pool, where `100 - subset` is the size of the control group
    *
    * This function can also be called as a series of parameters:
    *
    *     $.labrats.inGroup( 2, userid, testname )
    */

   $.labrats.inGroup = function(groupnum, opts) {
     if (typeof opts === 'object') {
       return $.labrats.group(opts) === groupnum;
     }
     else {
       var args = Array.prototype.slice.call(arguments);
       var groupnum = args.shift();
       return $.labrats.group(args) == groupnum;
     }
   };

   /**
    * Converts a series of arguments into a *key* to use in a
    * hash. Each function may call this using a few formats.
    * For instance, as a series of string arguments:
    *
    *     var key = $.labrats.key("test", "abc", id);
    *
    * or as an array:
    *
    *     var key = $.labrats.key([id, "test", "abc"]);
    *
    * or even as the function's arguments:
    *
    *     var key = $.labrats.key(arguments);
    */

   $.labrats.key = function(a) {
     var params;
     if ($.isArray(a)) {
       params = a;
     }
     else if (typeof a === 'object') {
       params = arguments[0];
     }
     else {
       params = arguments;
     }

     var key = params[0];
     for (var i = 1; i < params.length; i++) {
       if (params[i]) {
         switch (typeof params[i]) {
           case "string":
             key += params[i];
             break;
           case "function":
             break;
           default:
             key += params[i].toString();
         }
       }
     }
     return key;
   };

   /**
    * Sets a particular cookie with a given key and value. Both values
    * will be escaped.
    */

   function setCookie(key,value) {
     document.cookie = escape(key) + "=" + escape(value);
   }

   /**
    * Simple function for retrieving a particular cookie by its key.
    * If the cookie has not be set, then this returns null.
    */

   function getCookie(key) {
     return unescape(document.cookie.replace(new RegExp("(?:(?:^|.*;\\s*)" +
                                                        escape(key).replace(/[\-\.\+\*]/g, "\\$&") +
                                                        "\\s*\\=\\s*((?:[^;](?!;))*[^;]?).*)|.*"), "$1")) || null;
   }

   /**
    * Returns an unique identification for the current user's browser.
    * If this is the first time a user has seen the application, we
    * generate a new ID (as a random number), otherwise, we return the
    * ID stored in a cookie.
    */

   $.labrats.getId = function() {
     var label = 'labrats_userID',
            id = getCookie(label);
     if (id == null) {
       id = Math.floor( Math.random() * 100000000 ).toString();
       setCookie(label, id);
     }
     return id;
   };

   /**
    * Configuration settings begins with 'default values'. However,
    * the 'configure()' function can be called with a map of key/value
    * pairs to override any of these settings.
    */

   $.labrats.settings = {

     // This hash function is pretty stupid, and should NOT be used.
     // However, if you are just playing around with this project... fine.
     hash: function(key) {
       var results = 0;
       for(c in key) {
         results += ( key.charCodeAt(c) << c);
       }
       // console.log("Key:", key, "Hash:", results);
       return Math.abs(results);
     }
   };

   /**
    * This function allows a single object to overwrite some, but not
    * all configuration values. Acceptable values include:
    *
    *  - `hash`: A function used to convert a user ID key and test name into a number
    *  - `numGroups`: The number of test groups to divide the user pool
    */

   $.labrats.configure = function(config) {
     for (var key in config) {
       if (config.hasOwnProperty(key)) {
         $.labrats.settings[key] = config[key];
       }
     }
   };

 })( jQuery );
