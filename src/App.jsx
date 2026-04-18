import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─────────────────────────────────────────────
//  PALETTE
// ─────────────────────────────────────────────
const P = {
  bg:        "#f4f6f2",
  surface:   "#ffffff",
  surface2:  "#f9faf8",
  border:    "#e2e8de",
  border2:   "#edf0ea",
  textPri:   "#2d3a2e",
  textSec:   "#6b7c6d",
  textMuted: "#a8b8aa",
  green:     "#5a9e78",
  greenPale: "#eaf4ee",
  red:       "#c26b6b",
  redPale:   "#faecec",
  amber:     "#c49a45",
  amberPale: "#fdf4e3",
  blue:      "#5b8fb9",
  bluePale:  "#e8f1f8",
  lavender:  "#8b7fba",
  teal:      "#4a9e9e",
};

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const STORAGE_KEY   = "cbt_hourly_v2";
const MIN_HOUR_GAP  = 50 * 60 * 1000; // 50 min in ms — one point per hour
const MAX_POINTS    = 2160;            // 90 days × 24h

const EXCLUDE = new Set([
  "USDT","USDC","BUSD","DAI","TUSD","USDP","GUSD","FRAX","LUSD","SUSD",
  "HUSD","EURS","EUROC","USDD","UST","USTC","DOLA","FEI","USDE","PYUSD",
  "FDUSD","CRVUSD","MKUSD","EUSD","XAUT","PAXG","GYEN","BIDR","BVND",
  "WBTC","WETH","STETH","CBETH","WBNB","WMATIC","WAVAX","RETH","SFRXETH",
  "HBTC","RENBTC","TBTC","BETH","WSTETH","WEETH","WTRX","WTON",
]);

const SECTOR_MAP = {
  BTC:"L1",ETH:"L1",BNB:"L1",SOL:"L1",ADA:"L1",AVAX:"L1",DOT:"L1",
  ATOM:"L1",NEAR:"L1",ALGO:"L1",ICP:"L1",SUI:"L1",APT:"L1",TON:"L1",
  SEI:"L1",FTM:"L1",EGLD:"L1",HBAR:"L1",XLM:"L1",TRX:"L1",VET:"L1",
  XRP:"L1",LTC:"L1",BCH:"L1",ETC:"L1",KAS:"L1",
  MATIC:"L2",ARB:"L2",OP:"L2",IMX:"L2",STRK:"L2",ZK:"L2",METIS:"L2",
  MANTA:"L2",BLAST:"L2",SCROLL:"L2",
  UNI:"DeFi",AAVE:"DeFi",MKR:"DeFi",CRV:"DeFi",SNX:"DeFi",COMP:"DeFi",
  LDO:"DeFi",BAL:"DeFi",PENDLE:"DeFi",GMX:"DeFi",DYDX:"DeFi",CAKE:"DeFi",
  JUP:"DeFi",RAY:"DeFi",SUSHI:"DeFi",OSMO:"DeFi",KAVA:"DeFi",
  FET:"AI",AGIX:"AI",OCEAN:"AI",RNDR:"AI",RENDER:"AI",WLD:"AI",AKT:"AI",
  GRT:"AI",NMR:"AI",TAO:"AI",
  DOGE:"Meme",SHIB:"Meme",PEPE:"Meme",BONK:"Meme",WIF:"Meme",FLOKI:"Meme",
  BRETT:"Meme",TURBO:"Meme",MOG:"Meme",POPCAT:"Meme",
  AXS:"Gaming",SAND:"Gaming",MANA:"Gaming",GALA:"Gaming",RON:"Gaming",
};

const SECTOR_META = {
  L1:     { color: P.green    },
  L2:     { color: P.blue     },
  DeFi:   { color: P.lavender },
  AI:     { color: P.amber    },
  Meme:   { color: P.red      },
  Gaming: { color: P.teal     },
  Other:  { color: P.textMuted},
};

const REGIME_META = {
  BULL:    { label:"Bull Market",  color: P.green,   bg: P.greenPale },
  BEAR:    { label:"Bear Market",  color: P.red,     bg: P.redPale   },
  WARMING: { label:"Warming Up",   color: P.amber,   bg: P.amberPale },
  COOLING: { label:"Cooling Off",  color: P.blue,    bg: P.bluePale  },
  NEUTRAL: { label:"Neutral",      color: P.textSec, bg: P.surface2  },
};

const PCT_KEY = {
  "1h":  "price_change_percentage_1h_in_currency",
  "24h": "price_change_percentage_24h_in_currency",
  "7d":  "price_change_percentage_7d_in_currency",
  "30d": "price_change_percentage_30d_in_currency",
};

const RANGE_OPTIONS = [
  { label: "7d",   hours: 168  },
  { label: "30d",  hours: 720  },
  { label: "90d",  hours: 2160 },
];

// ─────────────────────────────────────────────
//  SEED — 90 days of realistic hourly breadth
//  Uses layered sine waves to simulate bull/bear cycles
// ─────────────────────────────────────────────
const buildSeed = (anchorB24) => {
  const now    = Date.now();
  const points = [];
  const total  = MAX_POINTS;

  // Macro cycle: one full swing over 90 days
  // Mid cycle: ~2 week rhythm
  // Short cycle: ~3 day rhythm
  // Noise

  for (let i = 0; i < total; i++) {
    const frac   = i / total;
    const macro  = Math.sin(frac * Math.PI * 1.6 - 0.4) * 22;
    const mid    = Math.sin(frac * Math.PI * 13)  * 10;
    const short  = Math.sin(frac * Math.PI * 40)  * 7;
    const noise  = (Math.random() - 0.5) * 6;
    const b24    = Math.max(8, Math.min(92, anchorB24 + macro + mid + short + noise));
    const b7     = Math.max(8, Math.min(92, anchorB24 + macro * 0.7 + mid * 0.5 + (Math.random() - 0.5) * 5));
    const ts     = now - (total - i) * 60 * 60 * 1000;
    const d      = new Date(ts);

    points.push({
      ts,
      label: d.toLocaleDateString([], { month: "short", day: "numeric" }) +
             " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      dateLabel: d.toLocaleDateString([], { month: "short", day: "numeric" }),
      b24h:  Math.round(b24),
      b7d:   Math.round(b7),
      seeded: true,
    });
  }
  return points;
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const calcBreadth = (coins, tf) => {
  const k     = PCT_KEY[tf];
  const valid = coins.filter(c => c[k] != null);
  if (!valid.length) return null;
  return Math.round(valid.filter(c => c[k] > 0).length / valid.length * 100);
};

const calcVWBreadth = (coins, tf) => {
  const k     = PCT_KEY[tf];
  const valid = coins.filter(c => c[k] != null && c.total_volume > 0);
  if (!valid.length) return null;
  const tot = valid.reduce((s, c) => s + c.total_volume, 0);
  const adv = valid.filter(c => c[k] > 0).reduce((s, c) => s + c.total_volume, 0);
  return Math.round(adv / tot * 100);
};

const getRegime = (b24, b7) => {
  if (b24 == null) return null;
  if (b24 >= 65 && (b7 == null || b7 >= 58)) return "BULL";
  if (b24 <= 32 || (b7 != null && b7 <= 32))  return "BEAR";
  if (b24 >= 55) return "WARMING";
  if (b24 <= 44) return "COOLING";
  return "NEUTRAL";
};

const breadthColor = pct =>
  pct == null ? P.textMuted : pct >= 60 ? P.green : pct <= 40 ? P.red : P.amber;

const breadthBg = pct =>
  pct == null ? P.surface2 : pct >= 60 ? P.greenPale : pct <= 40 ? P.redPale : P.amberPale;

const fmtPct = n =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

const fmtLarge = n => {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
};

const fmtPrice = n => {
  if (n == null) return "—";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
};

// ─────────────────────────────────────────────
//  STORAGE
// ─────────────────────────────────────────────
const loadHistory = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const saveHistory = (pts) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pts.slice(-MAX_POINTS)));
  } catch {}
};

// ─────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────
const MetricCard = ({ label, value, sub, pct }) => {
  const col = breadthColor(pct);
  const bg  = breadthBg(pct);
  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderTop: `3px solid ${col}`,
      padding: "14px 18px", flex: 1, minWidth: 110, borderRadius: 8,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: P.textMuted, textTransform: "uppercase", marginBottom: 10, fontFamily: "DM Mono, monospace" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: col, fontFamily: "DM Mono, monospace", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      {sub && (
        <div style={{ display: "inline-block", marginTop: 8, fontSize: 10, color: col, background: bg, padding: "2px 8px", borderRadius: 20, fontFamily: "DM Mono, monospace" }}>
          {sub}
        </div>
      )}
    </div>
  );
};

const SectorRow = ({ name, pct, adv, total }) => {
  const meta = SECTOR_META[name] || SECTOR_META.Other;
  const c    = breadthColor(pct);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }}/>
          <span style={{ fontSize: 11, color: P.textSec, fontFamily: "DM Mono, monospace" }}>{name}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: P.textMuted }}>{adv}/{total}</span>
          <span style={{ fontSize: 12, color: c, fontFamily: "DM Mono, monospace", fontWeight: 600, background: breadthBg(pct), padding: "1px 8px", borderRadius: 10 }}>
            {pct}%
          </span>
        </div>
      </div>
      <div style={{ height: 4, background: P.border, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${c}80, ${c})`, borderRadius: 2, transition: "width 1s ease" }}/>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: P.surface, border: `1px solid ${P.border}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 11,
      fontFamily: "DM Mono, monospace", boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    }}>
      <div style={{ color: P.textMuted, marginBottom: 6, fontSize: 10 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || P.textSec, marginBottom: 3 }}>
          {p.name}: {p.value != null ? `${p.value}%` : "—"}
        </div>
      ))}
    </div>
  );
};

const CoinRow = ({ c, rank, even }) => {
  const p1  = c[PCT_KEY["1h"]];
  const p24 = c[PCT_KEY["24h"]] ?? c.price_change_percentage_24h;
  const p7  = c[PCT_KEY["7d"]];
  const p30 = c[PCT_KEY["30d"]];
  const pill = v => ({
    padding: "2px 8px", borderRadius: 10, fontSize: 10,
    fontFamily: "DM Mono, monospace",
    color:      breadthColor(v > 0 ? 70 : v < 0 ? 30 : 50),
    background: breadthBg(v > 0 ? 70 : v < 0 ? 30 : 50),
    whiteSpace: "nowrap", display: "inline-block",
  });
  const TD = ({ val, align = "right", style = {} }) => (
    <td style={{ padding: "7px 10px", fontSize: 11, textAlign: align, borderBottom: `1px solid ${P.border2}`, verticalAlign: "middle", ...style }}>
      {val}
    </td>
  );
  return (
    <tr style={{ background: even ? P.surface2 : P.surface }}>
      <TD val={<span style={{ color: P.textMuted, fontSize: 10, fontFamily: "DM Mono, monospace" }}>{rank}</span>}/>
      <TD align="left" val={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {c.image && <img src={c.image} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }}/>}
          <span style={{ color: P.textPri, fontWeight: 500, fontSize: 12, fontFamily: "DM Mono, monospace" }}>{c.symbol.toUpperCase()}</span>
          <span style={{ color: P.textMuted, fontSize: 10 }}>{c.name}</span>
        </div>
      }/>
      <TD val={<span style={{ color: P.textSec, fontFamily: "DM Mono, monospace" }}>{fmtPrice(c.current_price)}</span>}/>
      <TD val={<span style={{ color: P.textMuted, fontFamily: "DM Mono, monospace", fontSize: 10 }}>{fmtLarge(c.market_cap)}</span>}/>
      <TD val={<span style={{ color: P.textMuted, fontFamily: "DM Mono, monospace", fontSize: 10 }}>{fmtLarge(c.total_volume)}</span>}/>
      <TD val={<span style={pill(p1)}>{fmtPct(p1)}</span>}/>
      <TD val={<span style={pill(p24)}>{fmtPct(p24)}</span>}/>
      <TD val={<span style={pill(p7)}>{fmtPct(p7)}</span>}/>
      <TD val={<span style={pill(p30)}>{fmtPct(p30)}</span>}/>
    </tr>
  );
};

// ─────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────
export default function CryptoBreadthTerminal() {
  const [coins, setCoins]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [history, setHistory]       = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [sortKey, setSortKey]       = useState("market_cap");
  const [sortDir, setSortDir]       = useState("desc");
  const [range, setRange]           = useState(720); // default 30d

  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets" +
        "?vs_currency=usd&order=market_cap_desc&per_page=250&page=1" +
        "&sparkline=false&price_change_percentage=1h,24h,7d,30d"
      );
      if (!res.ok) {
        if (res.status === 429) throw new Error("Rate limited — retrying shortly");
        throw new Error(`API error ${res.status}`);
      }
      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error("Unexpected API response");

      const filtered = raw.filter(c => !EXCLUDE.has(c.symbol?.toUpperCase()));
      setCoins(filtered);
      setLastUpdate(new Date());
      setError(null);

      const b24 = calcBreadth(filtered, "24h");
      const b7  = calcBreadth(filtered, "7d");

      setHistory(prev => {
        // Bootstrap from localStorage or seed if empty
        let base = prev.length > 0 ? prev : (loadHistory() || []);

        if (base.length === 0 && b24 != null) {
          base = buildSeed(b24);
        }

        // Only append a real point if at least 50 min have passed
        const lastReal = [...base].reverse().find(p => !p.seeded);
        const now      = Date.now();
        const shouldAppend = !lastReal || (now - lastReal.ts) >= MIN_HOUR_GAP;

        if (shouldAppend && b24 != null) {
          const d     = new Date(now);
          const point = {
            ts: now,
            label: d.toLocaleDateString([], { month: "short", day: "numeric" }) +
                   " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            dateLabel: d.toLocaleDateString([], { month: "short", day: "numeric" }),
            b24h:  b24,
            b7d:   b7,
            seeded: false,
          };
          const updated = [...base.slice(-MAX_POINTS + 1), point];
          saveHistory(updated);
          return updated;
        }

        if (base !== prev) {
          saveHistory(base);
          return base;
        }
        return prev;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Slice history to selected range
  const visibleHistory = useMemo(() => {
    if (!history.length) return [];
    const cutoff = Date.now() - range * 60 * 60 * 1000;
    const pts    = history.filter(p => p.ts >= cutoff);

    // Thin out points so chart isn't over-dense (max ~300 visible points)
    const maxPts = 300;
    if (pts.length <= maxPts) return pts;
    const step = Math.ceil(pts.length / maxPts);
    return pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  }, [history, range]);

  const m = useMemo(() => {
    if (!coins.length) return null;
    const b1   = calcBreadth(coins, "1h");
    const b24  = calcBreadth(coins, "24h");
    const b7   = calcBreadth(coins, "7d");
    const b30  = calcBreadth(coins, "30d");
    const vw24 = calcVWBreadth(coins, "24h");
    const r    = getRegime(b24, b7);
    const k24  = PCT_KEY["24h"];
    const adv  = coins.filter(c => (c[k24] ?? c.price_change_percentage_24h ?? 0) > 0).length;
    const dec  = coins.filter(c => (c[k24] ?? c.price_change_percentage_24h ?? 0) < 0).length;

    const secMap = {};
    coins.forEach(c => {
      const s = SECTOR_MAP[c.symbol?.toUpperCase()] || "Other";
      if (!secMap[s]) secMap[s] = { adv: 0, total: 0 };
      secMap[s].total++;
      if ((c[k24] ?? c.price_change_percentage_24h ?? 0) > 0) secMap[s].adv++;
    });
    const sectors = Object.entries(secMap)
      .map(([name, d]) => ({ name, pct: Math.round(d.adv / d.total * 100), adv: d.adv, total: d.total }))
      .sort((a, b) => b.total - a.total);

    const sorted = [...coins].filter(c => c[k24] != null).sort((a, b) => b[k24] - a[k24]);

    return {
      b1, b24, b7, b30, vw24,
      regime: r, regimeMeta: r ? REGIME_META[r] : REGIME_META.NEUTRAL,
      adv, dec, sectors,
      gainers: sorted.slice(0, 8),
      losers:  sorted.slice(-8).reverse(),
    };
  }, [coins]);

  const thrustAlert = useMemo(() => {
    const real = history.filter(p => !p.seeded).slice(-10);
    if (real.length < 3) return false;
    return real.some(p => p.b24h < 40) && (real.at(-1)?.b24h ?? 0) > 60;
  }, [history]);

  const tableCoins = useMemo(() => {
    let r = [...coins];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
    }
    r.sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return r.slice(0, 100);
  }, [coins, search, sortKey, sortDir]);

  const toggleSort = key => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const realPointCount = history.filter(p => !p.seeded).length;

  if (loading) return (
    <div style={{ background: P.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "DM Sans, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: P.green, marginBottom: 8 }}>Crypto Breadth Terminal</div>
        <div style={{ color: P.textMuted, fontSize: 12 }}>Loading market data…</div>
        <div style={{ width: 200, height: 3, background: P.border, margin: "18px auto 0", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", background: P.green, animation: "slide 1.5s ease-in-out infinite" }}/>
        </div>
      </div>
      <style>{`@keyframes slide{0%{width:0;margin-left:0}50%{width:100%;margin-left:0}100%{width:0;margin-left:100%}}`}</style>
    </div>
  );

  const TH = ({ label, sortK, align = "right" }) => (
    <th onClick={() => toggleSort(sortK)} style={{
      padding: "8px 10px", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
      color: sortKey === sortK ? P.green : P.textMuted,
      textAlign: align, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
      fontFamily: "DM Mono, monospace", fontWeight: 400,
      borderBottom: `2px solid ${P.border}`, background: P.surface2,
    }}>
      {label}{sortKey === sortK ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const chartColor = breadthColor(m?.b24);

  return (
    <div style={{ background: P.bg, minHeight: "100vh", color: P.textPri, padding: "16px 20px", fontFamily: "DM Sans, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${P.surface2}; }
        ::-webkit-scrollbar-thumb { background: ${P.border}; border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slide { 0%{width:0;margin-left:0} 50%{width:100%;margin-left:0} 100%{width:0;margin-left:100%} }
      `}</style>

      {/* HEADER */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${P.border}`,
        flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: P.textPri }}>Crypto Breadth Terminal</div>
          <div style={{ fontSize: 10, color: P.textMuted, marginTop: 3, fontFamily: "DM Mono, monospace", letterSpacing: 1 }}>
            {coins.length} coins · stables & wrapped excluded · {realPointCount} live hourly readings recorded
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {thrustAlert && (
            <div style={{ padding: "4px 12px", background: P.amberPale, border: `1px solid ${P.amber}50`, borderRadius: 20, fontSize: 10, color: P.amber, fontFamily: "DM Mono, monospace", animation: "pulse 2s ease-in-out infinite" }}>
              ⚡ Breadth thrust
            </div>
          )}
          {m?.regime && (
            <div style={{ padding: "4px 14px", background: m.regimeMeta.bg, border: `1px solid ${m.regimeMeta.color}40`, borderRadius: 20, fontSize: 10, color: m.regimeMeta.color, fontFamily: "DM Mono, monospace" }}>
              {m.regimeMeta.label}
            </div>
          )}
          {error && (
            <div style={{ padding: "4px 12px", background: P.redPale, border: `1px solid ${P.red}30`, borderRadius: 20, fontSize: 10, color: P.red, fontFamily: "DM Mono, monospace" }}>
              {error}
            </div>
          )}
          <button onClick={fetchData} disabled={refreshing} style={{
            background: refreshing ? P.surface2 : P.greenPale,
            border: `1px solid ${refreshing ? P.border : P.green}60`,
            color: refreshing ? P.textMuted : P.green,
            padding: "5px 14px", cursor: refreshing ? "not-allowed" : "pointer",
            fontSize: 10, fontFamily: "DM Mono, monospace", borderRadius: 20, transition: "all 0.2s",
          }}>
            {refreshing ? "Updating…" : "↻ Refresh"}
          </button>
          {lastUpdate && (
            <div style={{ fontSize: 10, color: P.textMuted, fontFamily: "DM Mono, monospace" }}>
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* METRIC CARDS */}
      {m && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <MetricCard label="1h Breadth"  value={m.b1  != null ? `${m.b1}%`  : "—"} pct={m.b1}/>
          <MetricCard label="24h Breadth" value={m.b24 != null ? `${m.b24}%` : "—"} pct={m.b24} sub={`VW ${m.vw24 ?? "—"}%`}/>
          <MetricCard label="7d Breadth"  value={m.b7  != null ? `${m.b7}%`  : "—"} pct={m.b7}/>
          <MetricCard label="30d Breadth" value={m.b30 != null ? `${m.b30}%` : "—"} pct={m.b30}/>
          <MetricCard label="Advancing"   value={m.adv} pct={70} sub={`of ${m.adv + m.dec}`}/>
          <MetricCard label="Declining"   value={m.dec} pct={30}/>
        </div>
      )}

      {/* CHARTS ROW */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>

        {/* Main breadth chart */}
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: "18px 18px 14px", flex: 3, minWidth: 280 }}>

          {/* Chart header with range selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: P.textSec, fontFamily: "DM Mono, monospace", letterSpacing: 1 }}>
                24h breadth — hourly
              </div>
              {realPointCount < 24 && (
                <div style={{ fontSize: 9, color: P.textMuted, fontFamily: "DM Mono, monospace", marginTop: 3 }}>
                  Seeded data shown · live history builds up over time (1 pt/hr)
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {/* Range buttons */}
              {RANGE_OPTIONS.map(opt => (
                <button key={opt.label} onClick={() => setRange(opt.hours)} style={{
                  background: range === opt.hours ? P.greenPale : "none",
                  border: `1px solid ${range === opt.hours ? P.green : P.border}`,
                  color: range === opt.hours ? P.green : P.textMuted,
                  padding: "3px 10px", cursor: "pointer", fontSize: 10,
                  fontFamily: "DM Mono, monospace", borderRadius: 20, transition: "all 0.15s",
                }}>
                  {opt.label}
                </button>
              ))}
              {/* Legend */}
              <div style={{ display: "flex", gap: 10, marginLeft: 8 }}>
                {[["24h", chartColor], ["7d", P.blue]].map(([lbl, col]) => (
                  <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: P.textMuted }}>
                    <div style={{ width: 14, height: 2, background: col, borderRadius: 1 }}/>
                    {lbl}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Zone labels */}
          <div style={{ display: "flex", gap: 14, marginBottom: 6 }}>
            {[["Bull >60%", P.green], ["Neutral 40–60%", P.textMuted], ["Bear <40%", P.red]].map(([lbl, col]) => (
              <div key={lbl} style={{ fontSize: 9, color: col, fontFamily: "DM Mono, monospace" }}>— {lbl}</div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={visibleHistory} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="g24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartColor} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="g7" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={P.blue}  stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={P.blue}  stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={P.border2} vertical={false}/>
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 8, fill: P.textMuted }}
                tickLine={false} axisLine={false}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: P.textMuted }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`}/>
              <Tooltip content={<CustomTooltip/>} labelKey="label"/>
              <ReferenceLine y={60} stroke={`${P.green}55`}     strokeDasharray="4 4"/>
              <ReferenceLine y={50} stroke={`${P.textMuted}40`} strokeDasharray="2 4"/>
              <ReferenceLine y={40} stroke={`${P.red}55`}       strokeDasharray="4 4"/>
              <Area dataKey="b7d"  name="7d"  stroke={P.blue}      fill="url(#g7)"  strokeWidth={1}   dot={false} strokeDasharray="5 3" connectNulls/>
              <Area dataKey="b24h" name="24h" stroke={chartColor}  fill="url(#g24)" strokeWidth={2}   dot={false} connectNulls/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sector breadth */}
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: "18px", flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: P.textSec, fontFamily: "DM Mono, monospace", letterSpacing: 1, marginBottom: 18 }}>
            Sector breadth (24h)
          </div>
          {m?.sectors.map(s => <SectorRow key={s.name} {...s}/>)}
        </div>
      </div>

      {/* GAINERS / LOSERS */}
      {m && (
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { title: "Top gainers (24h)", list: m.gainers, col: P.green, bg: P.greenPale },
            { title: "Top losers (24h)",  list: m.losers,  col: P.red,   bg: P.redPale   },
          ].map(({ title, list, col, bg }) => (
            <div key={title} style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 11, color: P.textSec, fontFamily: "DM Mono, monospace", letterSpacing: 1, marginBottom: 14 }}>{title}</div>
              {list.map(c => {
                const pct = c[PCT_KEY["24h"]];
                return (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${P.border2}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {c.image && <img src={c.image} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }}/>}
                      <div>
                        <span style={{ fontSize: 12, color: P.textPri, fontFamily: "DM Mono, monospace", fontWeight: 500 }}>{c.symbol.toUpperCase()}</span>
                        <span style={{ fontSize: 10, color: P.textMuted, marginLeft: 6 }}>{c.name}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: col, background: bg, padding: "2px 8px", borderRadius: 10, fontFamily: "DM Mono, monospace" }}>{fmtPct(pct)}</div>
                      <div style={{ fontSize: 9, color: P.textMuted, marginTop: 2 }}>{fmtPrice(c.current_price)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* COIN TABLE */}
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, color: P.textSec, fontFamily: "DM Mono, monospace", letterSpacing: 1 }}>All coins — top 100</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{
            background: P.surface2, border: `1px solid ${P.border}`,
            color: P.textPri, padding: "6px 14px", fontSize: 11,
            fontFamily: "DM Mono, monospace", borderRadius: 20, outline: "none", width: 180,
          }}/>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TH label="#"       sortK="market_cap_rank"                         align="right"/>
                <TH label="Coin"    sortK="name"                                    align="left"/>
                <TH label="Price"   sortK="current_price"/>
                <TH label="Mkt Cap" sortK="market_cap"/>
                <TH label="Vol 24h" sortK="total_volume"/>
                <TH label="1h %"    sortK="price_change_percentage_1h_in_currency"/>
                <TH label="24h %"   sortK="price_change_percentage_24h_in_currency"/>
                <TH label="7d %"    sortK="price_change_percentage_7d_in_currency"/>
                <TH label="30d %"   sortK="price_change_percentage_30d_in_currency"/>
              </tr>
            </thead>
            <tbody>
              {tableCoins.map((c, i) => <CoinRow key={c.id} c={c} rank={c.market_cap_rank} even={i % 2 !== 0}/>)}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 9, color: P.textMuted, letterSpacing: 1, fontFamily: "DM Mono, monospace" }}>
        Data: CoinGecko free API · History stored locally in your browser · Not financial advice
      </div>
    </div>
  );
}
