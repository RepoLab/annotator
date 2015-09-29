"use strict";

var Widget = require('../../../ui/widget').Widget,
    util = require('../../../util');

var $ = util.$;
var _t = util.gettext;

var NS = 'annotator-adder';


// Adder shows and hides an annotation adder button that can be clicked on to
// create an annotation.
var Adder = Widget.extend({
  
    constructor: function (options) {
      Widget.call(this, options);
      this.annotation = null;

      this.onCreate = this.options.onCreate;
    },

    // Public: Load an annotation.
    // Returns nothing.
    load: function (annotation, position) {
        this.annotation = annotation;
        if (this.annotation !== null && typeof this.onCreate === 'function') {
            this.onCreate(this.annotation, event);
        }
    }
});


exports.Adder = Adder;