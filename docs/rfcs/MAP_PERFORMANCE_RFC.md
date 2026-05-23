# RFC: Leaflet Map Performance Optimization

**Status:** Draft  
**Created:** 2026-05-24  
**Authors:** LIAN Engineering Team

## 1. Summary

This RFC proposes a phased optimization strategy for the Leaflet-based map rendering system in lian-mobile-web. The current implementation suffers from performance issues at scale, particularly on mobile devices. This document outlines the problems, proposed solutions, and implementation phases.

## 2. Current Architecture

### 2.1 Core Components

| File | Responsibility |
|------|----------------|
| `src/features/map/MapCanvas.vue` | Map container, Leaflet instance lifecycle, layer group initialization |
| `src/features/map/useMapLayers.ts` | Layer rendering orchestration, marker/area/route management |
| `src/features/map/useMapRoads.ts` | Road network rendering with multi-layer visual styling |
| `src/features/map/mapIcons.ts` | Icon generation for locations, posts, and assets |
| `src/features/map/useMapIconScale.ts` | Zoom-responsive icon scaling |

### 2.2 Layer Structure

The map uses 7 distinct layer groups:

```
areas        → Polygon overlays (campus zones)
roadsCasing  → Road shadows and edge highlights
roads        → Road asphalt surfaces and centerlines
routes       → Navigation/shuttle routes
assets       → Static image markers
locations    → Interactive location markers
posts        → Interactive post markers
```

### 2.3 Current Render Limits

```typescript
const MAX_RENDERED_LOCATIONS = 120;
const MAX_RENDERED_POSTS = 60;
const MAX_RENDERED_ASSETS = 120;
```

## 3. Performance Problems

### 3.1 Full-Redraw Pattern

Every `renderMap()` call executes `clearLayers()` followed by complete reconstruction:

```typescript
function renderMap() {
  clearLayers();        // Destroys all DOM elements
  renderAreas();        // Recreates from scratch
  renderRoads(...);     // Recreates from scratch
  renderRoutes();       // Recreates from scratch
  renderAssets();       // Recreates from scratch
  renderMarkers();      // Recreates from scratch
}
```

This triggers on every zoom/pan event, causing:
- Excessive DOM churn (create/destroy cycles)
- GC pressure from short-lived Leaflet objects
- Visible flicker during rapid interactions

### 3.2 Road Layer Explosion

Each road segment creates 4-5 separate polylines:

```typescript
// Per road segment in renderDualLaneRoad():
1. Shadow polyline      → roadsCasing
2. Edge polyline        → roadsCasing
3. Asphalt polyline     → roads
4. Highlight polyline   → roads
5. Centerline polyline  → roads (conditional)
```

With 50 road segments, this produces 200-250 DOM elements just for roads.

### 3.3 No Spatial Clustering

All markers within render limits are displayed regardless of zoom level or viewport bounds:

```typescript
// Current: renders all up to limit, no spatial awareness
renderedLocations.value.forEach((location) => {
  const m = getLeaflet().marker(position, {...});
  m.addTo(layers.locations);
});
```

At low zoom levels, markers overlap heavily, wasting render cycles on invisible content.

### 3.4 No Viewport Culling

Markers outside the visible viewport are still rendered and maintained in the DOM.

### 3.5 Memory Pressure on Mobile

No device-aware throttling. Low-end mobile devices receive the same render workload as desktop browsers.

## 4. Performance Targets

| Metric | Current (est.) | Target |
|--------|----------------|--------|
| Initial render | 200-400ms | <100ms |
| Zoom/pan response | 100-200ms | <50ms |
| Frame rate during interaction | 30-45fps | >55fps |
| Memory footprint (mobile) | 80-120MB | <60MB |
| DOM element count (typical) | 400-600 | <200 |

## 5. Proposed Solution

### Phase 1: Layer Diff Mechanism

Replace full-redraw with incremental updates.

**Key Changes:**

1. **Stable ID tracking** for all map entities:
```typescript
interface TrackedMapEntity {
  id: string;
  version: number;  // Increment on data change
  leafletRef: WeakRef<L.Layer>;
}
```

2. **Diff-based render**:
```typescript
function renderMapIncremental(prev: MapState, next: MapState) {
  const diff = computeDiff(prev, next);
  diff.removed.forEach(id => removeLayer(id));
  diff.added.forEach(entity => addLayer(entity));
  diff.updated.forEach(entity => updateLayer(entity));
}
```

3. **Event debouncing**:
```typescript
// Debounce rapid zoom/pan events
map.on('zoomend moveend', debounce(renderMapIncremental, 16));
```

**Expected Impact:**
- 60-80% reduction in DOM operations during typical interactions
- Eliminates flicker on zoom/pan

### Phase 2: Supercluster Integration

Implement marker clustering using [supercluster](https://github.com/mapbox/supercluster).

**Architecture:**

```typescript
import Supercluster from 'supercluster';

const clusterIndex = new Supercluster({
  radius: 60,      // Cluster radius in pixels
  maxZoom: 17,     // Max zoom to cluster at
  minPoints: 3,    // Min points to form cluster
});

// Index all points once
clusterIndex.load(allMarkerFeatures);

// On viewport change, get visible clusters
function getVisibleMarkers(bounds: L.LatLngBounds, zoom: number) {
  return clusterIndex.getClusters(
    [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    Math.floor(zoom)
  );
}
```

**Cluster Rendering:**

```typescript
function renderCluster(cluster: ClusterFeature) {
  const count = cluster.properties.point_count;
  const size = Math.min(40, 20 + Math.sqrt(count) * 4);
  
  return L.divIcon({
    html: `<div class="map-cluster">${count}</div>`,
    className: 'map-cluster-icon',
    iconSize: [size, size],
  });
}
```

**Expected Impact:**
- 70-90% reduction in marker count at low zoom levels
- Smoother zoom transitions
- Better visual clarity

### Phase 3: Progressive Degradation Strategy

Implement 4-tier fallback based on data volume:

| Tier | Condition | Strategy |
|------|-----------|----------|
| Normal | <200 entities | Full render with clustering |
| Clustered | 200-500 entities | Aggressive clustering (radius: 80) |
| Viewport-only | 500-2000 entities | Only render visible viewport + buffer |
| Server-paged | >2000 entities | Request paginated data from backend |

**Implementation:**

```typescript
type RenderTier = 'normal' | 'clustered' | 'viewport' | 'paged';

function selectRenderTier(entityCount: number): RenderTier {
  if (entityCount < 200) return 'normal';
  if (entityCount < 500) return 'clustered';
  if (entityCount < 2000) return 'viewport';
  return 'paged';
}

function renderWithTier(tier: RenderTier, data: MapData) {
  switch (tier) {
    case 'normal':
      return renderNormal(data);
    case 'clustered':
      return renderClustered(data, { radius: 80 });
    case 'viewport':
      return renderViewportOnly(data, getCurrentBounds());
    case 'paged':
      return requestPagedData(getCurrentBounds(), getCurrentZoom());
  }
}
```

**Backend Support (Phase 3b):**

```typescript
// New API endpoint
GET /api/map/v2/items?bounds=south,west,north,east&zoom=16&limit=500

// Response includes pagination cursor
{
  items: [...],
  cursor: "eyJ0aWQiOjEyMzR9",
  hasMore: true
}
```

### Phase 4: Mobile Memory Optimization

**Device Detection:**

```typescript
interface DeviceProfile {
  tier: 'low' | 'mid' | 'high';
  maxMarkers: number;
  maxRoadSegments: number;
  clusterRadius: number;
}

function detectDeviceProfile(): DeviceProfile {
  const memory = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  
  if (memory <= 2 || cores <= 2) {
    return { tier: 'low', maxMarkers: 50, maxRoadSegments: 20, clusterRadius: 100 };
  }
  if (memory <= 4 || cores <= 4) {
    return { tier: 'mid', maxMarkers: 100, maxRoadSegments: 40, clusterRadius: 70 };
  }
  return { tier: 'high', maxMarkers: 200, maxRoadSegments: 80, clusterRadius: 50 };
}
```

**Memory Monitoring:**

```typescript
function setupMemoryMonitor(onPressure: () => void) {
  if ('memory' in performance) {
    const checkMemory = () => {
      const { usedJSHeapSize, jsHeapSizeLimit } = (performance as any).memory;
      const usage = usedJSHeapSize / jsHeapSizeLimit;
      if (usage > 0.85) {
        onPressure();
      }
    };
    setInterval(checkMemory, 5000);
  }
}

// On memory pressure: reduce render limits, force GC-friendly cleanup
function handleMemoryPressure() {
  currentProfile.maxMarkers = Math.floor(currentProfile.maxMarkers * 0.6);
  forceLayerCleanup();
}
```

**Road Simplification for Mobile:**

```typescript
function simplifyRoadsForMobile(roads: MapRoad[]): MapRoad[] {
  // Skip shadow and highlight layers on low-tier devices
  // Reduce polyline point density
  return roads.map(road => ({
    ...road,
    points: simplifyPath(road.points, tolerance: 0.0001),
    style: { ...road.style, skipShadow: true, skipHighlight: true }
  }));
}
```

## 6. Implementation Plan

| Phase | Scope | Effort | Dependencies |
|-------|-------|--------|--------------|
| Phase 1 | Layer diff | 3-4 days | None |
| Phase 2 | Supercluster | 2-3 days | Phase 1 |
| Phase 3 | Degradation tiers | 3-4 days | Phase 2 |
| Phase 3b | Backend paging | 2-3 days | Phase 3 |
| Phase 4 | Mobile optimization | 2-3 days | Phase 1 |

**Total estimated effort:** 12-17 days

**Recommended order:** Phase 1 → Phase 4 → Phase 2 → Phase 3 → Phase 3b

Rationale: Phase 1 provides the foundation. Phase 4 addresses immediate mobile pain points. Phase 2/3 add scalability for future growth.

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supercluster bundle size (+8KB gzip) | Slower initial load | Lazy-load on first map view |
| Diff algorithm bugs | Visual glitches | Comprehensive test coverage, fallback to full redraw |
| Device detection inaccuracy | Wrong tier selection | Conservative defaults, user override option |
| Backend paging latency | Delayed marker appearance | Optimistic rendering with placeholders |

## 8. Success Metrics

Post-implementation validation:

1. **Lighthouse Performance Score:** Map view should score >80 on mobile
2. **Core Web Vitals:** INP <200ms during map interactions
3. **Memory profiling:** No memory leaks over 10-minute interaction session
4. **User-reported jank:** <5% of map-related feedback mentions lag/stutter

## 9. Future Considerations

- **WebGL rendering:** Consider deck.gl or mapbox-gl for >10K markers
- **Web Workers:** Offload clustering computation to worker thread
- **Tile-based markers:** Pre-render marker tiles at fixed zoom levels
- **Virtual scrolling for lists:** Apply similar patterns to FeedList

## 10. References

- [Leaflet Performance Tips](https://leafletjs.com/examples/choropleth/)
- [Supercluster](https://github.com/mapbox/supercluster)
- [deck.gl](https://deck.gl/) for WebGL-based rendering
- [Web Performance Working Group](https://www.w3.org/webperf/)
