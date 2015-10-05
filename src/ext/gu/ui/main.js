/*package annotator.ext.gu.ui */
"use strict";

var TextSelector = require('../../../ui/textselector').TextSelector; // use default whenever possible.
var Editor = require('./editor').Editor; // need radically different UI.
var Highlighter = require('./highlighter').Highlighter; // need our own, to better handle temp highlights when editor comes up.
var Viewer = require('./viewer').Viewer; // need radically different UI.
var counters = require('./counters'); // our own markers, not in default UI.

var Range = require('xpath-range').Range;

var highlight_class = "annotator-hl";
var temp_highlight_class = "annotator-hl-temporary";

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
var UI = exports.ui = function (options) {
    options = options || {};
    var element = options.element || global.document.body;
    var interactionPoint = null;
    
    // initialize components. have them each render any DOM elements they need.
    // a function w this name gets called by the app, with the app object passed in.
    var functions = {
        start: function (app) {
            UI.app = app;
        
            UI.editor = new Editor({ element: element });
            UI.viewer = new Viewer({ element: element });
            UI.highlighter = new Highlighter(element);
            UI.textselector = new TextSelector(element);
            
            UI.temp_anns = [];
            
            // employ a broadcast/listener pattern,
            // borrowing their callback.
            UI.textselector.onSelection = function (selectedRanges, event) {
              if (selectedRanges.length) {
                var e = $.Event("text-selected", { ranges: selectedRanges });
                e = $.extend(event, e);
                $(element).trigger(e);
              }
            }
            
            // listen for text selection events (initiated by user or by program) to start an annotation.
            // I know it looks dumb to declare a broadcaster and then its listener in the same scope,
            // but I'm not the only listener, and this guarantees the right sequence of events.
            $(element).on("text-selected", function (evt) {
              // unhighlight any temp highlights. & replace temp ann's with a new one.
              UI.highlighter.undrawAll(UI.temp_anns);
              var new_ann = functions.makeAnnotation(evt)
              UI.temp_anns.push(new_ann);
              
              // once we've made the temp 'selection' with our highlighter,
              // nix the real selection.
              var selection = global.getSelection();
              selection.removeAllRanges();
            });
            
            // control what happens when an annotation gets created.
            $(element).on("new-annotation", function (evt) {
              var ann = evt.annotation;
              if (!ann || ! ann.ranges || !ann.ranges.length) { return; }
              UI.highlighter.draw(ann, temp_highlight_class);
              // UI.editor.load(ann, {});
            });
        },

        // tell each component to destroy whatever DOM elements it has created.
        // a function w this name gets called by the app.
        destroy: function () {
            UI.editor.destroy();
            UI.highlighter.destroy();
            UI.textselector.destroy();
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
                if (!(r instanceof Range.NormalizedRange)) {
                  browserRange = new Range.BrowserRange(r),
                  r = browserRange.normalize().limit(element);
                }
                text.push(trim(r.text()));
                serializedRanges.push(r.serialize(element, highlight_class));
            }

            var ann = {
                quote: text.join(' / '),
                ranges: serializedRanges
            };
            
            // announce that a new annotation is ready to be edited.
            var e = $.Event("new-annotation", { annotation: ann });
            $(element).trigger(e);
            
            return ann;
        }
    }
    
    // this weirdness is because annotator is expecting an object of functions.
    $.extend(UI, functions);
    
    return functions;
}