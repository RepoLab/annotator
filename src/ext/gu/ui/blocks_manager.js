"use strict";

var $ = window.$ || require('jquery');


/*
 * get counts of annotations by meaningful blocks on the page,
 * given by 
 */
function BlocksManager(options) {
  this.document_element = options.document_element;
  this.document_id = options.document_id;
  this.counts_url = options.counts_url || BlocksManager.DEFAULTS.counts_url;
  this.counts_selector = options.counts_selector || BlocksManager.DEFAULTS.counts_selector;
  this.annotations_url = options.annotations_url || BlocksManager.DEFAULTS.annotations_url;
  this.counter_template = options.counter_template || BlocksManager.DEFAULTS.counter_template;
  this.xpathToSelector = require('./util').xpathToSelector;
  this.counts_array = [];
  
  // refresh placement of counters when browser window gets resized.
  $(window).on('resize', this.refreshCounters.bind(this));
  
  this.setDocumentEvents();
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
    var blocks_mgr = this;
    var counts_url = this.counts_url.replace(/\{doc-id\}/, this.document_id);
    return $.ajax(counts_url, { dataType: 'json' })
    .done(function (counts_array) {
      blocks_mgr.counts_array = counts_array;
      blocks_mgr.refreshCounters();
    })
  },
  
  refreshCounters: function () {
    // clear the counts div.
    var counts_div = $("#counts");
    counts_div.find(".counter").remove();
    
    var blocks_mgr = this;
    $(this.counts_array).each(function () {
      var count_obj = this;
      var block_element = blocks_mgr.document_element.find(blocks_mgr.xpathToSelector(count_obj.block_id));
      // create a counter and place it into the counts div.
      var counter = $(blocks_mgr.counter_template);
      counts_div.append(counter);
      counter.offset({ top: block_element.offset().top }).html(this.num_annotations_in_block);
      counter.click(function (evt) {
        // request the annotations for this block.
        blocks_mgr.getAnnotationsForBlock(count_obj);
      });
    });
  },
  
  removeCounters: function () {
    var counts_div = $("#counts");
    counts_div.find(".counter").remove();
  },

  getAnnotationsForBlock: function (count_obj) {
    // turn the block_id into something that's okay for a URL.
    var re = /(\w+)(?:\[)(\d+)(?:\])/g;
    var block_term_info;
    var block_terms = []
    while (block_term_info = re.exec(count_obj.block_id)) {
      if (block_term_info.length == 3) {
        block_terms.push(block_term_info[1] + "-" + block_term_info[2]);
      }
    }
    var block_url_param = block_terms.join("_");
    var block_mgr = this;
    var annotations_url = this.annotations_url.replace(/\{doc-id\}/, this.document_id);
    $.ajax(annotations_url + "/" + block_url_param)
      .done(function (block_annotations) {
        // if the app has a function to translate annotations as serialized into
        // annotations as Annotator needs them to be, apply that to the annotations.
        if (typeof block_mgr.app.translate === "function") {
          block_annotations = block_mgr.app.translate(block_annotations);
        }
        var e = $.Event("annotations-retrieved", { annotations: block_annotations });
        block_mgr.document_element.trigger(e);
      });
  },
        
  setDocumentEvents: function () {
    // when an annotation is deleted, just refresh all of the block markers on the page.
    var self = this;
    this.document_element
    .on("annotation-deleted annotation-created", self.getCounts)
    .on("document-element-changed", function (evt) {
      self.setDocumentEvents();
      self.removeCounters();
      self.document_element = evt.new_document_element;
      self.document_id = evt.document_id;
      self.getCounts();
    });
  }
});

exports.BlocksManager = BlocksManager;