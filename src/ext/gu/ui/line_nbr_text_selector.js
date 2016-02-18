"use strict";

var $ = require('jquery');

/*
 * Trap clicks on line nbrs (in poetry) as clicks on the whole line:
 */
function LineNbrTextSelector(options) {
  var document_element = options.document_element;
  var linenbr_selector = options.line_nbr_selector || LineNbrTextSelector.defaults.linenbr_selector;
  var click_range = options.click_range || LineNbrTextSelector.defaults.click_range;
  var mod_key = options.mod_key || false;
  
  $(linenbr_selector).click(function selectNumberedLine (evt) {
    // if we've set a mod_key, require that be down.
    if (!(mod_key && evt[mod_key])) { return; }
    
    // if click is over the line nbr, select the whole line.
    var click_x = evt.offsetX;
    var click_y = evt.offsetY;
    var em = parseInt( $(evt.target).css("lineHeight") );
    
    if ( (click_x > (click_range.left * em) && click_x < (click_range.right * em)) && (click_y > 0 && click_y < 1 * em)) {
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
      var ann = { ranges: [range] };
      var aEvt = $.Event("text-selected", { ann: ann, pageX: evt.pageX, pageY: evt.pageY });
      document_element.trigger(aEvt);
    
      evt.stopPropagation();
      evt.stopImmediatePropagation();
      return false;
    }
  });
}

LineNbrTextSelector.defaults = {
  linenbr_selector: "#content ol li",
  click_range: { left: -2, right: -.05 }
}

exports.LineNbrTextSelector = LineNbrTextSelector;