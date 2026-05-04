import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INPUT = 'F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH';
const DEFAULT_OUT = 'outputs/map-v2-road-network-preview.json';

const args = process.argv.slice(2);
const inputDir = args.includes('--input') ? args[args.indexOf('--input') + 1] : DEFAULT_INPUT;
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : DEFAULT_OUT;

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });
    return row;
  });
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDist = 0, maxIdx = 0;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > tolerance) {
    const left = simplify(points.slice(0, maxIdx + 1), tolerance);
    const right = simplify(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function perpDist(pt, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
  let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

// Load data
console.log('Loading road network data from:', inputDir);

const geojson = JSON.parse(fs.readFileSync(path.join(inputDir, 'lanes.geojson'), 'utf8'));
const roadsCsv = parseCsv(fs.readFileSync(path.join(inputDir, 'roads.csv'), 'utf8'));
const junctionsCsv = parseCsv(fs.readFileSync(path.join(inputDir, 'junctions.csv'), 'utf8'));
const laneNodesCsv = parseCsv(fs.readFileSync(path.join(inputDir, 'lane_nodes.csv'), 'utf8'));

const laneNodesMap = new Map();
for (const row of laneNodesCsv) {
  const lid = Number(row.lane_id);
  if (!laneNodesMap.has(lid)) laneNodesMap.set(lid, []);
  laneNodesMap.get(lid).push({ x: Number(row.x), y: Number(row.y) });
}

console.log(`  ${geojson.features.length} lanes, ${roadsCsv.length} roads, ${junctionsCsv.length} junctions`);

// Process lanes
const allX = [], allY = [];
const lanes = geojson.features.map(f => {
  const coords = f.geometry.coordinates.map(c => ({ x: c[0], y: c[1] }));
  coords.forEach(c => { allX.push(c.x); allY.push(c.y); });
  const simplified = simplify(coords, 3);
  return {
    lane_id: f.properties.lane_id,
    type: f.properties.type,
    parent_id: f.properties.parent_id,
    width_m: f.properties.width_m,
    coords: simplified
  };
});

// Coordinate conversion
const minX = Math.min(...allX), maxX = Math.max(...allX);
const minY = Math.min(...allY), maxY = Math.max(...allY);

const PROJ_LAT0 = 18.393453;
const PROJ_LON0 = 110.015821;
const latRad = PROJ_LAT0 * Math.PI / 180;
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos(latRad);

function toLatLng(x, y) {
  return {
    lat: PROJ_LAT0 + y / M_PER_DEG_LAT,
    lng: PROJ_LON0 + x / M_PER_DEG_LNG
  };
}

// Convert lanes
const convertedLanes = lanes.map(l => {
  const points = l.coords.map(c => {
    const ll = toLatLng(c.x, c.y);
    return [Math.round(ll.lat * 1e6) / 1e6, Math.round(ll.lng * 1e6) / 1e6];
  });
  return {
    lane_id: l.lane_id,
    type: l.type,
    parent_id: l.parent_id,
    width_m: l.width_m,
    points
  };
});

// Aggregate roads
const lanesByRoad = new Map();
for (const lane of convertedLanes) {
  const rid = lane.parent_id;
  if (!lanesByRoad.has(rid)) lanesByRoad.set(rid, []);
  lanesByRoad.get(rid).push(lane);
}

const roads = [];
for (const [roadId, roadLanes] of lanesByRoad) {
  const csvRow = roadsCsv.find(r => Number(r.road_id) === roadId);
  const ref = roadLanes[0];
  const pts = ref.points;
  const simplified = pts.length > 100
    ? pts.filter((_, i) => i % 5 === 0 || i === pts.length - 1)
    : pts;
  roads.push({
    road_id: roadId,
    lane_count: csvRow ? Number(csvRow.lane_count) : roadLanes.length,
    road_type: ref.type === 'LANE_TYPE_DRIVING' ? 'driving' : 'walking',
    width_m: ref.width_m,
    points: simplified
  });
}
roads.sort((a, b) => a.road_id - b.road_id);

// Extract junctions
const junctions = [];
for (const row of junctionsCsv) {
  const jxId = Number(row.junction_id);
  const laneIds = row.lane_ids.split(';').map(Number);
  const xs = [], ys = [];
  for (const lid of laneIds) {
    const nodes = laneNodesMap.get(lid);
    if (nodes && nodes.length > 0) {
      xs.push(nodes[0].x);
      ys.push(nodes[0].y);
    }
  }
  if (xs.length === 0) continue;
  const avgX = xs.reduce((s, v) => s + v, 0) / xs.length;
  const avgY = ys.reduce((s, v) => s + v, 0) / ys.length;
  const ll = toLatLng(avgX, avgY);
  junctions.push({
    junction_id: jxId,
    lane_count: Number(row.lane_count),
    position: { lat: Math.round(ll.lat * 1e6) / 1e6, lng: Math.round(ll.lng * 1e6) / 1e6 }
  });
}

// Write output
const preview = {
  source: 'road_network_mapWITH',
  projection: '+proj=tmerc +lat_0=18.393453 +lon_0=110.015821',
  generatedAt: new Date().toISOString(),
  counts: { lanes: convertedLanes.length, roads: roads.length, junctions: junctions.length },
  transform: { translateX: 0, translateY: 0, scale: 1, rotation: 0 },
  lanes: convertedLanes,
  roads,
  junctions
};

const outPath = path.resolve(outFile);
await fsp.mkdir(path.dirname(outPath), { recursive: true });
await fsp.writeFile(outPath, JSON.stringify(preview));

const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(preview)) / 1024);
console.log(`Wrote ${outPath} (${sizeKB} KB)`);
console.log(`  ${convertedLanes.length} lanes, ${roads.length} roads, ${junctions.length} junctions`);
console.log(`  Center: ${PROJ_LAT0}, ${PROJ_LON0}`);
console.log(`  Coord range: x [${minX.toFixed(0)}, ${maxX.toFixed(0)}] y [${minY.toFixed(0)}, ${maxY.toFixed(0)}]`);
