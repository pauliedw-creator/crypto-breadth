import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

// ─────────────────────────────────────────────
//  PALETTE — soft pastels, light background
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
  lavPale:   "#f0eef8",
  teal:      "#4a9e9e",
  tealPale:  "#e6f4f4",
};

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
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
  BULL:    { label:"Bull Market",  color: P.green,    bg: P.greenPale },
  BEAR:    { label:"Bear Market",  color: P.red,      bg: P.redPale   },
  WARMING: { label:"Warming Up",   color: P.amber,    bg: P.amberPale },
  COOLING: { label:"Cooling Off",  color: P.blue,     bg: P.bluePale  },
  NEUTRAL: { label:"Neutral",      color: P.textSec,  bg: P.surface2  },
};

const PCT_KEY = {
  "1h":  "price_change_percentage_1h_in_currency",
  "24h": "price_change_percentage_24h_in_currency",
  "7d":  "price_change_percentage_7d_in_currency",
  "30d": "price_change_percentage_30d_in_currency",
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const calcBreadth = (coins, tf) => {
  const k = PCT_KEY[tf];
  const valid = coins.filter(c => c[k] != null);
  if (!valid.length) return null;
  return Math.round(valid.filter(c => c[k] > 0).length / valid.length * 100);
};

const calcVWBreadth = (coins, tf) => {
  const k = PCT_KEY[tf];
  const valid = coins.filter(c => c[k] != null && c.total_volume > 0);
  if (!valid.length) return null;
  const tot = valid.reduce((s, c) => s + c.total_volume, 0);
  const adv = valid.filter(c => c[k] > 0).reduce((s, c) => s + c.total_volume, 0);
  return Math.round(adv / tot * 100);
};

const getRegime = (b24, b7) => {
  if (b24 == null) return null;
  if (b24 >= 65 && (b7 == null || b7 >= 58)) return "BULL";
  if (b24 <= 32 || (b7 != null && b7 <= 32)) return "BEAR";
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

// Seeded history with realistic sine-wave oscillation for the 1h line
const seedHistory = b24 => {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => {
    const phase = (i / 30) * Math.PI * 2.8;
    const wave  = Math.sin(phase) * 16 + Math.sin(phase * 2.1) * 8;
    const noise = (Math.random() - 0.5) * 8;
    const b24v  = Math.max(12, Math.min(88, b24 + wave * 0.5 + noise * 0.5));
    const b1v   = Math.max(8,  Math.min(92, b24 + wave + noise));
    const b7v   = Math.max(12, Math.min(88, b24 + (Math.random() - 0.5) * 10 - 3));
    const prev  = i > 0 ? Math.max(8, Math.min(92, b24 + Math.sin(((i-1)/30)*Math.PI*2.8)*16 + (Math.random()-0.5)*8)) : b1v;
    return {
      time:    new Date(now - (29 - i) * 60_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      b1h:     Math.round(b1v),
      b24h:    Math.round(b24v),
      b7d:     Math.round(b7v),
      delta1h: Math.round(b1v - prev),
      demo:    true,
    };
  });
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
        <div style={{
          display: "inline-block", marginTop: 8, fontSize: 10, color: col,
          background: bg, padding: "2px 8px", borderRadius: 20,
          fontFamily: "DM Mono, monospace",
        }}>{sub}</div>
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
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${c}80, ${c})`,
          borderRadius: 2, transition: "width 1s ease",
        }}/>
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
      <div style={{ color: P.textMuted, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || P.textSec, marginBottom: 3 }}>
          {p.name}: {p.value != null ? (typeof p.value === "number" && Math.abs(p.value) < 200 ? `${p.value}%` : p.value) : "—"}
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
    <td style={{
      padding: "7px 10px", fontSize: 11, textAlign: align,
      borderBottom: `1px solid ${P.border2}`, verticalAlign: "middle", ...style,
    }}>{val}</td>
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
  const [seeded, setSeeded]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [sortKey, setSortKey]       = useState("market_cap");
  const [sortDir, setSortDir]       = useState("desc");

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
      const b1  = calcBreadth(filtered, "1h");

      if (!seeded && b24 != null) {
        setHistory(seedHistory(b24));
        setSeeded(true);
      }

      setHistory(prev => {
        const last    = prev.at(-1);
        const delta1h = last?.b1h != null && b1 != null ? b1 - last.b1h : null;
        return [
          ...prev.slice(-59),
          {
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            b1h: b1, b24h: b24, b7d: b7, delta1h, demo: false,
          },
        ];
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seeded]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

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

    // 1h momentum: average delta over last 5 live ticks
    const live = history.filter(h => !h.demo && h.b1h != null).slice(-5);
    let momentum = null;
    if (live.length >= 2) {
      const diffs = live.slice(1).map((h, i) => h.b1h - live[i].b1h);
      momentum = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length * 10) / 10;
    }

    return {
      b1, b24, b7, b30, vw24,
      regime: r, regimeMeta: r ? REGIME_META[r] : REGIME_META.NEUTRAL,
      adv, dec, sectors, momentum,
      gainers: sorted.slice(0, 8),
      losers:  sorted.slice(-8).reverse(),
    };
  }, [coins, history]);

  const deltaHistory = useMemo(() =>
    history.map(h => ({
      time:  h.time,
      delta: h.delta1h ?? null,
    })),
  [history]);

  const thrustAlert = useMemo(() => {
    const live = history.filter(h => !h.demo);
    if (live.length < 2) return false;
    const recent = live.slice(-10);
    return recent.some(h => h.b1h != null && h.b1h < 40) && (recent.at(-1)?.b1h ?? 0) > 60;
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

  if (loading) return (
    <div style={{
      background: P.bg, minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "DM Sans, sans-serif",
    }}>
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
            {coins.length} coins · stables & wrapped excluded · 60s refresh
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {thrustAlert && (
            <div style={{
              padding: "4px 12px", background: P.amberPale, border: `1px solid ${P.amber}50`,
              borderRadius: 20, fontSize: 10, color: P.amber, fontFamily: "DM Mono, monospace",
              animation: "pulse 2s ease-in-out infinite",
            }}>⚡ Breadth thrust</div>
          )}
          {m?.regime && (
            <div style={{
              padding: "4px 14px", background: m.regimeMeta.bg,
              border: `1px solid ${m.regimeMeta.color}40`,
              borderRadius: 20, fontSize: 10, color: m.regimeMeta.color,
              fontFamily: "DM Mono, monospace",
            }}>{m.regimeMeta.label}</div>
          )}
          {error && (
            <div style={{
              padding: "4px 12px", background: P.redPale, border: `1px solid ${P.red}30`,
              borderRadius: 20, fontSize: 10, color: P.red, fontFamily: "DM Mono, monospace",
            }}>{error}</div>
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
          <MetricCard label="1h Breadth"  value={m.b1  != null ? `${m.b1}%`  : "—"} pct={m.b1}
            sub={m.momentum != null ? `momentum ${m.momentum > 0 ? "+" : ""}${m.momentum}` : null}/>
          <MetricCard label="24h Breadth" value={m.b24 != null ? `${m.b24}%` : "—"} pct={m.b24} sub={`VW ${m.vw24 ?? "—"}%`}/>
          <MetricCard label="7d Breadth"  value={m.b7  != null ? `${m.b7}%`  : "—"} pct={m.b7}/>
          <MetricCard label="30d Breadth" value={m.b30 != null ? `${m.b30}%` : "—"} pct={m.b30}/>
          <MetricCard label="Advancing"   value={m.adv} pct={70} sub={`of ${m.adv + m.dec}`}/>
          <MetricCard label="Declining"   value={m.dec} pct={30}/>
        </div>
      )}

      {/* CHARTS + SECTORS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>

        <div style={{
          background: P.surface, border: `1px solid ${P.border}`,
          borderRadius: 10, padding: "18px 18px 12px", flex: 3, minWidth: 280,
        }}>
          {/* Chart header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontSize: 11, color: P.textSec, fontFamily: "DM Mono, monospace", letterSpacing: 1 }}>
              Breadth over time
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {[["1h", P.red], ["24h", P.green], ["7d", P.blue]].map(([lbl, col]) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: P.textMuted }}>
                  <div style={{ width: 14, height: 2, background: col, borderRadius: 1 }}/>
                  {lbl}
                </div>
              ))}
            </div>
          </div>

          {/* Zone labels */}
          <div style={{ display: "flex", gap: 14, marginBottom: 6 }}>
            {[["Bull zone >60%", P.green], ["Neutral 40–60%", P.textMuted], ["Bear zone <40%", P.red]].map(([lbl, col]) => (
              <div key={lbl} style={{ fontSize: 9, color: col, fontFamily: "DM Mono, monospace" }}>— {lbl}</div>
            ))}
          </div>

          {/* Main area chart — 1h is hero (thicker, more oscillatory) */}
          <ResponsiveContainer width="100%" height={195}>
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="g1h" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={P.red}   stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={P.red}   stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="g24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={P.green} stopOpacity={0.18}/>
                  <stop offset="95%" stopColor={P.green} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="g7" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={P.blue}  stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={P.blue}  stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={P.border2} vertical={false}/>
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: P.textMuted }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
              <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: P.textMuted }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <ReferenceLine y={60} stroke={`${P.green}60`}    strokeDasharray="4 4"/>
              <ReferenceLine y={50} stroke={`${P.textMuted}50`} strokeDasharray="2 4"/>
              <ReferenceLine y={40} stroke={`${P.red}60`}      strokeDasharray="4 4"/>
              <Area dataKey="b7d"  name="7d"  stroke={P.blue}  fill="url(#g7)"  strokeWidth={1}   dot={false} strokeDasharray="5 3" connectNulls/>
              <Area dataKey="b24h" name="24h" stroke={P.green} fill="url(#g24)" strokeWidth={1.5} dot={false} connectNulls/>
              {/* 1h as hero line — drawn last so it sits on top */}
              <Area dataKey="b1h"  name="1h"  stroke={P.red}   fill="url(#g1h)" strokeWidth={2.5} dot={false} connectNulls/>
            </AreaChart>
          </ResponsiveContainer>

          {/* Oscillation / delta panel */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${P.border2}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: P.textMuted, fontFamily: "DM Mono, monospace", letterSpacing: 1 }}>
                1h breadth change per tick — intraday oscillation
              </div>
              {m?.momentum != null && (
                <div style={{
                  fontSize: 10, fontFamily: "DM Mono, monospace",
                  color: m.momentum > 0 ? P.green : m.momentum < 0 ? P.red : P.textMuted,
                  background: m.momentum > 0 ? P.greenPale : m.momentum < 0 ? P.redPale : P.surface2,
                  padding: "1px 8px", borderRadius: 10,
                }}>
                  avg {m.momentum > 0 ? "+" : ""}{m.momentum} / tick
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={deltaHistory} margin={{ top: 0, right: 4, left: -24, bottom: 0 }} barCategoryGap="18%">
                <XAxis dataKey="time" hide/>
                <YAxis hide domain={["auto", "auto"]}/>
                <ReferenceLine y={0} stroke={P.border} strokeWidth={1}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="delta" name="Δ 1h" radius={[2, 2, 0, 0]}>
                  {deltaHistory.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.delta == null ? P.border : entry.delta > 0 ? P.green : P.red}
                      fillOpacity={0.65}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector breadth */}
        <div style={{
          background: P.surface, border: `1px solid ${P.border}`,
          borderRadius: 10, padding: "18px", flex: 1, minWidth: 200,
        }}>
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
            <div key={title} style={{
              background: P.surface, border: `1px solid ${P.border}`,
              borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 260,
            }}>
              <div style={{ fontSize: 11, color: P.textSec, fontFamily: "DM Mono, monospace", letterSpacing: 1, marginBottom: 14 }}>
                {title}
              </div>
              {list.map(c => {
                const pct = c[PCT_KEY["24h"]];
                return (
                  <div key={c.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "6px 0", borderBottom: `1px solid ${P.border2}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {c.image && <img src={c.image} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }}/>}
                      <div>
                        <span style={{ fontSize: 12, color: P.textPri, fontFamily: "DM Mono, monospace", fontWeight: 500 }}>
                          {c.symbol.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: P.textMuted, marginLeft: 6 }}>{c.name}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: col, background: bg, padding: "2px 8px", borderRadius: 10, fontFamily: "DM Mono, monospace" }}>
                        {fmtPct(pct)}
                      </div>
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
      <div style={{
        background: P.surface, border: `1px solid ${P.border}`,
        borderRadius: 10, padding: "16px 18px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, color: P.textSec, fontFamily: "DM Mono, monospace", letterSpacing: 1 }}>
            All coins — top 100
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              background: P.surface2, border: `1px solid ${P.border}`,
              color: P.textPri, padding: "6px 14px", fontSize: 11,
              fontFamily: "DM Mono, monospace", borderRadius: 20, outline: "none", width: 180,
            }}
          />
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
              {tableCoins.map((c, i) => (
                <CoinRow key={c.id} c={c} rank={c.market_cap_rank} even={i % 2 !== 0}/>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: 16, textAlign: "center", fontSize: 9, color: P.textMuted, letterSpacing: 1, fontFamily: "DM Mono, monospace" }}>
        Data: CoinGecko free API · Not financial advice
      </div>
    </div>
  );
}
