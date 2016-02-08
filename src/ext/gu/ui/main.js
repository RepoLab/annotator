/*package annotator.ext.gu.ui */
"use strict";

var $ = require('jquery');

var inflector = require('../inflector/lib/inflector');

// var TextSelector = require('./text_selector').TextSelector; // use default whenever possible.
// var LineNbrTextSelector = require('./line_nbr_text_selector').LineNbrTextSelector; // ours. for poetry line nbrs -- select line.
// var Editor = require('./editor').Editor; // need radically different UI.
// var Highlighter = require('./highlighter').Highlighter; // need our own, to better handle temp highlights when editor comes up.
// var Viewer = require('./viewer').Viewer; // need radically different UI.
// var BlocksManager = require('./blocks_manager').BlocksManager; // our own markers, not in default UI.

require('./text_selector')
require('./line_nbr_text_selector')
require('./editor')
require('./highlighter')
require('./viewer')
require('./blocks_manager')

var Range = require('xpath-range').Range;

var editor_class = "annotator-editor";


// trim strips whitespace from either end of a string.
//
// This usually exists in native code, but not in IE8.
function trim(s) {
    if (typeof String.prototype.trim === 'function') {
        return String.prototype.trim.call(s);
    } else {
        return s.replace(/^[\s\xA0]+|[\s\xA0]+$/g, '');
    }
}


/*
 * app.include(annotator.ui);
 *
 * Provides a user interface for Annotator that allows
 * users to create annotations by selecting text within (a part of) the
 * document.
 */
var UI_DEFAULTS = {
  document_element: $("section#content")
}

var UI = exports.ui = function (options) {
    options = options || {};
    var document_element = options.document_element = (options.document_element || UI_DEFAULTS.document_element);
    
    // create modules as specified.
    var option_keys = Object.keys(options);
    var ith_key,
        module_name,
        module_fn,
        module_options;
    var shared_options = {};
        
    // trap all the options we will pass to module specs.
    for (var i=0; i < option_keys.length; i++) {
      ith_key = option_keys[i];
      if (ith_key.indexOf("/") == -1) {
        shared_options[ith_key] = options[ith_key];
        delete options[ith_key];
      }
    }
    
    // the remaining options are module specs.
    for (var i=0; i < option_keys.length; i++) {
      ith_key = option_keys[i];

      try {
        if (ith_key.indexOf("/") > -1) {
          module_name = ith_key.split("/").pop();
          module_fn = require(ith_key)[module_name.camelize()];
          module_options = options[ith_key];
          if (module_options === true) { module_options = {}; }
          UI[module_name] = new (module_fn)($.extend(module_options, shared_options));
        }
      } catch (e) {
        console.log("Could not create module " + module_name + ".", e);
      }
    }
    
    // initialize components. have them each render any DOM elements they need.
    // a function w this name gets called by the app, with the app object passed in.
    var api = {
        start: function (app) {
            var store = app.registry.getUtility('storage');
            
            // listen for text selection events (initiated by user or by program) to start an annotation.
            // I know it looks dumb to declare a broadcaster and then its listener in the same scope,
            // but I'm not the only listener, and this guarantees the right sequence of events.
            document_element
              .on("text-selected", function (evt) {
                var ann = api.makeAnnotation(evt);

                // safeguard against annotations that are not associated with text selections.
                if (!ann || !ann.ranges || !ann.ranges.length) { return; }
            
                // announce that a new annotation is ready to be edited.
                var pageX, pageY;
                if (evt.hasOwnProperty("_startOfSelectionEvent") && evt._startOfSelectionEvent.pageY < evt.pageY) {
                  pageX = evt._startOfSelectionEvent.pageX;
                  pageY = evt._startOfSelectionEvent.pageY;
                } else {
                  pageX = evt.pageX;
                  pageY = evt.pageY;
                }
                var e = $.Event("new-annotation", { annotation: ann, position: { left: pageX, top: pageY } });
                document_element.trigger(e);
              })
              .on("save-new-annotation", function (evt) {
                delete evt.annotation["_local"];
                store.create(evt.annotation).then(api.sendStoreMessage);
              })
              .on("update-annotation", function (evt) {
                delete evt.annotation["_local"];
                store.update(evt.annotation).then(api.sendStoreMessage);
              })
              .on("delete-annotation", function (evt) {
                delete evt.annotation["_local"];
                store.delete(evt.annotation).then(function (msg_obj, state, xhr) {
                  // api.sendStoreMessage(msg_obj, state, xhr, evt.annotation);
                });
              });
        },
        
        sendStoreMessage: function (options, state, xhr, ann) {
          if (options && options.hasOwnProperty("message")) {
            alert(options.message);
          }
          if (state === "success") {
            switch (xhr._action) {
              case "destroy":
                var e = $.Event("annotation-deleted", { ann: ann });
                document_element.trigger(e);
                break;

              case "create":
                var e = $.Event("annotation-created", { ann: ann });
                document_element.trigger(e);
                break;
            }
          }
          console.log(arguments);
        },
    
        // create the basic structure of an annotation from the ranges of the selected text.
        makeAnnotation: function (evt) {
          try {
            var ranges = evt.ranges;
          } catch (e) {
            console.log(e, evt)
            ranges = []
          }
          
            var text = [],
                serializedRanges = [];
            var browser_range, serialized_range;
            var highlight_class = UI.highlighter.highlight_class || null;

            for (var i = 0, len = ranges.length; i < len; i++) {
                var r = ranges[i];
                var html_document_element = document_element.get(0);  // HTMLElement, not jQuery.
                if (!(r instanceof Range.NormalizedRange)) {
                  browser_range = new Range.BrowserRange(r);
                  r = browser_range.normalize().limit(html_document_element);
                }
                text.push(trim(r.text()));
                serialized_range = r.serialize(html_document_element, highlight_class);
                serializedRanges.push(serialized_range);
            }

            var ann = {
                quote: text.join(' / '),
                ranges: serializedRanges
            };
            
            return ann;
        }
    }
    
    // this is because annotator is expecting an object of functions.
    $.extend(UI, api);
    
    return api;
}