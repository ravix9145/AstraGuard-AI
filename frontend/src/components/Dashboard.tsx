"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Satellite,
  AlertTriangle,
  Clock,
  Activity,
  Layers,
  RefreshCw,
} from "lucide-react";
import MetricCard from "./MetricCard";
import SatelliteTable from "./SatelliteTable";
import StatusBar from "./StatusBar";

// Dynamic import keeps Three.js out of the SSR bundle
const OrbitGlobe = dynamic(() => import("./OrbitGlobe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center rounded-xl border border-slate-700/50 bg-[#020818] text-sm text-slate-600">
      Initialising 3D view…
    </div>
  ),
});

interface DashboardStats {
  active_objects_tracked: number;
  high_risk_conjunctions: number;
  next_orbital_pass_utc: string;
  total_debris_objects: number;
  leo_density_index: number;
  fetched_at: string;
}

interface TLESatellite {
  name: string;
  norad_id: number;
  approx_altitude_km: number;
  inclination_deg: number;
  mean_motion_rev_per_day: number;
}

const MOCK_SATELLITES: TLESatellite[] = [
  {
    norad_id: 25544,
    name: "ISS (ZARYA)",
    approx_altitude_km: 415,
    inclination_deg: 51.64,
    mean_motion_rev_per_day: 15.49,
  },
  {
    norad_id: 20580,
    name: "HST",
    approx_altitude_km: 537,
    inclination_deg: 28.47,
    mean_motion_rev_per_day: 15.09,
  },
  {
    norad_id: 43013,
    name: "STARLINK-1",
    approx_altitude_km: 550,
    inclination_deg: 53.0,
    mean_motion_rev_per_day: 15.06,
  },
  {
    norad_id: 27386,
    name: "XM-3",
    approx_altitude_km: 35786,
    inclination_deg: 0.02,
    mean_motion_rev_per_day: 1.0,
  },
  {
    norad_id: 39634,
    name: "COSMOS 2486",
    approx_altitude_km: 1000,
    inclination_deg: 82.95,
    mean_motion_rev_per_day: 14.12,
  },
  {
    norad_id: 22675,
    name: "IRIDIUM 34 DEB",
    approx_altitude_km: 776,
    inclination_deg: 86.4,
    mean_motion_rev_per_day: 14.35,
  },
  {
    norad_id: 36516,
    name: "TERRA",
    approx_altitude_km: 705,
    inclination_deg: 98.12,
    mean_motion_rev_per_day: 14.57,
  },
  {
    norad_id: 28654,
    name: "NOAA 18",
    approx_altitude_km: 854,
    inclination_deg: 99.03,
    mean_motion_rev_per_day: 14.09,
  },
  {
    norad_id: 33591,
    name: "FENGYUN 1C DEB",
    approx_altitude_km: 852,
    inclination_deg: 98.81,
    mean_motion_rev_per_day: 14.1,
  },
  {
    norad_id: 48274,
    name: "ONEWEB-0333",
    approx_altitude_km: 1200,
    inclination_deg: 87.4,
    mean_motion_rev_per_day: 13.47,
  },
];

function normalizeSatellites(data: unknown): TLESatellite[] {
  let rawList: unknown[] = [];

  if (Array.isArray(data)) {
    rawList = data;
  } else if (typeof data === "object" && data !== null) {
    const obj = data as { satellites?: unknown };

    if (Array.isArray(obj.satellites)) {
      rawList = obj.satellites;
    }
  }

  return rawList
    .map((item): TLESatellite | null => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const sat = item as Record<string, unknown>;

      const noradId = Number(sat.norad_id);
      const altitude = Number(sat.approx_altitude_km);
      const inclination = Number(sat.inclination_deg);
      const meanMotion = Number(sat.mean_motion_rev_per_day);

      if (
        !Number.isFinite(noradId) ||
        !Number.isFinite(altitude) ||
        !Number.isFinite(inclination) ||
        !Number.isFinite(meanMotion)
      ) {
        return null;
      }

      const name =
        typeof sat.name === "string" && sat.name.trim()
          ? sat.name
          : `Satellite ${noradId}`;

      return {
        name,
        norad_id: noradId,
        approx_altitude_km: altitude,
        inclination_deg: inclination,
        mean_motion_rev_per_day: meanMotion,
      };
    })
    .filter((sat): sat is TLESatellite => sat !== null);
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [satellites, setSatellites] = useState<TLESatellite[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tleLoading, setTleLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const fetchStats = async () => {
    setStatsLoading(true);

    try {
      const res = await fetch("/api/stats");

      if (!res.ok) {
        throw new Error(`Stats HTTP ${res.status}`);
      }

      const data: DashboardStats = await res.json();

      setStats(data);
      setBackendOnline(true);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      setBackendOnline(false);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchTLE = async () => {
    setTleLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/satellites/tle?limit=50`
      );

      if (!res.ok) {
        throw new Error(`TLE HTTP ${res.status}`);
      }

      const data: unknown = await res.json();

      const validSatellites = normalizeSatellites(data);

      console.log(
        "AstraGuard TLE response:",
        data
      );

      console.log(
        "AstraGuard valid satellites:",
        validSatellites.length
      );

      if (validSatellites.length > 0) {
        setSatellites(validSatellites);
        setBackendOnline(true);
      } else {
        console.warn(
          "Backend returned no valid satellite orbital data."
        );

        setSatellites(MOCK_SATELLITES);
      }
    } catch (error) {
      console.error("Failed to fetch TLE data:", error);

      setSatellites(MOCK_SATELLITES);
    } finally {
      setTleLoading(false);
    }
  };

  const handleRefresh = () => {
    setLastRefresh(new Date());

    fetchStats();
    fetchTLE();
  };

  useEffect(() => {
    setMounted(true);
    setLastRefresh(new Date());

    fetchStats();
    fetchTLE();

    const interval = setInterval(
      handleRefresh,
      5 * 60 * 1000
    );

    return () => clearInterval(interval);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatPassTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-[#020818] grid-overlay">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-[#020818]/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Satellite
                  size={26}
                  className="text-cyan-400"
                  strokeWidth={1.5}
                />

                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan-400 pulse-dot" />
              </div>

              <div>
                <span className="text-lg font-bold tracking-tight text-white">
                  AstraGuard
                </span>

                <span className="ml-1.5 text-lg font-light text-cyan-400">
                  AI
                </span>
              </div>

              <span className="hidden sm:inline-flex ml-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
                Live
              </span>
            </div>

            <div className="flex items-center gap-3">
              {mounted && lastRefresh && (
                <span className="hidden md:block text-xs text-slate-500">
                  Last updated:{" "}
                  <span className="text-slate-400">
                    {lastRefresh.toLocaleTimeString()}
                  </span>
                </span>
              )}

              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300 active:scale-95"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Backend status */}
        {backendOnline === false && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertTriangle size={16} className="flex-shrink-0" />

            <span>
              <strong>Backend offline.</strong>{" "}
              Start the FastAPI server on{" "}
              <code className="font-mono text-amber-200">
                localhost:8000
              </code>
              . Showing cached/estimated values.
            </span>
          </div>
        )}

        {/* Metrics */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Orbital Situational Awareness
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Active Objects Tracked"
              value={
                stats?.active_objects_tracked.toLocaleString() ?? "—"
              }
              subtext="Live count from CelesTrak active satellite catalog"
              icon={Satellite}
              accent="cyan"
              loading={statsLoading}
            />

            <MetricCard
              title="High-Risk Conjunctions"
              value={stats?.high_risk_conjunctions ?? "—"}
              subtext="Close approach events within 1 km threshold (next 7 days)"
              icon={AlertTriangle}
              accent="red"
              loading={statsLoading}
            />

            <MetricCard
              title="Next Orbital Pass"
              value={
                stats?.next_orbital_pass_utc
                  ? formatPassTime(stats.next_orbital_pass_utc)
                  : "—"
              }
              subtext="Estimated ISS overpass — computed via skyfield"
              icon={Clock}
              accent="amber"
              loading={statsLoading}
            />
          </div>
        </section>

        {/* Secondary metrics */}
        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetricCard
              title="Total Debris Objects"
              value={
                stats?.total_debris_objects.toLocaleString() ?? "—"
              }
              subtext="Tracked fragments from Cosmos-2251 collision catalog"
              icon={Layers}
              accent="purple"
              loading={statsLoading}
            />

            <MetricCard
              title="LEO Density Index"
              value={
                stats
                  ? stats.leo_density_index.toFixed(2)
                  : "—"
              }
              subtext="Normalized 0–1 crowding index for low Earth orbit shells"
              icon={Activity}
              accent="green"
              loading={statsLoading}
            />
          </div>
        </section>

        {/* 3D Globe */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            3D Orbital Visualisation
          </h2>

          <OrbitGlobe
            satellites={satellites}
            loading={tleLoading}
          />
        </section>

        {/* Satellite table */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Active Satellites — Live TLE Feed
            </h2>

            <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {tleLoading
                ? "Loading…"
                : `${satellites.length} objects`}
            </span>
          </div>

          <SatelliteTable
            satellites={satellites}
            loading={tleLoading}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800/60 py-6 text-center text-xs text-slate-600">
        AstraGuard AI · TLE data courtesy of{" "}
        <a
          href="https://celestrak.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 hover:text-cyan-400 transition-colors"
        >
          CelesTrak
        </a>{" "}
        · Built with IBM Bob
      </footer>
    </div>
  );
}