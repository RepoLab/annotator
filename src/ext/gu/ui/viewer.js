"use strict";

var xpathToSelector = require('./util').xpathToSelector;

/*
 * Renders annotations into a HTML list and shows a viewer element containing that list.
 * We have the whole serialized annotation record to work with.
 * TODO: Render each annotation according to current mode. 
 */

var Viewer = exports.Viewer = function (options) {
    this.options = options || {};
    this.viewer_element = $(options.viewer_element || null); // provide from app??
    this.document_element = $(options.document_element || null);

    
    this.annotations_list = this.viewer_element.find("ul.annotations-listing");
    this.viewer_element.find("a.close_btn").click(this.close.bind(this));
    
    // TODO: make this mode-dependent, when we pass in mode.
    this.annotation_template = "<li class='annotation'><a class='edit_btn' href='#'></a><a class='delete_btn' href='#'></a></li>";
    
    // load annotations when the event arises.
    var viewer = this;
    this.document_element
    .on("annotations-retrieved", function (evt) {
      viewer.loadAnnotations(evt.annotations);
    })
    .on("text-deselected", function (evt) {
      viewer.dehighlightAll();
    });
}

Viewer.offset_top = 23;

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
      position = first_element.offset();
      
    } catch (e) {
      console.log(e);
    }
    
    if (!position) {
      position = { top: 0 }; // default, to fail somewhat gracefully.
    }
    
    var annotation, annotation_id;
    for (var i=0; i<annotation_records.length; i++) {
      annotation = annotation_records[i].fields || {};
      // create HTML Ranges from Django's model serialization.
      var ranges = [];
      var range_specs = [];
      var range_spec, range, anchor_node, focus_node;
      for (var j=0; j<annotation.ranges.length; j++) {
        range_spec = annotation.ranges[j].fields;
        range_specs.push(range_spec);
        range = document.createRange();
        anchor_node = this.document_element.find(xpathToSelector(range_spec.start)).get(0).firstChild;
        focus_node = this.document_element.find(xpathToSelector(range_spec.end)).get(0).firstChild;
        range.setStart(anchor_node, parseInt(range_spec.start_offset));
        range.setEnd(focus_node, parseInt(range_spec.end_offset));
        ranges.push(range);
      }
      annotation.ranges = ranges;
      annotation.range_specs = range_specs;
      annotation.id = annotation_records[i].pk;
      this.annotations_list.append(this.renderAnnotation(annotation));
    }
    
    this.show(position);
  },
  
  show: function (position) {
    this.viewer_element.show().offset({ top: position.top - Viewer.offset_top });
  },
  
  close: function () {
    this.viewer_element.hide();
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
      viewer_position.top = viewer_position.top + Viewer.offset_top;
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
      // refresh the annotation's ranges from the data. for some reason, they're getting redefined as a result of the highlighting code. Note that the range specs have already been resolved from Django's model serialization.
      // create HTML Ranges from Django's model serialization.
      var ranges = [];
      var range_spec, range, anchor_node, focus_node;
      for (var j=0; j<annotation.range_specs.length; j++) {
        range_spec = annotation.range_specs[j];
        range = document.createRange();
        anchor_node = viewer.document_element.find(xpathToSelector(range_spec.start)).get(0).firstChild;
        focus_node = viewer.document_element.find(xpathToSelector(range_spec.end)).get(0).firstChild;
        range.setStart(anchor_node, parseInt(range_spec.start_offset));
        range.setEnd(focus_node, parseInt(range_spec.end_offset));
        ranges.push(range);
      }
      annotation.ranges = ranges;
      
      var e = $.Event("annotation-selected", { annotation: annotation });
      viewer.document_element.trigger(e);
      // select just this annotation in the list.
      viewer.dehighlightAll();
      $(this).addClass("highlighted");
    });
    
    return annotation_element;
  }
});