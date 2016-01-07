"use strict";

var $ = require('jquery');

/*
 * Trap clicks on line nbrs (in poetry) as clicks on the whole line:
 */
function LineNbrTextSelector(options) {
  var linenbr_selector = options.linenbr_selector;
  $(linenbr_selector).click(function selectNumberedLine (evt) {
    // if click is over the line nbr, select the whole line.
    var click_x = evt.offsetX;
    var click_y = evt.offsetY;
    var em = parseInt( $(evt.target).css("lineHeight") );
    
    if ( (click_x > -2 * em && click_x < -.05 * em) && (click_y > 0 && click_y < 1 * em)) {
      var selection = window.getSelection();
      selection.removeAllRanges();
    
      var node = evt.target;
      var range = document.createRange();
      range.setStart(node, 0);

      if (node.nodeType === 3) {
        range.setEnd(node, node.textContent.length);
      } else {
        var first_child = node.childNodes[0];
        var last_child = node.childNodes[node.childNodes.length - 1];
        range.setStart(first_child, 0);
        range.setEnd(last_child, last_child.length);
      }
      
      // create a mouse click at the li element, and tell the app to init an annotation there.
      var aEvt = $.Event("text-selected", { ranges: [range], pageX: evt.pageX, pageY: evt.pageY });
      $("#content").trigger(aEvt);
    
      evt.stopPropagation();
      evt.stopImmediatePropagation();
      return false;
    }
  });
}

exports.LineNbrTextSelector = LineNbrTextSelector;