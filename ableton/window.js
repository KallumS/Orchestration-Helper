// The picture in the README: `node ableton/window.js` redraws ableton/window.png.
// "trom" typed into the search box.
require('./kit/test/picture.js')(__dirname, { bundle: 'OrchestrationHelper.js', w: 760, h: 680,
  go(d) { d.ctx.paint(); 'trom'.split('').forEach((c) => { d.send('key', c.charCodeAt(0)); d.ctx.paint(); }); d.ctx.paint(); } });
