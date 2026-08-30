import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, ScatterplotLayer, LineLayer } from "@deck.gl/layers";
import Map from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GlassTooltip } from "./GlassTooltip";

interface GeographicContoursMapProps {
  olrData: {
    lat: number[];
    lon: number[];
    data: number[][];
  };
  precipData: {
    lat: number[];
    lon: number[];
    anomaly_percent: number[][];
  };
  windData: {
    lat: number[];
    lon: number[];
    u: number[][];
    v: number[][];
  };
  mapType: "olr" | "precip";
}

export const GeographicContoursMap = React.memo(({ olrData, precipData, windData, mapType }: GeographicContoursMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webGLAvailable, setWebGLAvailable] = useState<boolean>(true);
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const [viewState, setViewState] = useState({
    // Centralized over the equatorial Pacific
    longitude: -155, 
    latitude: 0,
    zoom: 1.5,
    minZoom: 1.0,
    maxZoom: 6,
    pitch: 0,
    bearing: 0
  });

  const [hoverState, setHoverState] = useState<{
    mouseX: number;
    mouseY: number;
    lonVal: number;
    latVal: number;
    val: number;
    visible: boolean;
  }>({ mouseX: 0, mouseY: 0, lonVal: 0, latVal: 0, val: 0, visible: false });

  // WebGL support detection
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setWebGLAvailable(!!gl);
    } catch {
      setWebGLAvailable(false);
    }
  }, []);

  // Standard animation frame loop for trade-wind particle streaming
  useEffect(() => {
    let animationFrameId: number;
    const updateAnimation = () => {
      setTimeOffset(prev => (prev + 0.015) % 1.0);
      animationFrameId = requestAnimationFrame(updateAnimation);
    };
    animationFrameId = requestAnimationFrame(updateAnimation);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Map longitude coordinate utility to fit [-180, 180]
  const mapLongitude = (lon: number) => (lon > 180 ? lon - 360 : lon);

  // Math: Calculate isoband contours using D3 contour generator
  const contourGeoJson = useMemo(() => {
    const activeData = mapType === "precip" ? precipData : olrData;
    const lons = activeData.lon;
    const lats = activeData.lat;
    const matrix = mapType === "precip" ? precipData.anomaly_percent : olrData.data;

    const gridWidth = lons.length;
    const gridHeight = lats.length;

    const flatGrid: number[] = [];
    matrix.forEach(row => {
      row.forEach(val => {
        flatGrid.push(val);
      });
    });

    const contourThresholds = mapType === "precip"
      ? [-3.0, -2.0, -1.0, -0.5, 0.0, 0.5, 1.0, 2.0, 3.0]
      : [-20, -15, -10, -5, 0, 5, 10, 15, 20];

    const contourGenerator = d3.contours()
      .size([gridWidth, gridHeight])
      .thresholds(contourThresholds);

    const contoursList = contourGenerator(flatGrid);

    // Transform coordinate grid [x, y] to [lon, lat]
    const features = contoursList.map((contour) => {
      const coords = contour.coordinates.map((polygon) => {
        return polygon.map((ring) => {
          return ring.map(([gx, gy]) => {
            const xIdx = Math.min(gridWidth - 1, Math.max(0, Math.floor(gx)));
            const yIdx = Math.min(gridHeight - 1, Math.max(0, Math.floor(gy)));
            
            const xPct = gx - Math.floor(gx);
            const yPct = gy - Math.floor(gy);

            const nextXIdx = Math.min(gridWidth - 1, xIdx + 1);
            const nextYIdx = Math.min(gridHeight - 1, yIdx + 1);

            const lon1 = lons[xIdx];
            const lon2 = lons[nextXIdx];
            const lat1 = lats[yIdx];
            const lat2 = lats[nextYIdx];

            const lon = lon1 + (lon2 - lon1) * xPct;
            const lat = lat1 + (lat2 - lat1) * yPct;

            return [mapLongitude(lon), lat];
          });
        });
      });

      return {
        type: "Feature" as const,
        geometry: {
          type: contour.type,
          coordinates: coords
        },
        properties: {
          value: contour.value
        }
      };
    });

    return {
      type: "FeatureCollection" as const,
      features
    };
  }, [olrData, precipData, mapType]);

  // Color generator for contours
  const getContourColor = (value: number): [number, number, number, number] => {
    if (mapType === "precip") {
      // Precip divergent scale: deep copper dry vs intense tropical wet green-blue
      const n = Math.max(-1, Math.min(1, value / 3.5));
      if (n < 0) {
        const t = n + 1; // 0 (copper) to 1 (slate background)
        const r = Math.round(234 * (1 - t) + 15 * t);
        const g = Math.round(88 * (1 - t) + 23 * t);
        const b = Math.round(12 * (1 - t) + 42 * t);
        return [r, g, b, 130];
      } else {
        const t = n; // 0 (slate background) to 1 (blue)
        const r = Math.round(15 * (1 - t) + 56 * t);
        const g = Math.round(23 * (1 - t) + 189 * t);
        const b = Math.round(42 * (1 - t) + 248 * t);
        return [r, g, b, 130];
      }
    } else {
      // OLR: convective green/blue cold vs suppressive hot red
      const n = Math.max(-1, Math.min(1, value / 22));
      if (n < 0) {
        const t = n + 1; // 0 (green) to 1 (slate background)
        const r = Math.round(5 * (1 - t) + 15 * t);
        const g = Math.round(150 * (1 - t) + 23 * t);
        const b = Math.round(105 * (1 - t) + 42 * t);
        return [r, g, b, 130];
      } else {
        const t = n; // 0 (slate background) to 1 (red)
        const r = Math.round(15 * (1 - t) + 239 * t);
        const g = Math.round(23 * (1 - t) + 68 * t);
        const b = Math.round(42 * (1 - t) + 68 * t);
        return [r, g, b, 130];
      }
    }
    return [0, 0, 0, 0];
  };

  // Math: 850hPa Trade Wind streams vector paths
  const windStreamlines = useMemo(() => {
    const windU = windData.u;
    const windV = windData.v;
    const windLons = windData.lon;
    const windLats = windData.lat;
    
    interface Streamline {
      start: [number, number];
      end: [number, number];
      u: number;
      v: number;
    }

    const streams: Streamline[] = [];
    windLats.forEach((laVal, laIdx) => {
      if (laIdx % 2 !== 0) return;
      windLons.forEach((loVal, loIdx) => {
        if (loIdx % 3 !== 0) return;

        const uVal = windU[laIdx]?.[loIdx] || 0;
        const vVal = windV[laIdx]?.[loIdx] || 0;
        const mappedLon = mapLongitude(loVal);
        
        // Scale vector for smooth line length
        const scaleVal = 1.0;
        const endLon = mappedLon + uVal * scaleVal;
        const endLat = laVal + vVal * scaleVal;

        streams.push({
          start: [mappedLon, laVal],
          end: [endLon, endLat],
          u: uVal,
          v: vVal
        });
      });
    });
    return streams;
  }, [windData]);

  // Animated moving wind streamlines particle centers
  const windParticles = useMemo(() => {
    return windStreamlines.map((st, i) => {
      const { start, end, u, v } = st;
      // Interpolate along the vector path based on timeOffset
      const lon = start[0] + (end[0] - start[0]) * timeOffset;
      const lat = start[1] + (end[1] - start[1]) * timeOffset;
      return {
        position: [lon, lat] as [number, number],
        color: u > 0 ? [239, 68, 68, 180] : [56, 189, 248, 180], // red (reversed) or blue (enhanced trades)
        radius: 120000 + Math.abs(u) * 150000,
        id: i
      };
    });
  }, [windStreamlines, timeOffset]);

  // Deck.gl dynamic layers assembly
  const layers = useMemo(() => {
    return [
      new GeoJsonLayer({
        id: "grid-contours-layer",
        data: contourGeoJson,
        filled: true,
        stroked: false,
        getFillColor: (f: any) => getContourColor(f.properties.value),
        pickable: true,
        onHover: (info: any) => {
          if (info.object && info.coordinate) {
            setHoverState({
              mouseX: info.x,
              mouseY: info.y,
              lonVal: Math.round(info.coordinate[0]),
              latVal: Math.round(info.coordinate[1]),
              val: info.object.properties.value,
              visible: true
            });
          } else {
            setHoverState(prev => ({ ...prev, visible: false }));
          }
        },
        updateTriggers: {
          getFillColor: [mapType]
        }
      }),
      new LineLayer({
        id: "wind-stream-static-layer",
        data: windStreamlines,
        getSourcePosition: (d: any) => d.start,
        getTargetPosition: (d: any) => d.end,
        getColor: (d: any) => d.u > 0 ? [239, 68, 68, 50] : [56, 189, 248, 50],
        getWidth: 1.5,
        pickable: false
      }),
      new ScatterplotLayer({
        id: "wind-particles-layer",
        data: windParticles,
        getPosition: (d: any) => d.position,
        getFillColor: (d: any) => d.color,
        getRadius: (d: any) => d.radius,
        pickable: false,
        updateTriggers: {
          getPosition: [timeOffset]
        }
      })
    ];
  }, [contourGeoJson, windStreamlines, windParticles, mapType]);

  // --- REGION: FALLBACK SVG RENDERING (when WebGL is not available) ---
  const fallbackRenderer = useMemo(() => {
    if (webGLAvailable) return null;

    const width = 600;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 30 };

    const projection = d3.geoMercator()
      .center([-155, 0])
      .scale(130)
      .translate([width / 2, height / 2]);

    const geoPath = d3.geoPath().projection(projection);

    const activeData = mapType === "precip" ? precipData : olrData;
    const lons = activeData.lon;
    const lats = activeData.lat;
    const matrix = mapType === "precip" ? precipData.anomaly_percent : olrData.data;

    const gridWidth = lons.length;
    const gridHeight = lats.length;

    const flatGrid: number[] = [];
    matrix.forEach(row => {
      row.forEach(val => {
        flatGrid.push(val);
      });
    });

    const contourThresholds = mapType === "precip"
      ? [-3.0, -2.0, -1.0, -0.5, 0.0, 0.5, 1.0, 2.0, 3.0]
      : [-20, -15, -10, -5, 0, 5, 10, 15, 20];

    const contourGenerator = d3.contours()
      .size([gridWidth, gridHeight])
      .thresholds(contourThresholds);

    const contoursList = contourGenerator(flatGrid);

    const transformPath = d3.geoPath()
      .projection(d3.geoTransform({
        point: function(x, y) {
          const lonVal = lons[Math.round(x)] || 180;
          const latVal = lats[Math.round(y)] || 0;
          const projected = projection([mapLongitude(lonVal), latVal]);
          if (projected) {
            this.stream.point(projected[0], projected[1]);
          }
        }
      }));

    // Generate static streamline segments with SVG coordinates
    const fallbackLines: any[] = [];
    windStreamlines.forEach(st => {
      const pStart = projection(st.start);
      const pEnd = projection(st.end);
      if (pStart && pEnd) {
        fallbackLines.push({
          x1: pStart[0],
          y1: pStart[1],
          x2: pEnd[0],
          y2: pEnd[1],
          u: st.u,
          v: st.v
        });
      }
    });

    // Interpolate animated flowing points in SVG space
    const fallbackParticles = fallbackLines.map(line => {
      const x = line.x1 + (line.x2 - line.x1) * timeOffset;
      const y = line.y1 + (line.y2 - line.y1) * timeOffset;
      return {
        cx: x,
        cy: y,
        color: line.u > 0 ? "rgba(239, 68, 68, 0.82)" : "rgba(56, 189, 248, 0.82)",
        r: 1.5 + Math.abs(line.u) * 0.5
      };
    });

    // Grid coordinates ticks
    const graticule = d3.geoGraticule()
      .extent([[-180, -35], [180, 35]])
      .step([20, 20]);

    const colorScaleD3 = d3.scaleDiverging<string>(d => {
      if (mapType === "precip") {
        return d < 0.5 
          ? d3.interpolateLab("#ea580c", "#1e293b")(d * 2) 
          : d3.interpolateLab("#1e293b", "#3b82f6")((d - 0.5) * 2);
      } else {
        return d < 0.5 
          ? d3.interpolateLab("#059669", "#1e293b")(d * 2) 
          : d3.interpolateLab("#1e293b", "#FF4E4E")((d - 0.5) * 2);
      }
    }).domain([
      mapType === "precip" ? -3.5 : -22, 
      0, 
      mapType === "precip" ? 3.5 : 22
    ]);

    const locations = [
      { name: "Indonesia", coord: [120, -5] },
      { name: "Tahiti", coord: [210, -17] },
      { name: "Galapagos", coord: [270, 0] },
      { name: "Ecuador", coord: [281, -1] }
    ];

    return {
      width,
      height,
      projection,
      graticulePath: geoPath(graticule()) || "",
      contours: contoursList.map((contour, i) => ({
        path: transformPath(contour) || "",
        fill: colorScaleD3(contour.value)
      })),
      fallbackLines,
      fallbackParticles,
      locations: locations.map(loc => {
        const pt = projection([mapLongitude(loc.coord[0]), loc.coord[1]]);
        return {
          name: loc.name,
          x: pt ? pt[0] : 0,
          y: pt ? pt[1] - 3 : 0
        };
      })
    };
  }, [webGLAvailable, contourGeoJson, windStreamlines, timeOffset, mapType]);

  const handleFallbackMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!fallbackRenderer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * fallbackRenderer.width;
    const mouseY = ((event.clientY - rect.top) / rect.height) * fallbackRenderer.height;

    const geoCoord = fallbackRenderer.projection.invert([mouseX, mouseY]);
    if (geoCoord) {
      const activeData = mapType === "precip" ? precipData : olrData;
      const lons = activeData.lon;
      const lats = activeData.lat;
      const matrix = mapType === "precip" ? precipData.anomaly_percent : olrData.data;

      const lonX = Math.round(geoCoord[0] < 0 ? geoCoord[0] + 360 : geoCoord[0]);
      const latY = Math.round(geoCoord[1]);

      let nearestLonIdx = 0;
      let minLonDiff = 999;
      lons.forEach((l, idx) => {
        const diff = Math.abs(l - (geoCoord[0] < 0 ? geoCoord[0] + 360 : geoCoord[0]));
        if (diff < minLonDiff) {
          minLonDiff = diff;
          nearestLonIdx = idx;
        }
      });

      let nearestLatIdx = 0;
      let minLatDiff = 999;
      lats.forEach((la, idx) => {
        const diff = Math.abs(la - geoCoord[1]);
        if (diff < minLatDiff) {
          minLatDiff = diff;
          nearestLatIdx = idx;
        }
      });

      setHoverState({
        mouseX,
        mouseY,
        lonVal: lons[nearestLonIdx],
        latVal: lats[nearestLatIdx],
        val: matrix[nearestLatIdx]?.[nearestLonIdx] || 0,
        visible: true
      });
    }
  };

  return (
    <div ref={containerRef} className="w-full h-[320px] relative overflow-hidden bg-[#0a0f1d] rounded-2xl border border-white/5 shadow-2xl">
      {webGLAvailable ? (
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState }: any) => setViewState(viewState)}
          controller={{ doubleClickZoom: false }}
          layers={layers}
          getCursor={() => "crosshair"}
        >
          <Map
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            mapLib={maplibregl}
            reuseMaps
          />
        </DeckGL>
      ) : (
        // High-fidelity fallback SVG renderer (seamless presentation)
        fallbackRenderer && (
          <svg
            viewBox={`0 0 ${fallbackRenderer.width} ${fallbackRenderer.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full select-none cursor-crosshair"
            onMouseMove={handleFallbackMouseMove}
            onMouseLeave={() => setHoverState(prev => ({ ...prev, visible: false }))}
          >
            {/* Filled contours */}
            <g opacity="0.45">
              {fallbackRenderer.contours.map((ct, idx) => (
                <path key={idx} d={ct.path} fill={ct.fill} />
              ))}
            </g>

            {/* Graticule grid lines */}
            <path
              d={fallbackRenderer.graticulePath}
              className="fill-none stroke-white/5 stroke-[0.5]"
              strokeDasharray="2, 4"
            />

            {/* Static arrow wind tracks */}
            <g className="stroke-white/10 stroke-[0.7] fill-none">
              {fallbackRenderer.fallbackLines.map((line, idx) => (
                <line
                  key={idx}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                />
              ))}
            </g>

            {/* Animating streaming trade particles */}
            <g>
              {fallbackRenderer.fallbackParticles.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.cx}
                  cy={pt.cy}
                  fill={pt.color}
                  r={pt.r}
                />
              ))}
            </g>

            {/* Locations labels */}
            {fallbackRenderer.locations.map((loc, idx) => (
              <text
                key={idx}
                x={loc.x}
                y={loc.y}
                className="text-[7px] font-mono fill-white/40 tracking-wider text-center"
                textAnchor="middle"
              >
                {loc.name}
              </text>
            ))}

            {/* Crosshair indicator */}
            {hoverState.visible && (
              <g>
                <circle
                  cx={hoverState.mouseX}
                  cy={hoverState.mouseY}
                  r="3.5"
                  className="fill-none stroke-amber-400 stroke-1"
                />
              </g>
            )}
          </svg>
        )
      )}

      {/* Frame Motion GlassTooltip */}
      <GlassTooltip
        x={hoverState.visible ? (hoverState.mouseX / (webGLAvailable ? window.innerWidth : 600)) * 100 + "%" : "0%"}
        y={hoverState.mouseY - 15}
        visible={hoverState.visible}
      >
        <div className="space-y-1.5 min-w-[145px]">
          <div className="font-extrabold text-[#38bdf8] text-[9px] border-b border-white/10 pb-0.5 uppercase tracking-widest mb-1">
            Planetary Geo-Grid
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Position:</span>
            <strong className="text-white">
              {hoverState.latVal}°N, {hoverState.lonVal}°E
            </strong>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Anomaly SSTA:</span>
            <strong className={hoverState.val >= 0 ? "text-red-400" : "text-sky-400"}>
              {hoverState.val >= 0 ? `+${hoverState.val.toFixed(2)}` : `${hoverState.val.toFixed(2)}`}
              {mapType === "precip" ? "% Precip" : " W/m² Convection"}
            </strong>
          </div>
        </div>
      </GlassTooltip>
    </div>
  );
});
