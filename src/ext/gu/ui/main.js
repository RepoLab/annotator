/*package annotator.ext.gu.ui */
"use strict";

var $ = require('jquery');

var TextSelector = require('./textselector').TextSelector; // use default whenever possible.
var LineNbrTextSelector = require('./linenbr_textselector').LineNbrTextSelector; // ours. for poetry line nbrs -- select line.
var Editor = require('./editor').Editor; // need radically different UI.
var Highlighter = require('./highlighter').Highlighter; // need our own, to better handle temp highlights when editor comes up.
var Viewer = require('./viewer').Viewer; // need radically different UI.
var BlocksManager = require('./blocks').BlocksManager; // our own markers, not in default UI.

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
    var document_element = options.document_element = $(options.document_element || UI_DEFAULTS.document_element);
    
    var interactionPoint, linenbr_selector;
    
    // initialize components. have them each render any DOM elements they need.
    // a function w this name gets called by the app, with the app object passed in.
    var api = {
        start: function (app) {
            UI.app = app;
        
            UI.editor = new Editor(options);
            UI.viewer = new Viewer(options);
            UI.highlighter = new Highlighter(options);
            UI.text_selector = new TextSelector(options);
            UI.blocks_manager = new BlocksManager(options);
            
            if (options.hasOwnProperty("linenbr_selector")) {
              UI.linenbr_textselector = new LineNbrTextSelector(options);
            }
            
            var get_counts_fn = UI.blocks_manager.getCounts.bind(UI.blocks_manager);
            
            var store = app.registry.getUtility('storage');
            
            // employ a broadcast/listener pattern,
            // borrowing their callback.
            UI.text_selector.onSelection = function (selectedRanges, event) {
              var e;
              if (selectedRanges.length) {
                e = $.Event("text-selected", { ranges: selectedRanges });
              } else {
                e = $.Event("text-deselected");
              }
              e = $.extend(event, e);
              $(document_element).trigger(e);
            }
            
            // listen for text selection events (initiated by user or by program) to start an annotation.
            // I know it looks dumb to declare a broadcaster and then its listener in the same scope,
            // but I'm not the only listener, and this guarantees the right sequence of events.
            $(document_element)
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
                $(document_element).trigger(e);
              
                // once we've made the temp 'selection' with our highlighter,
                // nix the real selection.
                var selection = global.getSelection();
                selection.removeAllRanges();
              })
              .on("save-new-annotation", function (evt) {
                delete evt.annotation["_local"];
                store.create(evt.annotation).then(get_counts_fn);
              })
              .on("update-annotation", function (evt) {
                delete evt.annotation["_local"];
                store.update(evt.annotation).then(get_counts_fn);
              })
              .on("delete-annotation", function (evt) {
                delete evt.annotation["_local"];
                store.delete(evt.annotation).then(function (obj, status, xhr) {
                  if (status == "success") {
                    if (obj.message) { alert(obj.message); }
                    UI.viewer.close();
                    get_counts_fn();
                  }
                });
              });
        },

        // tell each component to destroy whatever DOM elements it has created.
        // a function w this name gets called by the app.
        destroy: function () {
            UI.editor.destroy();
            UI.highlighter.destroy();
            UI.text_selector.destroy();
            UI.viewer.destroy();
            UI.counters.destroy();
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

            for (var i = 0, len = ranges.length; i < len; i++) {
                var r = ranges[i];
                var browserRange;
                var html_document_element = document_element.get(0);  // HTMLElement, not jQuery.
                if (!(r instanceof Range.NormalizedRange)) {
                  browserRange = new Range.BrowserRange(r);
                  r = browserRange.normalize().limit(html_document_element);
                }
                text.push(trim(r.text()));
                serializedRanges.push(r.serialize(html_document_element, UI.highlighter.highlight_class || null));
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