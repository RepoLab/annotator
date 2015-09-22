var assert = require('assertive-chai').assert;

var h = require('../../../helpers');
var $ = require('../../../../src/util').$;

var adder = require('../../../../src/ext/gu/ui/adder');
var editor = require('../../../../src/ext/gu/ui/editor');
var highlighter = require('../../../../src/ui/highlighter');
var textselector = require('.../../../../src/ui/textselector');
var viewer = require('../../../../src/ext/gu/ui/viewer');

var gu_ui = require('../../../../src/ext/gu/ui/main.js').main;


describe("annotator.ext.gu.ui module", function () {
  var sandbox;
  var mockAuthz;
  var mockIdent;
  var mockApp;

  beforeEach(function () {
      sandbox = sinon.sandbox.create();
      mockAuthz = {
          permits: sandbox.stub().returns(true),
          authorizedUserId: function (u) { return u; }
      };
      mockIdent = {who: sandbox.stub().returns('alice')};
      mockApp = {
          annotations: {create: sandbox.stub()},
          registry: {
              getUtility: sandbox.stub()
          }
      };
      mockApp.registry.getUtility.withArgs('authorizationPolicy').returns(mockAuthz);
      mockApp.registry.getUtility.withArgs('identityPolicy').returns(mockIdent);
  });

  afterEach(function () {
      sandbox.restore();
      h.clearFixtures();
  });

  it('should attach the TextSelector to the document body by default', function () {
      sandbox.stub(textselector, 'TextSelector');

      var plug = gu_ui();
      plug.start(mockApp);

      sinon.assert.calledWith(textselector.TextSelector, document.body);
  });
  
  it("loads modules from both annotator.ui and annotator.ext.gu.ui", function () {
    assert.isFalse(gu_ui===null);
  });
});


