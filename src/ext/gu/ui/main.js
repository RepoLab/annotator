/*package annotator.ext.gu.ui */
"use strict";

var $ = window.$ || require('jquery');

var inflector = require('../inflector/lib/inflector');

require('./text_selector')
require('./line_nbr_text_selector')
require('./editor')
require('./highlighter')
require('./viewer')
require('./blocks_manager')

var Range = require('xpath-range').Range;

var editor_class = "annotator-editor";

var all_events = "document-element-changed text-selected text-deselected new-annotation annotation-created save-new-annotation edit-annotation update-annotation annotation-updated delete-annotation annotation-deleted annotations-retrieved annotation-deleted annotation-created editor-opened editor-closed viewer-opened annotation-rendered annotation-selected viewer-closed";


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
  document_element: $("section#content"),
  document_id: 0
}

var UI = exports.ui = function (options) {
    options = options || {};
    UI.document_element = options.document_element || UI_DEFAULTS.document_element;
    UI.document_id = options.document_id || UI_DEFAULTS.document_id;
        
    // initialize components. have them each render any DOM elements they need.
    // a function w this name gets called by the app, with the app object passed in.
    var api = {
        start: function (app) {
            UI.app = app;
            
            // create modules as specified.
            var option_keys = Object.keys(options);
            var ith_key,
                module,
                module_name,
                module_class,
                module_options;
            
            // allow sub-modules access to the app.
            var shared_options = { app: app };
            
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

              if (ith_key.indexOf("/") > -1) {
                module_name = ith_key.split("/").pop();
                module_options = options[ith_key];
                if (module_options === true) { module_options = {}; }
                module_options = $.extend(module_options, shared_options);
                try {
                    module = require([ith_key]);
                    module_class = module[module_name.camelize()];
                } catch (e) {
                  try {
                    module_class = window[module_name.camelize()];
                  } catch (ee) {
                    console.log("Could not create module " + module_name + ".", ee);
                    break;
                  }
                } finally {
                  module = UI[module_name] = new (module_class)(module_options);
                  // instantiate the module, if nec.
                  if (module["start"] && typeof module.start === "function") {
                    module.start(app);
                  }
                }
              }
            }
            
            this.setDocument(UI.document_element, UI.document_id);
        },
        
        sendStoreMessage: function (options) {
          if (options && options.hasOwnProperty("message")) {
            alert(options.message);
          };
        },
    
        // create the basic structure of an annotation from the ranges of the selected text.
        makeAnnotation: function (ann) {
          try {
            var ranges = ann.ranges;
          } catch (e) {
            console.log(e, ann)
            ranges = []
          }
          
            var text = [],
                serializedRanges = [];
            var browser_range, serialized_range;
            var highlight_class = UI.highlighter.highlight_class || null;

            for (var i = 0, len = ranges.length; i < len; i++) {
                var r = ranges[i];
                var html_document_element = UI.document_element.get(0);  // HTMLElement, not jQuery.
                if (!(r instanceof Range.NormalizedRange)) {
                  browser_range = new Range.BrowserRange(r);
                  r = browser_range.normalize().limit(html_document_element);
                }
                text.push(trim(r.text()));
                serialized_range = r.serialize(html_document_element, highlight_class);
                serializedRanges.push(serialized_range);
            }
            
            ann = $.extend(ann, {
                quote: text.join(' / '),
                ranges: serializedRanges
            });
            
            return ann;
        },
        
        setDocument: function (new_document_element, document_id) {
          // we have to issue the event before changing the document,
          // as events are associated with it.
          var old_document_element = UI.document_element;
          
          UI.document_element = new_document_element;
          UI.document_id = document_id;
          var e = $.Event("document-element-changed", 
                                        { 
                                           new_document_element: new_document_element,
                                           document_id: document_id
                                        });
          old_document_element.trigger(e);
          this.setDocumentEvents(this);
        },
        
        setDocumentEvents: function () {
          var store = UI.app.registry.getUtility('storage');
          // allow for changing underlying doc from which annotations are created.
          if (typeof store._urlFor == "function") {
            var base_urlFor = store._urlFor.bind(store);
            store._urlFor = function (action, id) {
              var url = base_urlFor(action, id);
              return url.replace(/\{doc-id\}/, UI.document_id);
            }
          }
          
          // listen for text selection events (initiated by user or by program) to start an annotation.
          // I know it looks dumb to declare a broadcaster and then its listener in the same scope,
          // but I'm not the only listener, and this guarantees the right sequence of events.
          UI.document_element
            .on("text-selected", function (evt) {
              var ann = api.makeAnnotation(evt.annotation);

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
              UI.document_element.trigger(e);
            })
            .on("save-new-annotation", function (evt) {
              // remove _local from annotation_to_save, 
              // but keep that as part of the annotation passed into events.
              var annotation_to_save = {};
              $.extend(annotation_to_save, evt.annotation);
              delete annotation_to_save["_local"];
              store.create(annotation_to_save).then(function () {
                api.sendStoreMessage();
                var e = $.Event("annotation-created", { annotation: evt.annotation });
                self.document_element.trigger(e);
              });
            })
            .on("update-annotation", function (evt) {
              // remove _local from annotation_to_update, 
              // but keep that as part of the annotation passed into events.
              var annotation_to_update = {};
              $.extend(annotation_to_update, evt.annotation);
              delete annotation_to_update["_local"];
              store.update(annotation_to_update).then(function () {
                api.sendStoreMessage();
                var e = $.Event("annotation-updated", { annotation: evt.annotation });
                UI.document_element.trigger(e);
              });
            })
            .on("delete-annotation", function (evt) {
              // remove _local from annotation_to_delete, 
              // but keep that as part of the annotation passed into events.
              var annotation_to_delete = {};
              $.extend(annotation_to_delete, evt.annotation);
              delete annotation_to_delete["_local"];
              store.delete(evt.annotation).then(function (msg_obj, state, xhr) {
                var e = $.Event("annotation-deleted", { annotation: evt.annotation });
                UI.document_element.trigger(e);
              });
            });
        }
    }
    
    // this is because annotator is expecting an object of functions.
    $.extend(UI, api);
    
    return api;
}