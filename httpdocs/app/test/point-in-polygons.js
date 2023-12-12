'use strict';

import {
  pointInPolygons
} from '../js/point-in-polygons.js';

(function() { // use an iife to avoid poluting the name space
  const simplePolygon = [[
    [-81, 41],
    [-81, 47],
    [-72, 47],
    [-72, 41],
    [-81, 41]
  ]];
  const complexPolygon = [[
    [6.580283392715472, 46.55931864469471],
    [6.553971503056303, 46.5735112999519],
    [6.558744167476959, 46.54338501301066],
    [6.599167636117656, 46.53674154510384],
    [6.616732061457611, 46.55982195369393],
    [6.611854553871325, 46.56787643378742],
    [6.603721478541644, 46.55389912810965],
    [6.591673688972776, 46.54364710901509],
    [6.576234251944868, 46.550904326393095],
    [6.580283392715472, 46.55931864469471]
  ]];
  const simplePolygonWithHole = [[
    [6.535251373390679, 45.561036085823645],
    [6.583417384244768, 45.554928096299676],
    [6.586915451108183, 45.576806788028364],
    [6.559532442175396, 45.574355705773314],
    [6.535251373390679, 45.561036085823645]
  ], [
    [6.56201472166731, 45.56460187515529],
    [6.5710694814515875, 45.56717594036627],
    [6.563173032737637, 45.568751749349644],
    [6.56201472166731, 45.56460187515529]
  ]];
  const complexPolygonWithTwoHoles = [[
    [6.535251373390679, 44.561036085823645],
    [6.583417384244768, 44.554928096299676],
    [6.586915451108183, 44.576806788028364],
    [6.574946699711077, 44.57068945518529],
    [6.559532442175396, 44.574355705773314],
    [6.566513975062463, 44.602617829577035],
    [6.530980852183859, 44.58269014395533],
    [6.535251373390679, 44.561036085823645]
  ], [
    [6.544086886082965, 44.588398117055476],
    [6.551867385554914, 44.585056292072665],
    [6.559337999955716, 44.58781932601079],
    [6.556529600801369, 44.59279087533699],
    [6.544086886082965, 44.588398117055476]
  ], [
    [6.578202303830466, 44.56875921310893],
    [6.5679832876336945, 44.56566792423618],
    [6.5824890184856315, 44.56532507698631],
    [6.578202303830466, 44.56875921310893]
  ]];
  function test(desc, func) {
    const results = document.getElementById('results');
    const line = document.createElement('div');
    results.appendChild(line);
    try {
      func();
      line.style.color = '#090'; // green
      line.innerHTML = '✔ ' + desc;
    } catch (error) {
      line.style.color = '#C00'; // red
      line.style.fontWeight = 'bold';
      line.innerHTML = '✘ ' + desc + '<br />⇒ ' + error;
    }
  }
  function assert(isTrue, failureMessage) {
    if (!isTrue)
      throw new Error(failureMessage || 'Assertion failed.');
  }
  test('simple polygon', function() {
    assert(pointInPolygons([-77, 44], simplePolygon));
    assert(!pointInPolygons([-82, 44], simplePolygon));
  });
  test('complex polygon', function() {
    assert(!pointInPolygons([6.587365078631194, 46.55110902203492], complexPolygon));
    assert(pointInPolygons([6.610183719810692, 46.557907102583016], complexPolygon));
  });
  test('simple polygon with hole', function() {
    assert(!pointInPolygons([6.565072500002572, 45.56688965555827], simplePolygonWithHole));
    assert(pointInPolygons([6.57503967728141, 45.56388514978303], simplePolygonWithHole));
    assert(!pointInPolygons([6.543667241484911, 45.56989939276502], simplePolygonWithHole));
  });
  test('complex polygon with two holes', function() {
    assert(pointInPolygons([6.543667241484911, 44.56989939276502], complexPolygonWithTwoHoles));
    assert(!pointInPolygons([6.5524009424974, 44.588673706834925], complexPolygonWithTwoHoles));
    assert(!pointInPolygons([6.576388095548481, 44.56726954087392], complexPolygonWithTwoHoles));
    assert(!pointInPolygons([6.569319242776714, 44.575851870310686], complexPolygonWithTwoHoles));
    assert(pointInPolygons([6.584296642593046, 44.56911716362936], complexPolygonWithTwoHoles));
  });
  test('composite polygons', function() {
    const compositePolygons = [complexPolygon, simplePolygonWithHole, complexPolygonWithTwoHoles];
    assert(!pointInPolygons([6.587365078631194, 46.55110902203492], compositePolygons));
    assert(pointInPolygons([6.610183719810692, 46.557907102583016], compositePolygons));
    assert(!pointInPolygons([6.565072500002572, 45.56688965555827], compositePolygons));
    assert(pointInPolygons([6.57503967728141, 45.56388514978303], compositePolygons));
    assert(!pointInPolygons([6.543667241484911, 45.56989939276502], compositePolygons));
    assert(pointInPolygons([6.543667241484911, 44.56989939276502], compositePolygons));
    assert(!pointInPolygons([6.5524009424974, 44.588673706834925], compositePolygons));
    assert(!pointInPolygons([6.576388095548481, 44.56726954087392], compositePolygons));
    assert(!pointInPolygons([6.569319242776714, 44.575851870310686], compositePolygons));
    assert(pointInPolygons([6.584296642593046, 44.56911716362936], compositePolygons));
  });
})();
