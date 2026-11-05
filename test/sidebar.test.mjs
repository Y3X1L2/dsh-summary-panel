import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SummaryVisibility} from '../src/sidebar.js';

test('sidebar temporarily hides an open summary and restores it on return',()=>{
  const summary=new SummaryVisibility();
  assert.equal(summary.toggle(),true);
  assert.equal(summary.sidebar(true),false);
  assert.equal(summary.sidebar(true),false);
  assert.equal(summary.sidebar(false),true);
  assert.equal(summary.sidebar(false),true);
  assert.equal(summary.sidebar(true),false);
  assert.equal(summary.sidebar(false),true);
});

test('a previously closed summary stays closed, including an initially open sidebar',()=>{
  for(const initiallyExpanded of [false,true]){
    const summary=new SummaryVisibility(initiallyExpanded);
    assert.equal(summary.sidebar(true),false);
    assert.equal(summary.sidebar(false),false);
  }
});

test('manual choices inside the sidebar take precedence over temporary restoration',()=>{
  const summary=new SummaryVisibility(true);
  assert.equal(summary.toggle(),true);
  assert.equal(summary.sidebar(false),true);
  assert.equal(summary.sidebar(true),false);
  assert.equal(summary.toggle(),true);
  assert.equal(summary.toggle(),false);
  assert.equal(summary.sidebar(false),false);
  assert.equal(summary.toggle(),true);
  assert.equal(summary.toggle(),false);
  assert.equal(summary.sidebar(true),false);
  assert.equal(summary.sidebar(false),false);
});
