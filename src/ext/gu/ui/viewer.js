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
    this.document_element.on("annotations-retrieved", function (evt) {
      viewer.loadAnnotations(evt.annotations);
    });
}

Viewer.offset_top = 23;

$.extend(Viewer.prototype, {
  
  loadAnnotations: function (annotations, append) {
    // if the list is empty, return.
    if (!annotations || !annotations.length) return;
    
    append = append || false;
    
    // by default, reset the list.
    if (!append) { this.annotations_list.html(""); }
    
    var annotation, annotation_id;
    for (var i=0; i<annotations.length; i++) {
      annotation = annotations[i].fields || {};
      annotation_id = annotations[i].pk;
      this.annotations_list.append(this.renderAnnotation(annotation, annotation_id));
    }
    // get the location from the start element value of the first range of an annotation from the list.
    var position;
    try {
      var xpath_of_start = annotation.ranges[0].fields.start;
      var first_element = this.document_element.find(xpathToSelector(xpath_of_start));
      position = first_element.offset();
      
    } catch (e) {
      console.log(e)
      position = { top: 0 }; // default, to fail somewhat gracefully.
    }
    
    this.show(position);
  },
  
  show: function (position) {
    this.viewer_element.show().offset({ top: position.top - Viewer.offset_top });
  },
  
  close: function () {
    this.viewer_element.hide();
  },
  
  renderAnnotation: function (annotation, annotation_id) {
    var annotation_element = $(this.annotation_template);
    annotation_element.append("<div class='note'>" + (annotation.text || "") + "</div>");
    
    // put controls in here, where we have easy access to the annotation associated with this HTML stuff.
    var viewer = this;
    annotation_element.find("a.edit_btn").click(function () {
      var e = $.Event("edit-annotation", { annotation: annotation });
      viewer.document_element.trigger(e);
    });
    annotation_element.find("a.delete_btn").click(function () {
      if (window.confirm("Are you sure you want to delete this annotation?")) {
        annotation.id = annotation_id;
        var e = $.Event("delete-annotation", { annotation: annotation });
        viewer.document_element.trigger(e);
      }
    });
    
    return annotation_element;
  }
});