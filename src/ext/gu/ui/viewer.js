var Viewer = exports.Viewer = function (options) {
    this.options = options || {};
    this.element = this.options.element || null; // provide from app??
    this.element = $(this.element);
}