"use strict";

var $ = window.$ || require('jquery');

var Range = require('xpath-range').Range;

var util = require('../../../util');

var Promise = util.Promise;


// highlightRange wraps the DOM Nodes within the provided range with a highlight
// element of the specified class and returns the highlight Elements.
//
// normedRange - A NormalizedRange to be highlighted.
// cssClass - A CSS class to use for the highlight (default: 'annotator-hl')
//
// Returns an array of highlight Elements.
function highlightRange(normedRange, cssClass) {
    if (typeof cssClass === 'undefined' || cssClass === null) {
        cssClass = 'annotator-hl';
    }
    var white = /^\s*$/;

    // Ignore text nodes that contain only whitespace characters. This prevents
    // spans being injected between elements that can only contain a restricted
    // subset of nodes such as table rows and lists. This does mean that there
    // may be the odd abandoned whitespace node in a paragraph that is skipped
    // but better than breaking table layouts.
    var nodes = normedRange.textNodes(),
        results = [];
    for (var i = 0, len = nodes.length; i < len; i++) {
        var node = nodes[i];
        if (!white.test(node.nodeValue)) {
            var hl = global.document.createElement('span');
            hl.className = cssClass;
            node.parentNode.replaceChild(hl, node);
            hl.appendChild(node);
            results.push(hl);
        }
    }
    return results;
}


// reanchorRange will attempt to normalize a range, swallowing Range.RangeErrors
// for those ranges which are not reanchorable in the current document.
function reanchorRange(range, rootElement) {
    try {
        return Range.sniff(range).normalize(rootElement);
    } catch (e) {
        if (!(e instanceof Range.RangeError)) {
            // Oh Javascript, why you so crap? This will lose the traceback.
            throw(e);
        }
        // Otherwise, we simply swallow the error. Callers are responsible
        // for only trying to draw valid annotations.
    }
    return null;
}


// Highlighter provides a simple way to draw highlighted <span> tags over
// annotated ranges within a document.
//
// element - The root Element on which to dereference annotation ranges and
//           draw highlights.
// options - An options Object containing configuration options for the plugin.
//           See `Highlighter.options` for available options.
//
var Highlighter = exports.Highlighter = function Highlighter(options) {
    this.document_element = options.document_element;
    this.html_document_element = this.document_element.get(0);
    this.options = $.extend(true, {}, Highlighter.defaults, options);
    
    this.temp_highlighted_anns = [];
    
    this.setDocumentEvents();
};

Highlighter.defaults = {
    // The CSS class to apply to drawn highlights
    highlight_class: 'annotator-hl',
    // CSS class to apply while annotation is being made
    temp_highlight_class: "annotator-hl-temporary",
    // Number of annotations to draw at once
    chunkSize: 10,
    // Time (in ms) to pause between drawing chunks of annotations
    chunkDelay: 10
};

$.extend(Highlighter.prototype, {
        
  setDocumentEvents: function () {
    var self = this;
    
    this.document_element
      .on("text-selected", function (evt) {
        // unhighlight any temp highlights. & replace temp ann's with a new one.
        self.undrawAll();
      })
      .on("text-deselected", function (evt) {
        self.undrawAll();
      })
      .on("new-annotation", function (evt) {
        self.temp_highlighted_anns.push(evt.annotation);
        self.draw(evt.annotation, self.options.temp_highlight_class);
      })
      .on("annotation-created", function (evt) {
        self.undraw(evt.annotation);
      })
      .on("annotation-selected", function (evt) {
        self.undrawAll();
        self.temp_highlighted_anns.push(evt.annotation);
        self.draw(evt.annotation);
      })
      .on("viewer-closed editor-closed", function (evt) {
        self.undrawAll();
      })
      .on("document-element-changed", function (evt) {
        self.document_element = evt.new_document_element;
        self.setDocumentEvents();
      });
  },
  
  destroy: function () {
    this.document_element
          .find("." + this.options.highlight_class)
          .each(function (_, el) {
              $(el).contents().insertBefore(el);
              $(el).remove();
          });
  },

  // Public: Draw highlights for all the given annotations
  //
  // annotations - An Array of annotation Objects for which to draw highlights.
  //
  // Returns nothing.
  drawAll: function (annotations) {
      var self = this;

      var p = new Promise(function (resolve) {
          var highlights = [];

          function loader(annList) {
              if (typeof annList === 'undefined' || annList === null) {
                  annList = [];
              }

              var now = annList.splice(0, self.options.chunkSize);
              for (var i = 0, len = now.length; i < len; i++) {
                  highlights = highlights.concat(self.draw(now[i]));
              }

              // If there are more to do, do them after a delay
              if (annList.length > 0) {
                  setTimeout(function () {
                      loader(annList);
                  }, self.options.chunkDelay);
              } else {
                  resolve(highlights);
              }
          }

          var clone = annotations.slice();
          loader(clone);
      });

      return p;
  },

  // Public: Draw highlights for the annotation.
  //
  // annotation - An annotation Object for which to draw highlights.
  //
  // Returns an Array of drawn highlight elements.
  draw: function (annotation, css_class) {
      var normedRanges = [];

      for (var i = 0, ilen = annotation.ranges.length; i < ilen; i++) {
          var r = reanchorRange(annotation.ranges[i], this.html_document_element);
          if (r !== null) {
              normedRanges.push(r);
          }
      }

      var hasLocal = (typeof annotation._local !== 'undefined' &&
                      annotation._local !== null);
      if (!hasLocal) {
        annotation._local = {}
      }
      var hasHighlights = (typeof annotation._local.highlights !== 'undefined' &&
                           annotation._local.highlights === null);
      if (!hasHighlights) {
          annotation._local.highlights = [];
      }

      for (var j = 0, jlen = normedRanges.length; j < jlen; j++) {
          var normed = normedRanges[j];
          $.merge(
              annotation._local.highlights,
              highlightRange(normed, css_class || this.options.highlightClass)
          );
      }

      // Save the annotation data on each highlighter element.
      $(annotation._local.highlights).data('annotation', annotation);

      // Add a data attribute for annotation id if the annotation has one
      if (typeof annotation.id !== 'undefined' && annotation.id !== null) {
          $(annotation._local.highlights)
              .attr('data-annotation-id', annotation.id);
      }

      return annotation._local.highlights;
  },

  // Public: Remove the drawn highlights for the given annotation.
  //
  // annotation - An annotation Object for which to purge highlights.
  //
  // Returns nothing.
  undraw: function (annotation) {
      var hasHighlights = (typeof annotation._local !== 'undefined' &&
                           annotation._local !== null &&
                           typeof annotation._local.highlights !== 'undefined' &&
                           annotation._local.highlights !== null);

      if (!hasHighlights) {
          return;
      }

      for (var i = 0, len = annotation._local.highlights.length; i < len; i++) {
          var h = annotation._local.highlights[i];
          if (h.parentNode !== null) {
              $(h).replaceWith(h.childNodes);
              h.normalize();
          }
      }
  },

  // Public: Redraw the highlights for the given annotation.
  //
  // annotation - An annotation Object for which to redraw highlights.
  //
  // Returns the list of newly-drawn highlights.
  redraw: function (annotation) {
      this.undraw(annotation);
      delete annotation._local.highlights;
      return this.draw(annotation);
  },

  // Public: undraw the highlights for a given set of annotations.
  //
  // annotations -[] .
  //
  // Returns nothing.
  undrawAll: function () {
    for (var i = 0, len = this.temp_highlighted_anns.length; i < len; i++) {
      this.undraw(this.temp_highlighted_anns[i]);
    }
  }
});