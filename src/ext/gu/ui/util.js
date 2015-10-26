"use strict";


// id comes in as xpath, eg; /p[1] or /ol[2]/li[4]
// convert this to, eg; p:nth-of-type(1) or ol:nth-of-type(2) > li:nth-of-type(4).
function xpathToSelector (xpath) {
  // use the same regex as in the python Annotation model to parse the xpath.
  var re = /(\/(\w+)\[(\d+)\])/g;
  var term_info, selector;
  while (term_info = re.exec(xpath)) {
    // make sure the match is usable to us (has an element name and an index of which nbr element of that name).
    if ((term_info instanceof Array) && (term_info.length == 4)) {
      // init selector or add a direct descendant selector to it.
      if (!selector) {
        selector = term_info[2] + ":nth-of-type(" + term_info[3] + ")";
      } else {
        selector = selector + " > " + term_info[2] + ":nth-of-type(" + term_info[3] + ")";
      }
    }
  }

  return selector;
}


exports.xpathToSelector = xpathToSelector;