var assert = require('assertive-chai').assert;

var h = require('../../../helpers');
var $ = require('../../../../src/util').$;

var gu_ui = require('../../../../src/ext/gu/ui/main.js').ui;
var Editor = require('../../../../src/ext/gu/ui/editor').Editor;
var Viewer = require('../../../../src/ext/gu/ui/viewer').Viewer;
var Highlighter = require('../../../../src/ext/gu/ui/highlighter').Highlighter;
var TextSelector = require('../../../../src/ext/gu/ui/textselector').TextSelector;
var LineNbrTextSelector = require('../../../../src/ext/gu/ui/linenbr_textselector').LineNbrTextSelector;
var BlocksManager = require('../../../../src/ext/gu/ui/blocks').BlocksManager;

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
  
  it('should create instances of each of the GU ui modules', function () {
    gu_ui({ linenbr_selector: true }).start(mockApp);
    assert.instanceOf(gu_ui.editor, Editor);
    assert.instanceOf(gu_ui.viewer, Viewer);
    assert.instanceOf(gu_ui.highlighter, Highlighter);
    assert.instanceOf(gu_ui.text_selector, TextSelector);
    assert.instanceOf(gu_ui.linenbr_textselector, LineNbrTextSelector);
    assert.instanceOf(gu_ui.blocks_manager, BlocksManager);
  });
  
});


