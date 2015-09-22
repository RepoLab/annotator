"use strict";

var Widget = require('../../../ui/widget').Widget,
    util = require('../../../util');

var $ = util.$;
var _t = util.gettext;

var NS = 'annotator-adder';


// Adder shows and hides an annotation adder button that can be clicked on to
// create an annotation.
var Adder = Widget.extend({

    // Public: Load an annotation.
    // Returns nothing.
    load: function (annotation, position) {
        this.annotation = annotation;
    }
});


exports.Adder = Adder;
