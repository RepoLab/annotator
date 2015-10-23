"use strict";

/*
 * get counts of annotations by meaningful blocks on the page,
 * given by 
 */
function BlocksManager(document_element, counts_url, annotations_url) {
  this.document_element = $(document_element);
  this.counts_url = counts_url;
  this.annotations_url = annotations_url;
  this.counter_template = "<a class='counter'>&nbsp;</a>";
  this.getCounts();
  
  // refresh placement of counters when browser window gets resized.
  $(window).on('resize', this.getCounts.bind(this));
}


BlocksManager.prototype.getCounts = function () {
  // clear the counts div.
  var counts_div = $("#counts");
  counts_div.find(".counter").remove();
  var counts_mgr = this;
  $.ajax(this.counts_url, { dataType: 'json' })
    .done(function (counts_array) {
      $(counts_array).each(function () {
        var count_obj = this;
        var block_element = counts_mgr.document_element.find(counts_mgr.convertBlockIdToSelector(count_obj.block_id));
        // create a counter and place it into the counts div.
        var counter = $(counts_mgr.counter_template);
        counts_div.append(counter);
        counter.offset({ top: block_element.offset().top }).html(this.num_annotations_in_block);
        counter.click(function (evt) {
          // request the annotations for this block.
          counts_mgr.getAnnotationsForBlock(count_obj);
        });
      })
    })
}


BlocksManager.prototype.getAnnotationsForBlock = function (count_obj) {
  // turn the block_id into something that's okay for a URL.
  var re = /(\w+\[\d+\])/g;
  var block_term_info;
  var block_url_param = "";
  while (block_term_info = re.exec(count_obj.block_id)) {
    block_url_param = block_url_param + block_term_info[0];
  }
  $.ajax(this.annotations_url + "/" + block_url_param)
    .done(function (block_annotations) {
      console.log(block_annotations);
    });
}


// block_id comes in as xpath, eg; /p[1] or /ol[2]/li[4]
// convert this to, eg; p:nth-of-type(1) or ol:nth-of-type(2) > li:nth-of-type(4).
BlocksManager.prototype.convertBlockIdToSelector = function (block_id) {
  // use the same regex as in the python Annotation model to parse the xpath.
  var re = /(\/(\w+)\[(\d+)\])/g;
  var block_term_info, block_selector;
  while (block_term_info = re.exec(block_id)) {
    // make sure the match is usable to us (has an element name and an index of which nbr element of that name).
    if ((block_term_info instanceof Array) && (block_term_info.length == 4)) {
      // init block_selector or add a direct descendant selector to it.
      if (!block_selector) {
        block_selector = block_term_info[2] + ":nth-of-type(" + block_term_info[3] + ")";
      } else {
        block_selector = block_selector + " > " + block_term_info[2] + ":nth-of-type(" + block_term_info[3] + ")";
      }
    }
  }
  
  return block_selector;
}


exports.BlocksManager = BlocksManager;