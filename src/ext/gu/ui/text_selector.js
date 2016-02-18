"use strict";

var $ = require('jquery');

var Range = require('xpath-range').Range;

var util = require('../../../util');

var TEXTSELECTOR_NS = 'annotator-textselector';

// isAnnotator determines if the provided element is part of Annotator. Useful
// for ignoring mouse actions on the annotator elements.
//
// element - An Element or TextNode to check.
//
// Returns true if the element is a child of an annotator element.
function isAnnotator(element) {
    var elAndParents = $(element).parents().addBack();
    return (elAndParents.filter('[class^=annotator-]').length !== 0);
}


// TextSelector monitors a document (or a specific element) for text selections
// and can notify another object of a selection event
function TextSelector(options) {
    this.document_element = options.document_element;
    this.html_document_element = this.document_element.get(0);
    this.options = $.extend(true, {}, TextSelector.options, options);

    if (typeof this.html_document_element.ownerDocument !== 'undefined' &&
        this.html_document_element.ownerDocument !== null) {
        var self = this;
        this.document = this.html_document_element.ownerDocument;

        this.document_element
          .on("mouseup." + TEXTSELECTOR_NS, function (e) {
              self._checkForEndSelection(e);
              self._mouseDownEvent = null;
          })
          .on("mousedown." + TEXTSELECTOR_NS, function (e) {
            self._mouseDownEvent = e;
          });
    } else {
        console.warn("You created an instance of the TextSelector on an " +
                     "element that doesn't have an ownerDocument. This won't " +
                     "work! Please ensure the element is added to the DOM " +
                     "before the plugin is configured:", this.html_document_element);
    }
}


// Configuration options
TextSelector.options = {
    // Callback, called when the user makes a selection.
    // Receives the list of selected ranges (may be empty) and  the DOM Event
    // that was detected as a selection.
    onSelection: null,
    addl_fields: {}
};


$.extend(TextSelector.prototype, {

  // employ a broadcast/listener pattern,
  // borrowing their callback.
  onSelection: function (selectedRanges, event) {
    var e;
    if (selectedRanges.length) {
      var ann_fields = { ranges: selectedRanges };
      // add any annotation fields specified in options.
      for (var addl_field in this.options.addl_fields) {
        ann_fields[addl_field] = this.options.addl_fields[addl_field];
      }
      e = $.Event("text-selected", { ann: ann_fields });
    } else {
      e = $.Event("text-deselected");
    }
    e = $.extend(event, e);
    this.document_element.trigger(e);
  },

  destroy: function () {
      if (this.document) {
          $(this.document.body).off("." + TEXTSELECTOR_NS);
      }
  },

  // Public: capture the current selection from the document, excluding any nodes
  // that fall outside of the adder's `element`.
  //
  // Returns an Array of NormalizedRange instances.
  captureDocumentSelection: function () {
      var i,
          len,
          ranges = [],
          rangesToIgnore = [],
          selection = global.getSelection();

      if (selection.isCollapsed) {
          return [];
      }

      for (i = 0; i < selection.rangeCount; i++) {
          var r = selection.getRangeAt(i),
              browserRange = new Range.BrowserRange(r),
              normedRange = browserRange.normalize().limit(this.html_document_element);

          // If the new range falls fully outside our this.html_document_element, we should
          // add it back to the document but not return it from this method.
          if (normedRange === null) {
              rangesToIgnore.push(r);
          } else {
              ranges.push(normedRange);
          }
      }

      // BrowserRange#normalize() modifies the DOM structure and deselects the
      // underlying text as a result. So here we remove the selected ranges and
      // reapply the new ones.
      selection.removeAllRanges();

      for (i = 0, len = rangesToIgnore.length; i < len; i++) {
          selection.addRange(rangesToIgnore[i]);
      }

      // Add normed ranges back to the selection
      for (i = 0, len = ranges.length; i < len; i++) {
          var range = ranges[i],
              drange = this.document.createRange();
          drange.setStartBefore(range.start);
          drange.setEndAfter(range.end);
          selection.addRange(drange);
      }


      return ranges;
  },

  // Event callback: called when the mouse button is released. Checks to see if a
  // selection has been made and if so displays the adder.
  //
  // event - A mouseup Event object.
  //
  // Returns nothing.
  _checkForEndSelection: function (event) {
      var self = this;
    
      if (self._mouseDownEvent) {
        event._startOfSelectionEvent = self._mouseDownEvent;
      }

      var _nullSelection = function () {
          if (typeof self.onSelection === 'function') {
              self.onSelection([], event);
          }
      };

      // Get the currently selected ranges.
      var selectedRanges = this.captureDocumentSelection();
      if (selectedRanges.length === 0) {
          _nullSelection();
          return;
      } else if (selectedRanges.length === 1) {
        // case of a single, blank text node selected (eg; a space between words).
        var selectedRange = selectedRanges[0];
        if ((selectedRange.start === selectedRange.end) && selectedRange.start.data.trim() === "") {
          _nullSelection();
          return;
        }
      }

      // Don't show the adder if the selection was of a part of Annotator itself.
      for (var i = 0, len = selectedRanges.length; i < len; i++) {
          var container = selectedRanges[i].commonAncestor;
          if ($(container).hasClass('annotator-hl')) {
              container = $(container).parents('[class!=annotator-hl]')[0];
          }
          if (isAnnotator(container)) {
              _nullSelection();
              return;
          }
      }

      if (typeof this.onSelection === 'function') {
          this.onSelection(selectedRanges, event);
      }
  }
});


exports.TextSelector = TextSelector;
