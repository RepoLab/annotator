"use strict";

var $ = require('jquery');

var util = require('../../../util');

var _t = util.gettext;
var Promise = util.Promise;

var NS = "annotator-editor";


// id returns an identifier unique within this session
var id = (function () {
    var counter;
    counter = -1;
    return function () {
        return counter += 1;
    };
}());


// preventEventDefault prevents an event's default, but handles the condition
// that the event is null or doesn't have a preventDefault function.
function preventEventDefault(event) {
    if (typeof event !== 'undefined' &&
        event !== null &&
        typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
}

// Public: Creates an element for editing annotations.
var Editor = exports.Editor = function (options) {
    this.options = options || {};

    this.document_element = this.options.document_element; // will be there, if instantiated from main.
    this.editor_element = $(this.options.selector || Editor.DEFAULTS.selector);
    this.editor_wysiwyg = this.options.wysiwyg || $.noop; // need to support some basic api?
    
    this.annotator_add_selector = this.options.annotator_add_selector || Editor.DEFAULTS.annotator_add_selector;
    this.annotator_edit_selector = this.options.annotator_edit_selector || Editor.DEFAULTS.annotator_edit_selector;
    
    // any add'l fields passed in as options will get added to the editor.
    this.field_specs = $.extend({}, (this.options.fields || {}));
    this.fields = [];
    
    // any operations we want to perform on the ui.
    this.custom_ui = $.extend((options.custom_ui || {}), Editor.DEFAULTS.custom_ui);
    
    // any controls passed in will override the defaults, 
    // so add and edit will have to be specified,
    // if they are still desired.
    this.controls = options.controls || {
      add: this.editor_element.find(this.annotator_add_selector),
      edit: this.editor_element.find(this.annotator_edit_selector),
    };
    this.mode = "add";
    this.annotation = {};

    var self = this;

    this.editor_element
        .on("submit." + NS, 'form', function (e) {
            self._onFormSubmit(e);
        })
        .on("click." + NS, '.annotator-add', function (e) {
            self._onSaveClick(e);
        })
        .on("click." + NS, '.annotator-edit', function (e) {
            self._onSaveClick(e);
        })
        .on("click." + NS, '.annotator-cancel', function (e) {
            self._onCancelClick(e);
        })
        .on("mouseover." + NS, '.annotator-cancel', function (e) {
            self._onCancelMouseover(e);
        })
        .on("keydown." + NS, 'textarea', function (e) {
            self._onTextareaKeydown(e);
        });
        
    this.document_element
        .on("new-annotation", function (evt) {
          self.load(evt.annotation, evt.position, "add");
        })
        .on("text-deselected", function (evt) {
          self.cancel();
        })
        .on("edit-annotation", function (evt) {
          self.load(evt.annotation, evt.position, "edit");
        })
        .on("annotation-created", function (evt) {
          self.close();
        })
        .on("viewer-opened", function (evt) {
          self.close(evt, true);
        })
        ;
}

Editor.DEFAULTS = {
  selector: "#annotator-editor",
  offset: { top: 60, left: 0 },
  defaultFields: true,
  annotator_add_selector: ".annotator-controls .annotator-add",
  annotator_edit_selector: ".annotator-controls .annotator-edit",
  // this should be jQuery selectors and functions to apply to them upon loading.
  custom_ui: {}
};

// Classes to toggle state.
Editor.classes = {
    hide: 'annotator-hide',
    focus: 'annotator-focus'
};

$.extend(Editor.prototype, {

    destroy: function () {
        this.editor_element.off("." + NS);
    },

    show: function (position) {
      this.editor_element.show().offset({ top: position.top - Editor.DEFAULTS.offset.top });
      var evt = $.Event("editor-opened", { annotation: this.annotation });
      this.document_element.trigger(evt);
      
      // give wysiwyg the focus.
      var wysiwyg = this.editor_wysiwyg;
      setTimeout(
        function () {
          if (wysiwyg){ 
            wysiwyg.focus.end();
            wysiwyg.code.set(evt.annotation.text || "");
          }
        }
      );
    },
    
    close: function (evt, silent) {
      this.editor_element.hide();
      
      // nuke custom fields. who knows if we'll want them the next time we load the editor?
      $(this.fields).each(function () {
        this.element.remove();
      });
      
      if (!silent){
        this.document_element.trigger($.Event("editor-closed"));
      }
    },

    // Public: Load an annotation into the editor and display it.
    //
    // annotation - An annotation Object to display for editing.
    // position - An Object specifying the position in which to show the editor
    //            (optional).
    //
    // Returns a Promise that is resolved when the editor is submitted, or
    // rejected if editing is cancelled.
    load: function (annotation, position, mode) {
        this.annotation = annotation;
        this.mode = mode;
        
        // add any fields req'd.
        var field;
        for (var field_name in this.field_specs) {
            field = this.addFieldFromOptions(field_name, this.field_specs[field_name]);
            field.load(field, annotation, position); // position?
        }
        
        // add/change any ui elements via options.
        var editor = this;
        for (var ui_selector in this.custom_ui) {
          try {
            $(ui_selector).each(function () {
              editor.custom_ui[ui_selector].call(this, annotation);
            });
          } catch (e) {
            console.warn("Could not modify editor UI.", e);
          }
        }
        
        // set up std editor UI, with correct form action for mode.
        if (mode === "edit") {
          this.controls.add.hide();
          this.controls.edit.show();
          // put the annotation.id into input.note-id.
          this.editor_element.find("input.note-id", annotation['id']);
        } else {
          this.controls.edit.hide();
          this.controls.add.show();
        }

        var self = this;
        return new Promise(function (resolve, reject) {
            self.dfd = {resolve: resolve, reject: reject};
            self.show(position);
        });
    },
    
    // this wrapper for addField just lets us more quickly specify 
    // some fields, using some likely defaults.
    addFieldFromOptions: function (field_name, field_spec) {
      switch (typeof field_spec) {
        case "string": // create a text input field, with a default value.
          break;

        case "boolean": // create a checkbox input field, with a default value.
          return this.addField({
            type: 'checkbox',
            id: 'annotator-field-' + field_name,
            label: field_name.humanize() + '?',
            load: function (field, annotation, position) {
              // Check what state of input should be.
              // Take if from annotation, if annotation has one.
              // otherwise, use default.
              if (annotation.hasOwnProperty(field_name)) {
                if (annotation[field_name]) {
                  $(field.element).find('input').attr('checked', 'checked');
                } else {
                  $(field.element).find('input').removeAttr('checked');
                }
              } else {
                if (field_spec) {
                  $(field.element).find('input').attr('checked', 'checked');
                } else {
                  $(field.element).find('input').removeAttr('checked');
                }
              }
            },
            submit: function (field, annotation) {
              var checked = $(field).find('input').is(':checked');
              annotation[field_name] = checked;
            }
          });
          break;

        case "object": // create a custom field via fn normally used by the annotator.
          return this.addField(field_spec);
          break;
        
      }
    },

    // Public: Submits the editor and saves any changes made to the annotation.
    //
    // Returns nothing.
    submit: function () {
        for (var i = 0, len = this.fields.length; i < len; i++) {
            var field = this.fields[i];
            field.submit(field.element, this.annotation);
        }
        if (typeof this.dfd !== 'undefined' && this.dfd !== null) {
            this.dfd.resolve();
        }
        
        // get text from wysiwyg.
        this.annotation.text = (this.editor_wysiwyg.code.get() || "").trim();
        // don't save null annotations.
        if (this.annotation.text === "") { return; }
        
        // announce there is an annotation to save. hopefully, a Store will be listening.
        var action;
        if (this.mode === "add") {
          var action = "save-new-annotation";
        } else {
          var action = "update-annotation";
        }
        var aEvt = $.Event(action, { annotation: this.annotation });
        this.document_element.trigger(aEvt);
        
        this.close();
    },

    // Public: Cancels the editing process, discarding any edits made to the
    // annotation.
    //
    // Returns itself.
    cancel: function () {
        if (typeof this.dfd !== 'undefined' && this.dfd !== null) {
            this.dfd.reject('editing cancelled');
        }
        this.close();
    },

    // Public: Adds an additional form field to the editor. Callbacks can be
    // provided to update the view and anotations on load and submission.
    //
    // options - An options Object. Options are as follows:
    //           id     - A unique id for the form element will also be set as
    //                    the "for" attribute of a label if there is one.
    //                    (default: "annotator-field-{number}")
    //           type   - Input type String. One of "input", "textarea",
    //                    "checkbox", "select" (default: "input")
    //           label  - Label to display either in a label Element or as
    //                    placeholder text depending on the type. (default: "")
    //           load   - Callback Function called when the editor is loaded
    //                    with a new annotation. Receives the field <li> element
    //                    and the annotation to be loaded.
    //           submit - Callback Function called when the editor is submitted.
    //                    Receives the field <li> element and the annotation to
    //                    be updated.
    //
    // Examples
    //
    //   # Add a new input element.
    //   editor.addField({
    //     label: "Tags",
    //
    //     # This is called when the editor is loaded use it to update your
    //     # input.
    //     load: (field, annotation) ->
    //       # Do something with the annotation.
    //       value = getTagString(annotation.tags)
    //       $(field).find('input').val(value)
    //
    //     # This is called when the editor is submitted use it to retrieve data
    //     # from your input and save it to the annotation.
    //     submit: (field, annotation) ->
    //       value = $(field).find('input').val()
    //       annotation.tags = getTagsFromString(value)
    //   })
    //
    //   # Add a new checkbox element.
    //   editor.addField({
    //     type: 'checkbox',
    //     id: 'annotator-field-my-checkbox',
    //     label: 'Allow anyone to see this annotation',
    //     load: (field, annotation) ->
    //       # Check what state of input should be.
    //       if checked
    //         $(field).find('input').attr('checked', 'checked')
    //       else
    //         $(field).find('input').removeAttr('checked')

    //     submit: (field, annotation) ->
    //       checked = $(field).find('input').is(':checked')
    //       # Do something.
    //   })
    //
    // Returns the created <li> Element.
    addField: function (options) {
        var field = $.extend({
            id: 'annotator-field-' + id(),
            type: 'input',
            label: '',
            load: function () {},
            submit: function () {}
        }, options);

        var input = null,
            element = $('<li class="annotator-item" />');

        field.element = element[0];

        if (field.type === 'textarea') {
            input = $('<textarea />');
        } else if (field.type === 'checkbox') {
            input = $('<input type="checkbox" />');
        } else if (field.type === 'input') {
            input = $('<input />');
        } else if (field.type === 'select') {
            input = $('<select />');
        }

        element.append(input);

        input.attr({
            id: field.id,
            placeholder: field.label
        });

        if (field.type === 'checkbox') {
            element.addClass('annotator-checkbox');
            element.append($('<label />', {
                'for': field.id,
                'html': field.label
            }));
        }

        this.editor_element.find('ul:first').append(element);
        this.fields.push(field);

        return field;
    },

    // Event callback: called when a user clicks the editor form (by pressing
    // return, for example).
    //
    // Returns nothing
    _onFormSubmit: function (event) {
        preventEventDefault(event);
        this.submit();
    },

    // Event callback: called when a user clicks the editor's save button.
    //
    // Returns nothing
    _onSaveClick: function (event) {
        preventEventDefault(event);
        this.submit();
    },

    // Event callback: called when a user clicks the editor's cancel button.
    //
    // Returns nothing
    _onCancelClick: function (event) {
        preventEventDefault(event);
        this.cancel();
    },

    // Event callback: called when a user mouses over the editor's cancel
    // button.
    //
    // Returns nothing
    _onCancelMouseover: function () {
        this.editor_element
            .find('.' + Editor.classes.focus)
            .removeClass(Editor.classes.focus);
    },

    // Event callback: listens for the following special keypresses.
    // - escape: Hides the editor
    // - enter:  Submits the editor
    //
    // event - A keydown Event object.
    //
    // Returns nothing
    _onTextareaKeydown: function (event) {
        if (event.which === 27) {
            // "Escape" key => abort.
            this.cancel();
        } else if (event.which === 13 && !event.shiftKey) {
            // If "return" was pressed without the shift key, we're done.
            this.submit();
        }
    }
});