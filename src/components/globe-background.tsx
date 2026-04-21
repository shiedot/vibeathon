"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";

// We avoid a direct dependency on `@types/geojson` /
// `@types/topojson-specification` (pnpm doesn't hoist transitive type
// packages), so the shapes we actually touch are typed locally.
type CountryFeature = {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
};

type TopoJsonLike = {
  objects: Record<string, unknown>;
};

type RawProjection = (
  lambda: number,
  phi: number,
) => [number, number];

/**
 * The runtime return of `geoProjectionMutator(factory)` accepts the same extra
 * args as `factory`, even though @types/d3-geo types it as `() => GeoProjection`.
 * We widen it here.
 */
type Mutator = (t: number) => d3.GeoProjection;

type InterpolatedProjection = d3.GeoProjection & {
  alpha: ((t: number) => InterpolatedProjection) & (() => number);
};

function interpolateProjection(
  raw0: RawProjection,
  raw1: RawProjection,
): InterpolatedProjection {
  const mutate = d3.geoProjectionMutator(
    ((t: number) => (x: number, y: number) => {
      const [x0, y0] = raw0(x, y);
      const [x1, y1] = raw1(x, y);
      return [x0 + t * (x1 - x0), y0 + t * (y1 - y0)];
    }) as unknown as () => d3.GeoRawProjection,
  ) as unknown as Mutator;

  let t = 0;
  const projection = mutate(t) as InterpolatedProjection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (projection as any).alpha = function (_?: number) {
    if (_ === undefined) return t;
    t = +_;
    return mutate(t) as InterpolatedProjection;
  };
  return projection;
}

const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const WIDTH = 800;
const HEIGHT = 500;
const UNROLL_DURATION_MS = 2000;

/** Dhaka, Bangladesh — [longitude, latitude]. */
const DHAKA: [number, number] = [90.4125, 23.8103];
/**
 * Degrees of longitude to offset Dhaka from the screen's horizontal center.
 * Positive = push Dhaka to the right (we center a point west of Dhaka), so
 * the pin/label clears the hero headline instead of colliding with it.
 */
const DHAKA_SCREEN_OFFSET_LON = 62;
/**
 * Initial orthographic rotation — offset so Dhaka sits right-of-center on
 * the globe, leaving the headline readable while the pin remains on the
 * visible hemisphere from first paint.
 */
const INITIAL_ROTATION: [number, number] = [
  -DHAKA[0] + DHAKA_SCREEN_OFFSET_LON,
  -DHAKA[1],
];
/**
 * Target rotation at the end of unroll. Preserve the horizontal offset so
 * Dhaka stays right-of-center on the flat map too; drop the latitude tilt
 * so the equirectangular projection sits upright.
 */
const END_ROTATION: [number, number] = [
  -DHAKA[0] + DHAKA_SCREEN_OFFSET_LON,
  0,
];

export interface GlobeBackgroundProps {
  /** Flip to true to play the globe → flat map animation. */
  unroll: boolean;
  /** Fires once the unroll animation fully completes. */
  onUnrollComplete?: () => void;
  /** Tailwind className applied to the outer wrapper. */
  className?: string;
  /** Opacity of strokes (0..1). Default 0.6 so content stays readable. */
  strokeOpacity?: number;
  /**
   * Optional starting progress value. 0 = full orthographic globe (default),
   * 1 = fully unrolled equirectangular map. Use this on pages the user lands
   * on *after* an unroll animation so the background stays flat.
   */
  initialProgress?: number;
}

export function GlobeBackground({
  unroll,
  onUnrollComplete,
  className,
  strokeOpacity = 0.6,
  initialProgress = 0,
}: GlobeBackgroundProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [worldData, setWorldData] = useState<CountryFeature[]>([]);
  const [progress, setProgress] = useState(initialProgress);
  const [rotation, setRotation] = useState<[number, number]>(
    initialProgress >= 1 ? END_ROTATION : INITIAL_ROTATION,
  );
  const rafRef = useRef<number | null>(null);
  const completeCalledRef = useRef(false);

  const draggingRef = useRef(false);
  const lastPointerRef = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(WORLD_ATLAS_URL);
        const world = (await res.json()) as TopoJsonLike;
        const fc = feature(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          world as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          world.objects.countries as any,
        ) as unknown as { features: CountryFeature[] };
        if (!cancelled) setWorldData(fc.features);
      } catch {
        if (!cancelled) {
          setWorldData([
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [-180, -90],
                    [180, -90],
                    [180, 90],
                    [-180, 90],
                    [-180, -90],
                  ],
                ],
              },
              properties: {},
            },
          ]);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!unroll) return;
    completeCalledRef.current = false;
    const start = performance.now();
    const fromProgress = progress;
    const fromRotation: [number, number] = [rotation[0], rotation[1]];
    const toProgress = 1;

    const tick = (now: number) => {
      const t = Math.min((now - start) / UNROLL_DURATION_MS, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setProgress(fromProgress + (toProgress - fromProgress) * eased);
      // Only drive rotation if the user isn't actively dragging — don't fight
      // their input mid-animation.
      if (!draggingRef.current) {
        setRotation([
          fromRotation[0] + (END_ROTATION[0] - fromRotation[0]) * eased,
          fromRotation[1] + (END_ROTATION[1] - fromRotation[1]) * eased,
        ]);
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!completeCalledRef.current) {
        completeCalledRef.current = true;
        onUnrollComplete?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unroll, onUnrollComplete]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    lastPointerRef.current = [e.clientX, e.clientY];
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPointerRef.current[0];
    const dy = e.clientY - lastPointerRef.current[1];
    lastPointerRef.current = [e.clientX, e.clientY];

    setRotation((prev) => {
      // Sensitivity scales down a bit on the flat map.
      const sens = progress < 0.5 ? 0.5 : 0.3;
      const nextLon = prev[0] + dx * sens;
      const nextLat = Math.max(-85, Math.min(85, prev[1] - dy * sens));
      return [nextLon, nextLat];
    });
  }, [progress]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore — pointer may have been released implicitly
    }
  }, []);

  useEffect(() => {
    if (!svgRef.current || worldData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const alpha = Math.pow(progress, 0.5);
    const scale = d3.scaleLinear().domain([0, 1]).range([200, 120]);

    const projection = interpolateProjection(
      d3.geoOrthographicRaw as unknown as RawProjection,
      d3.geoEquirectangularRaw as unknown as RawProjection,
    )
      .scale(scale(alpha))
      .translate([WIDTH / 2, HEIGHT / 2])
      .rotate([rotation[0], rotation[1]])
      .precision(0.1);

    projection.alpha(alpha);

    const path = d3.geoPath(projection);

    // Graticule
    const graticule = d3.geoGraticule();
    const gStr = path(graticule());
    if (gStr) {
      svg
        .append("path")
        .attr("d", gStr)
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-width", 1)
        .attr("opacity", 0.2 * strokeOpacity);
    }

    // Countries
    svg
      .selectAll<SVGPathElement, CountryFeature>(".country")
      .data(worldData)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", (d) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = path(d as any) as string | null;
          if (!s) return "";
          if (s.includes("NaN") || s.includes("Infinity")) return "";
          return s;
        } catch {
          return "";
        }
      })
      .attr("fill", "none")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1)
      .attr("opacity", strokeOpacity)
      .style("visibility", function () {
        const d = d3.select(this).attr("d");
        return d && d.length > 0 && !d.includes("NaN") ? "visible" : "hidden";
      });

    // Sphere outline (on top of countries so the horizon reads clearly)
    const sphereStr = path({ type: "Sphere" });
    if (sphereStr) {
      svg
        .append("path")
        .attr("d", sphereStr)
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-width", 1)
        .attr("opacity", 0.5 * strokeOpacity);
    }

    // Dhaka pin — visible from first paint. In orthographic mode,
    // `path({type:"Point",...})` returns null when the location is on the far
    // side of the sphere, so the pin self-hides if the user rotates it away.
    {
      const pinOpacity = 1;
      const pt = projection(DHAKA);
      const pointPath = path({ type: "Point", coordinates: DHAKA });
      if (pt && pointPath) {
        const [x, y] = pt;
        const primary = "#45edcf";

        const pin = svg.append("g").attr("class", "dhaka-pin");

        // Expanding pulse rings (two, staggered).
        const rings = pin
          .append("g")
          .attr("transform", `translate(${x}, ${y})`)
          .attr("opacity", pinOpacity);
        rings
          .append("circle")
          .attr("r", 4)
          .attr("fill", "none")
          .attr("stroke", primary)
          .attr("stroke-width", 2)
          .style("transform-origin", "0 0")
          .style("animation", "vibeathon-pin-pulse 2s ease-out infinite");
        rings
          .append("circle")
          .attr("r", 4)
          .attr("fill", "none")
          .attr("stroke", primary)
          .attr("stroke-width", 2)
          .style("transform-origin", "0 0")
          .style(
            "animation",
            "vibeathon-pin-pulse 2s ease-out 1s infinite",
          );

        // Solid dot + glow.
        pin
          .append("circle")
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", 5)
          .attr("fill", primary)
          .attr("opacity", pinOpacity)
          .style(
            "filter",
            `drop-shadow(0 0 6px rgba(69, 237, 207, ${0.9 * pinOpacity}))`,
          );

        // Label
        pin
          .append("text")
          .attr("x", x + 10)
          .attr("y", y - 8)
          .attr("fill", primary)
          .attr("opacity", pinOpacity)
          .attr("font-size", 11)
          .attr("font-weight", 700)
          .attr("letter-spacing", 1.2)
          .style("font-family", "var(--font-headline)")
          .style("text-transform", "uppercase")
          .style(
            "filter",
            `drop-shadow(0 0 4px rgba(69, 237, 207, ${0.6 * pinOpacity}))`,
          )
          .text("Dhaka");
      }
    }
  }, [worldData, progress, rotation, strokeOpacity]);

  return (
    <div
      className={className}
      aria-hidden
      style={{ color: "var(--color-on-surface-variant)" }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
