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
    this.document_element = this.options.document_element;
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
      viewer.close(evt, true);
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
  
  start: function (app) {
    // keep track of auth code, for when we render annotations.
    this.ident = app.registry.getUtility('identityPolicy');
    this.authz = app.registry.getUtility('authorizationPolicy');
  },
  
  loadAnnotations: function (annotations, append, addl_classes) {
    // by default, reset the list.
    if (!append) { this.annotations_list.html(""); }
    
    var viewer = this;
    $(annotations).each(function () {
      viewer.annotations_list.append(viewer.renderAnnotation(this, addl_classes));
    })
    
    // try to locate the viewer, using any offset info passed in.
    // we locate the viewer based on the offset to the start of the selected text.
    try {
      var start_range = annotations[0].ranges[0];
      var xpath_of_start = start_range.start;
      var first_element = this.document_element.find(xpathToSelector(xpath_of_start));
      var viewer_offset = this.viewer_element.parent().offset();
      
      // we can specify a mandatory left value (or a function which defines one).
      if (typeof this.offset.left !== "undefined"){
        if (typeof this.offset.left === "function") {
          viewer_offset.left = this.offset.left();
        } else {
          viewer_offset.left = this.offset.left;
        }
      }
      viewer_offset.top = first_element.offset().top;
      
    } catch (e) {
      console.log(e);
      
    } finally {
      viewer_offset = viewer_offset || { top: 0, left: 0 }; // default, to fail somewhat gracefully.
    }
    
    this.show(viewer_offset);
    return viewer_offset;
  },
  
  show: function (position) {
    this.viewer_element.show().offset({ top: position.top + this.offset.top, left: position.left + this.offset.left });
    var e = $.Event("viewer-opened");
    this.document_element.trigger(e);
  },
  
  close: function (evt, silent) {
    this.viewer_element.hide();
    if (!silent) {
      var e = $.Event("viewer-closed");
      this.document_element.trigger(e);
    }
  },
  
  dehighlightAll: function () {
    this.viewer_element.find("div.note").removeClass("highlighted");
  },
  
  renderAnnotation: function (annotation, addl_classes) {
    var annotation_element = $(this.annotation_template);
    annotation_element.append("<div class='note'>" + (annotation.text || "") + "</div>");
    
    if (addl_classes) {
      annotation_element.addClass(addl_classes);
    }
    var viewer = this;
    
    // put controls in here, where we have easy access to the annotation associated with this HTML stuff.
    var edit_btn = annotation_element.find("a.edit_btn");
    if (this.authz.permits("edit", annotation, this.ident.who())) {
      edit_btn.click(function () {
        var viewer_position = viewer.viewer_element.offset();
        viewer_position.top = viewer_position.top + viewer.offset.top;
        var e = $.Event("edit-annotation", { annotation: annotation, position: viewer_position });
        viewer.close();
        viewer.document_element.trigger(e);
      });
    } else {
      edit_btn.hide(); // disable?
    }
    
    var delete_btn = annotation_element.find("a.delete_btn")
    if (this.authz.permits("delete", annotation, this.ident.who())) {
      delete_btn.click(function () {
        if (window.confirm("Are you sure you want to delete this annotation?")) {
          var e = $.Event("delete-annotation", { annotation: annotation });
          viewer.document_element.trigger(e);
        }
      });
    } else {
      delete_btn.hide(); // disable?
    }
      
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
      // debugger;
    } finally {
      annotation.ranges = ranges;
    }

    var e = $.Event("annotation-selected", { annotation: annotation });
    this.document_element.trigger(e);
  }
});