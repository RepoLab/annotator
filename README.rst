CNDLS Annotator
=========

CNDLS Annotator is a variant of the Annotator JavaScript library for building annotation applications in
browsers. It adds custom events to the UI, with the intent of more easily allowing alternate UI workflows. NOTE: this implementation requires jQuery.

Here is a list of modules that trigger events, and what the events are for:

**BlocksManager**. A block is a chunk of text (e.g.; a paragraph or list) to which the UI adds annotations. Upon initialization, the Main module asks the BlocksManager to request annotation counts for the current page. These come back, sorted by block. BlocksManager displays an icon with the number of annotations associated with each block, or an icon with an "add" symbol for blocks which have no annotations. Clicking any of these icons brings up an Editor, for creating a first block annotation, or a Viewer with the existing annotations, along with an "add" control. BlocksManager triggers an *"annotations-retrieved"* event when the requested annotations for the block come back via AJAX.

**Editor** Our version of the Editor module triggers a *"save-new-annotation"* event or a *"update-annotation"* event. The Main module listens for these and triggers the store to save the annotation via the appropriate URL.

**Main** Through the text_selector.onSelection mechanism in the standard Annotator, the Main module triggers *"text-selected"* and *"text-deselected"* events when the user takes these actions on relevant text on the current page.

**LineNbrTextSelector** This is a custom module which extends TextSelector. We use it for the special case of allowing lines of poetry to be selected by clicking on a preceding line number. It also triggers a *"text-selected"* event.

**Viewer** Our version of the Viewer module triggers an *"edit-annotation"* or *"delete-annotation"* event whenever the appropriate control associated with an individual annotation in the Viewer is clicked. The Viewer also triggers an *"annotation-selected"* event whenever the Viewer element which displays the annotation is clicked, so the Highlighter can redraw highlights. It also triggers an *"annotation-rendered"* event each time an annotation is drawn into the Viewer, in case anything about the UI needs to adjust to accomodate it.


.. _Annotator home page: http://annotatorjs.org/
.. _the releases page: https://github.com/openannotation/annotator/releases