/* The Max for Live device, run in Node on a pretend Max and a pretend Live.
 *   python3 ableton/kit/build.py ableton/device.json && node --test ableton/tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { load } = require('../kit/test/max.js');
require('../kit/test/palette_suite.js')();

const BUNDLE = path.join(__dirname, '..', 'OrchestrationHelper.js');
function device(opts) {
  const d = load(BUNDLE, Object.assign({ width: 760, height: 680 }, opts || {}));
  d.send('bang');
  d.run(100);
  d.show = () => { d.paint(); d.paint(); return d.texts(); };
  d.type = (s) => { for (const ch of s) d.send('key', ch.charCodeAt(0)); d.paint(); d.paint(); };
  d.clickOn = (label) => {
    const o = d.paint().find((x) => x.text === label);
    assert.ok(o, label + ' on screen');
    d.ctx.onclick(o.x + 3, o.y - 4, 1, 0, 0, 0, 0, 0); d.paint(); d.ctx.ondrag(o.x + 3, o.y - 4, 0); d.paint(); d.paint();
  };
  return d;
}

test('the guide opens, unchanged, with its data', () => {
  const d = device();
  const t = d.show();
  assert.strictEqual(d.ctx.R.error, null, d.ctx.R.error);
  assert.ok(t.includes('ORCHESTRATION HELPER'), t.slice(0, 12).join(' | '));
});

test('typing finds instruments, and Return opens one', () => {
  const d = device();
  d.type('horn');
  let t = d.show();
  assert.ok(t.some((s) => /Horn/.test(s)), t.slice(0, 20).join(' | '));
  d.send('key', 13);
  t = d.show();
  assert.ok(t.some((s) => /PAIRINGS|Pairings|BRASS/.test(s)), 'an entry opened: ' + t.slice(0, 20).join(' | '));
});

test('a composer and a mood are found too', () => {
  for (const q of ['Herrmann', 'mysterious']) {
    const d = device();
    d.type(q);
    assert.ok(/[1-9]\d* match/.test(d.show().join(' ')), q + ': ' + d.show().slice(0, 12).join(' | '));
  }
});

test('the Text Size menu opens and its choice is kept with the set', () => {
  const d = device();
  d.clickOn('Text Size');
  assert.ok(d.ctx.R.menu, 'the menu is open');
  const i = d.ctx.R.menu.items.findIndex((it) => it.label === '150%');
  d.ctx.chooseMenu(i);
  d.show();
  assert.strictEqual(d.ctx.R.menu, null);
  d.ctx.save();
  const saved = JSON.parse(d.out.filter((a) => a[0] === 1 && a[1] === 'set').pop()[2]);
  assert.ok(Object.values(saved.ext).includes('3') || Object.values(saved.ext).some((v) => /150|1\.5|3/.test(v)), JSON.stringify(saved.ext));
});
