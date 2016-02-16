"use strict";

var $ = require('jquery');


/*
 * get counts of annotations by meaningful blocks on the page,
 * given by 
 */
function BlocksManager(options) {
  this.document_element = options.document_element;
  this.counts_url = options.counts_url || BlocksManager.DEFAULTS.counts_url;
  this.counts_selector = options.counts_selector || BlocksManager.DEFAULTS.counts_selector;
  this.annotations_url = options.annotations_url || BlocksManager.DEFAULTS.annotations_url;
  this.counter_template = options.counter_template || BlocksManager.DEFAULTS.counter_template;
  this.xpathToSelector = require('./util').xpathToSelector;
  this.getCounts();
  
  // refresh placement of counters when browser window gets resized.
  $(window).on('resize', this.getCounts.bind(this));
  
  // when an annotation is deleted, just refresh all of the block markers on the page.
  this.document_element.on("annotation-deleted annotation-created", this.getCounts.bind(this))
}

BlocksManager.DEFAULTS = {
  counter_template: "<a class='counter unselectable'>&nbsp;</a>",
  counts_url: "annotator/counts",
  counts_selector: "#counts",
  annotations_url: "annotator/get"
}

$.extend(BlocksManager.prototype, {
  
  start: function (app) {
    this.app = app;
  },

  getCounts: function () {
    // clear the counts div.
    var counts_div = $("#counts");
    counts_div.find(".counter").remove();
    var counts_mgr = this;
    return $.ajax(this.counts_url, { dataType: 'json' })
      .done(function (counts_array) {
        $(counts_array).each(function () {
          var count_obj = this;
          var block_element = counts_mgr.document_element.find(counts_mgr.xpathToSelector(count_obj.block_id));
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
  },

  getAnnotationsForBlock: function (count_obj) {
    // turn the block_id into something that's okay for a URL.
    var re = /(\w+\[\d+\])/g;
    var block_term_info;
    var block_url_param = "";
    while (block_term_info = re.exec(count_obj.block_id)) {
      block_url_param = block_url_param + block_term_info[0];
    }
    var block_mgr = this;
    $.ajax(this.annotations_url + "/" + block_url_param)
      .done(function (block_annotations) {
        // if the app has a function to translate annotations as serialized into
        // annotations as Annotator needs them to be, apply that to the annotations.
        if (typeof block_mgr.app.translate === "function") {
          block_annotations = block_mgr.app.translate(block_annotations);
        }
        var e = $.Event("annotations-retrieved", { annotations: block_annotations });
        block_mgr.document_element.trigger(e);
      });
  }
});

exports.BlocksManager = BlocksManager;