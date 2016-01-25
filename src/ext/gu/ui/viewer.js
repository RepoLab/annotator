"use strict";

var $ = require('jquery');

var xpathToSelector = require('./util').xpathToSelector;

/*
 * Renders annotations into a HTML list and shows a viewer element containing that list.
 * We have the whole serialized annotation record to work with.
 * TODO: Render each annotation according to current mode. 
 */

var Viewer = exports.Viewer = function (options) {
    this.options = options || {};
    this.viewer_element = $(this.options.viewer_selector || Viewer.DEFAULTS.viewer_selector); // provide from app??
    if (this.viewer_element.length == 0) {
      throw new Error("The value of viewer_selector passed in does not match any elements on the page.");
      return;
    }
    this.document_element = $(this.options.document_element || null);
    this.html_document_element = this.document_element.get(0);
    this.annotations_list = this.viewer_element.find(this.options.list_selector || Viewer.DEFAULTS.list_selector);
    
    // if viewer_element has a close button, make it work.
    this.viewer_element.find("a.close_btn").click(this.close.bind(this));
    // placement of the viewer element on the page.
    this.offset = this.options.offset || Viewer.DEFAULTS.offset;
    
    // TODO: make this mode-dependent, when we pass in mode.
    this.annotation_template = this.options.annotation_template || Viewer.DEFAULTS.annotation_template;
    
    // load annotations when the event arises.
    var viewer = this;
    this.document_element
    .on("annotations-retrieved", function (evt) {
      viewer.loadAnnotations(evt.annotations);
    })
    .on("text-deselected", function (evt) {
      viewer.dehighlightAll();
    })
    .on("editor-opened", function (evt) {
      viewer.close();
    })
    .on("annotation-deleted", function (evt) {
      viewer.close();
    });
}

Viewer.DEFAULTS = {
  offset: { top: 0, left: 4 },
  viewer_selector: "#annotator-viewer",
  list_selector: "ul.annotations-listing",
  annotation_template: "<li class='annotation'><a class='edit_btn' href='#'></a><a class='delete_btn' href='#'></a></li>"
}

$.extend(Viewer.prototype, {
  
  loadAnnotations: function (annotation_records, append) {
    // if the list is empty, return.
    if (!annotation_records || !annotation_records.length) return;
    
    append = append || false;
    
    // by default, reset the list.
    if (!append) { this.annotations_list.html(""); }

    // get the location from the start element value of the first range of an annotation from the list.
    var position;
    try {
      var xpath_of_start = annotation_records[0].fields.ranges[0].fields.start;
      var first_element = this.document_element.find(xpathToSelector(xpath_of_start));
      position = this.viewer_element.parent().offset();
      position.top = first_element.offset().top;
      
    } catch (e) {
      console.log(e);
    }
    
    if (!position) {
      position = { top: 0, left: 0 }; // default, to fail somewhat gracefully.
    }
    
    // make sure text nodes are not still broken up from prior highlights.
    this.html_document_element.normalize();
    
    var annotation, annotation_id;
    for (var i=0; i<annotation_records.length; i++) {
      annotation = annotation_records[i].fields || {};
      // create HTML Ranges from Django's model serialization.
      var ranges = [];
      var range_specs = [];
      var range_spec, range, anchor_node, focus_node;
      for (var j=0; j<annotation.ranges.length; j++) {
        try {
          range_spec = annotation.ranges[j].fields;
          range_specs.push(range_spec);
          range = document.createRange();
          anchor_node = this.document_element.find(xpathToSelector(range_spec.start)).get(0).firstChild;
          focus_node = this.document_element.find(xpathToSelector(range_spec.end)).get(0).firstChild;
          range.setStart(anchor_node, parseInt(range_spec.start_offset));
          range.setEnd(focus_node, parseInt(range_spec.end_offset));
          ranges.push(range);
        } catch (e) {
          console.warn("Could not set annotation range.", e);
        }
      }
      annotation.ranges = ranges;
      annotation.range_specs = range_specs;
      annotation.id = annotation_records[i].pk;
      this.annotations_list.append(this.renderAnnotation(annotation));
    }
    
    this.show(position);
  },
  
  show: function (position) {
    this.viewer_element.show().offset({ top: position.top + this.offset.top, left: position.left + this.offset.left });
  },
  
  close: function () {
    this.viewer_element.hide();
    var e = $.Event("viewer-closed");
    this.document_element.trigger(e);
  },
  
  dehighlightAll: function () {
    this.viewer_element.find("div.note").removeClass("highlighted");
  },
  
  renderAnnotation: function (annotation) {
    var annotation_element = $(this.annotation_template);
    annotation_element.append("<div class='note'>" + (annotation.text || "") + "</div>");
    
    // put controls in here, where we have easy access to the annotation associated with this HTML stuff.
    var viewer = this;
    annotation_element.find("a.edit_btn").click(function () {
      var viewer_position = viewer.viewer_element.offset();
      viewer_position.top = viewer_position.top + viewer.offset.top;
      var e = $.Event("edit-annotation", { annotation: annotation, position: viewer_position });
      viewer.close();
      viewer.document_element.trigger(e);
    });
    annotation_element.find("a.delete_btn").click(function () {
      if (window.confirm("Are you sure you want to delete this annotation?")) {
        var e = $.Event("delete-annotation", { annotation: annotation });
        viewer.document_element.trigger(e);
      }
    });
    // clicks on the note itself should bring up the note's highlight. (later we'll make this a user-defined option).
    annotation_element.find("div.note").click(function () {
      viewer.selectAnnotationItem(annotation);
      // select just this annotation in the list.
      viewer.dehighlightAll();
      $(this).addClass("highlighted");
    });
    
    // give notice that the annotation has been rendered.
    var e = $.Event("annotation-rendered", { annotation: annotation, element: annotation_element });
    this.document_element.trigger(e);
    
    return annotation_element;
  }, 
  
  selectAnnotationItem: function (annotation) {
    // refresh the annotation's ranges from the data. for some reason, they're getting redefined as a result of the highlighting code. Note that the range specs have already been resolved from Django's model serialization.
    // create HTML Ranges from Django's model serialization.
    var ranges = [];
    var range_spec, range, anchor_node, focus_node;
    try {
      for (var j=0; j<annotation.range_specs.length; j++) {
        range_spec = annotation.range_specs[j];
        range = document.createRange();
        anchor_node = this.document_element.find(xpathToSelector(range_spec.start)).get(0).firstChild;
        focus_node = this.document_element.find(xpathToSelector(range_spec.end)).get(0).firstChild;
        // MUST do setEnd first, because setStart changes the prior parts of the node,
        // making indexing to the end unreliable.
        range.setEnd(focus_node, parseInt(range_spec.end_offset));
        range.setStart(anchor_node, parseInt(range_spec.start_offset));
        ranges.push(range);
      }
    } catch(e) {
      console.warn(e, "Cannot set annotation ranges.");
      debugger;
    } finally {
      annotation.ranges = ranges;
    }

    var e = $.Event("annotation-selected", { annotation: annotation });
    this.document_element.trigger(e);
  }
});