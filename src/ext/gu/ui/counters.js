"use strict";

/*
 * get counts of annotations by meaningful blocks on the page,
 * given by 
 */
function CountsManager(document_element, counts_url) {
  this.document_element = $(document_element);
  this.counts_url = counts_url;
  this.counter_template = "<div class='counter'>&nbsp;</div>";
  this.getCounts();
}


CountsManager.prototype.getCounts = function () {
  // clear the counts div.
  var counts_div = $("#counts");
  counts_div.find(".counter").remove();
  var counts_mgr = this;
  $.ajax(this.counts_url, { dataType: 'json' })
    .done(function (counts_array) {
      $(counts_array).each(function () {
        var block_element = counts_mgr.document_element.find(counts_mgr.convertBlockIdToSelector(this.block_id));
        // create a counter and place it into the counts div.
        var counter = $(counts_mgr.counter_template);
        counts_div.append(counter);
        counter.offset({ top: block_element.offset().top }).html(this.num_annotations_in_block);
      })
    })
}

// block_id comes in as xpath, eg; /p[1] or /ol[2]/li[4]
// convert this to, eg; p:nth-of-type(1) or ol:nth-of-type(2) > li:nth-of-type(4).
CountsManager.prototype.convertBlockIdToSelector = function (block_id) {
  // use the same regex as in the python Annotation model to parse the xpath.
  var re = /(\/(\w+)\[(\d+)\])/g;
  var block_info, block_selector;
  while (block_info = re.exec(block_id)) {
    // make sure the match is usable to us (has an element name and an index of which nbr element of that name).
    if ((block_info instanceof Array) && (block_info.length == 4)) {
      // init block_selector or add a direct descendant selector to it.
      if (!block_selector) {
        block_selector = block_info[2] + ":nth-of-type(" + block_info[3] + ")";
      } else {
        block_selector = block_selector + " > " + block_info[2] + ":nth-of-type(" + block_info[3] + ")";
      }
    }
  }
  
  return block_selector;
}


exports.CountsManager = CountsManager;