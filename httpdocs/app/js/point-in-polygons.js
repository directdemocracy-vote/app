'use strict';
/* Example:
 * const point = [-77, 44];
 * const polygons = [[
 *   [-81, 41],
 *   [-81, 47],
 *   [-72, 47],
 *   [-72, 41],
 *   [-81, 41]
 * ]];
 *
 * console.log(pointInPolygons(point, polygons));
 * > true
 */
export function pointInPolygons(point, polygons) {
  // normalize to multipolygon
  if (!Array.isArray(polygons[0][0][0])) {
    console.log('normalized');
    polygons = [polygons];
    console.log(polygons[0][0][0][0]);
  }
  // quick elimination if point is not inside bounding box
  if (isInBoundBox(point, polygons) === false) {
    console.log('outside bbox');
    return false;
  }

  let insidePolygon = false;
  for (let i = 0; i < polygons.length && !insidePolygon; i++) {
    if (inRing(point, polygons[i][0], false)) { // check if it is in the outer ring first
      let inHole = false;
      let k = 1;
      while (k < polygons[i].length && !inHole) { // check for the point in any of the holes
        if (inRing(point, polygons[i][k], true))
          inHole = true;
        k++;
      }
      if (!inHole)
        insidePolygon = true;
    }
  }
  return insidePolygon;
}

function inRing(point, ring, ignoreBoundary) {
  let isInside = false;
  if (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
    ring = ring.slice(0, ring.length - 1);

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const onBoundary = point[1] * (xi - xj) + yi * (xj - point[0]) + yj * (point[0] - xi) === 0 &&
            (xi - point[0]) * (xj - point[0]) <= 0 &&
            (yi - point[1]) * (yj - point[1]) <= 0;
    if (onBoundary) {
      console.log(!ignoreBoundary);
      return !ignoreBoundary;
    }

    const intersect = (yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersect)
      isInside = !isInside;
  }
  return isInside;
}

function isInBoundBox(point, polygons) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const polygon of polygons) {
    if (polygon.length === 0 || polygon[0].length === 0)
      continue;
    for (const vertex of polygon[0]) {
      console.log(vertex);
      if (vertex[0] > xMax)
        xMax = vertex[0];
      if (vertex[0] < xMin)
        xMin = vertex[0];
      if (vertex[1] > yMax)
        yMax = vertex[1];
      if (vertex[1] < yMin)
        yMin = vertex[1];
    }
  }
  console.log('(' + xMin + ', ' + yMin + ') - (' + xMax + ', ' + yMax + ')');
  if (point[0] > xMax) {
    console.log(point[0] + ' > ' + xMax);
    return false;
  }
  if (point[0] < xMin) {
    console.log(point[0] + ' < ' + xMin);
    return false;
  }
  if (point[1] > yMax) {
    console.log(point[1] + ' > ' + yMax);
    return false;
  }
  if (point[1] < yMin) {
    console.log(point[1] + ' < ' + yMin);
    return false;
  }
  return true;
}
