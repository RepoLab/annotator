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
    
    // TODO: make this mode-dependent, when we pass in mode.
    this.annotation_template = "<li class='annotation'><a class='close_btn' href='#></a></li";
    
    // load annotations when the event arises.
    var viewer = this;
    this.document_element.on("annotations-retrieved", function (evt) {
      viewer.loadAnnotations(evt.annotations);
    });
}

Viewer.offset_top = 0;

$.extend(Viewer.prototype, {
  
  loadAnnotations: function (annotations) {
    // if the list is empty, return.
    if (!annotations || !annotations.length) return;
    
    var annotation;
    var annotations_list = this.viewer_element.find("ul.annotations-listing");
    annotations_list.html("");
    for (var i=0; i<annotations.length; i++) {
      annotation = annotations[i].fields || {};
      annotations_list.append(this.renderAnnotation(annotation));
    }
    // get the location from the start element value of the first range of an annotation from the list.
    var position;
    try {
      var xpath_of_start = annotation.ranges[0].fields.start;
      var first_element = this.document_element.find(xpathToSelector(xpath_of_start));
      position = first_element.offset();
      
    } catch (e) {
      console.log(e)
      position = { top: 0 }; // default, to fail at least a little bit gracefully?
    }
    
    this.show(position);
  },
  
  show: function (position) {
    this.viewer_element.show().offset({ top: position.top - Viewer.offset_top });
  },
  
  renderAnnotation: function (annotation) {
    var annotation_element = $(this.annotation_template);
    annotation_element.append("<div class='note'>" + (annotation.text || "") + "</div>");
    return annotation_element;
  }
});