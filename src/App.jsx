import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

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
  XRP:"L1",LTC:"L1",BCH:"L1",ETC:"L1",CSPR:"L1",KAS:"L1",TAO:"AI",
  MATIC:"L2",ARB:"L2",OP:"L2",IMX:"L2",STRK:"L2",ZK:"L2",METIS:"L2",
  MANTA:"L2",BLAST:"L2",SCROLL:"L2",BOBA:"L2",
  UNI:"DeFi",AAVE:"DeFi",MKR:"DeFi",CRV:"DeFi",SNX:"DeFi",COMP:"DeFi",
  LDO:"DeFi",BAL:"DeFi",PENDLE:"DeFi",GMX:"DeFi",DYDX:"DeFi",CAKE:"DeFi",
  JUP:"DeFi",RAY:"DeFi",SUSHI:"DeFi",OSMO:"DeFi",KAVA:"DeFi",
  FET:"AI",AGIX:"AI",OCEAN:"AI",RNDR:"AI",RENDER:"AI",WLD:"AI",AKT:"AI",
  GRT:"AI",NMR:"AI",
  DOGE:"Meme",SHIB:"Meme",PEPE:"Meme",BONK:"Meme",WIF:"Meme",FLOKI:"Meme",
  BRETT:"Meme",TURBO:"Meme",MOG:"Meme",POPCAT:"Meme",DOGS:"Meme",
  AXS:"Gaming",SAND:"Gaming",MANA:"Gaming",GALA:"Gaming",RON:"Gaming",YGG:"Gaming",
};

const SECTOR_META = {
  L1:     { color:"#00ff88", label:"Layer 1" },
  L2:     { color:"#00b4d8", label:"Layer 2" },
  DeFi:   { color:"#b388ff", label:"DeFi" },
  AI:     { color:"#ffab40", label:"AI" },
  Meme:   { color:"#ff6e40", label:"Meme" },
  Gaming: { color:"#40ffcf", label:"Gaming" },
  Other:  { color:"#546e7a", label:"Other" },
};

const REGIME_META = {
  BULL:    { label:"BULL MARKET",  color:"#00ff88", bg:"rgba(0,255,136,0.1)" },
  BEAR:    { label:"BEAR MARKET",  color:"#ff1744", bg:"rgba(255,23,68,0.1)" },
  WARMING: { label:"WARMING UP",   color:"#ffab40", bg:"rgba(255,171,64,0.1)" },
  COOLING: { label:"COOLING OFF",  color:"#40b4d8", bg:"rgba(64,180,216,0.1)" },
  NEUTRAL: { label:"NEUTRAL",      color:"#78909c", bg:"rgba(120,144,156,0.1)" },
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

const PCT_KEY = {
  "1h":  "price_change_percentage_1h_in_currency",
  "24h": "price_change_percentage_24h_in_currency",
  "7d":  "price_change_percentage_7d_in_currency",
  "30d": "price_change_percentage_30d_in_currency",
};

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
  pct == null ? "#4a5568" : pct >= 60 ? "#00ff88" : pct <= 40 ? "#ff1744" : "#ffab40";

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

const seedHistory = b24 => {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => {
    const age = 23 - i;
    const noise = (Math.random() - 0.49) * 18;
    const val = Math.max(10, Math.min(90, b24 + noise));
    return {
      time: new Date(now - age * 5 * 60 * 1000)
        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      b24h: Math.round(val),
      b7d:  Math.round(Math.max(10, Math.min(90, val + (Math.random() - 0.5) * 10 - 4))),
      b1h:  Math.round(Math.max(10, Math.min(90, val + (Math.random() - 0.5) * 25))),
      demo: true,
    };
  });
};

// ─────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────

const MetricCard = ({ label, value, sub, color }) => (
  <div style={{
    background: "#0d1117",
    border: "1px solid #1c2333",
    borderTop: `2px solid ${color}50`,
    padding: "14px 18px",
    flex: 1,
    minWidth: 110,
    position: "relative",
    overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", inset: 0,
      background: `radial-gradient(circle at top left, ${color}0a, transparent 65%)`,
      pointerEvents: "none",
    }}/>
    <div style={{ fontSize: 9, letterSpacing: 2.5, color: "#4a5568", fontFamily: "Fira Code, monospace", textTransform: "uppercase", marginBottom: 8 }}>
      {label}
    </div>
    <div style={{
      fontSize: 30, fontWeight: 600, color, fontFamily: "Fira Code, monospace",
      lineHeight: 1, letterSpacing: -1,
      textShadow: `0 0 30px ${color}50`,
    }}>
      {value ?? "—"}
    </div>
    {sub && <div style={{ fontSize: 10, color: "#4a5568", marginTop: 5, fontFamily: "Fira Code, monospace" }}>{sub}</div>}
  </div>
);

const SectorRow = ({ name, pct, adv, total }) => {
  const meta = SECTOR_META[name] || SECTOR_META.Other;
  const c = breadthColor(pct);
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "baseline" }}>
        <span style={{ fontSize: 10, color: meta.color, letterSpacing: 1.5, textTransform: "uppercase" }}>{name}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontSize: 9, color: "#4a5568" }}>{adv}/{total}</span>
          <span style={{ fontSize: 13, color: c, fontFamily: "Fira Code, monospace", fontWeight: 600 }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 3, background: "#1c2333", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${c}60, ${c})`,
          borderRadius: 2, transition: "width 0.9s ease",
          boxShadow: `0 0 8px ${c}50`,
        }}/>
      </div>
    </div>
  );
};

const CoinRow = ({ c, rank, even }) => {
  const p1  = c[PCT_KEY["1h"]];
  const p24 = c[PCT_KEY["24h"]] ?? c.price_change_percentage_24h;
  const p7  = c[PCT_KEY["7d"]];
  const p30 = c[PCT_KEY["30d"]];
  const TD = ({ val, right = true, style = {} }) => (
    <td style={{
      padding: "6px 10px", fontSize: 11, fontFamily: "Fira Code, monospace",
      textAlign: right ? "right" : "left", whiteSpace: "nowrap",
      borderBottom: "1px solid #0a0d14", ...style,
    }}>{val}</td>
  );
  return (
    <tr style={{ background: even ? "#0a0d14" : "transparent" }}>
      <TD val={<span style={{ color: "#3a4454" }}>{rank}</span>} />
      <TD right={false} val={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {c.image && <img src={c.image} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }}/>}
          <span style={{ color: "#c9d1d9" }}>{c.symbol.toUpperCase()}</span>
          <span style={{ color: "#3a4454", fontSize: 10 }}>{c.name}</span>
        </div>
      }/>
      <TD val={fmtPrice(c.current_price)} style={{ color: "#8b949e" }}/>
      <TD val={fmtLarge(c.market_cap)} style={{ color: "#6b7280" }}/>
      <TD val={fmtLarge(c.total_volume)} style={{ color: "#6b7280" }}/>
      <TD val={fmtPct(p1)}  style={{ color: breadthColor(p1  > 0 ? 70 : p1  < 0 ? 30 : 50) }}/>
      <TD val={fmtPct(p24)} style={{ color: breadthColor(p24 > 0 ? 70 : p24 < 0 ? 30 : 50) }}/>
      <TD val={fmtPct(p7)}  style={{ color: breadthColor(p7  > 0 ? 70 : p7  < 0 ? 30 : 50) }}/>
      <TD val={fmtPct(p30)} style={{ color: breadthColor(p30 > 0 ? 70 : p30 < 0 ? 30 : 50) }}/>
    </tr>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0d1117", border: "1px solid #1c2333",
      padding: "10px 14px", fontSize: 11, fontFamily: "Fira Code, monospace",
    }}>
      <div style={{ color: "#4a5568", marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value != null ? `${p.value}%` : "—"}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────

export default function CryptoBreadthTerminal() {
  const [coins, setCoins]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [history, setHistory]     = useState([]);
  const [seeded, setSeeded]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [sortKey, setSortKey]     = useState("market_cap");
  const [sortDir, setSortDir]     = useState("desc");

  // Inject Google Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600&family=Rajdhani:wght@500;600;700&display=swap";
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
        if (res.status === 429) throw new Error("Rate limited — retrying in 2 min");
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

      setHistory(prev => [
        ...prev.slice(-47),
        {
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          b24h: b24, b7d: b7, b1h: b1,
          demo: false,
        },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seeded]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 120_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Core metrics
  const m = useMemo(() => {
    if (!coins.length) return null;
    const b1  = calcBreadth(coins, "1h");
    const b24 = calcBreadth(coins, "24h");
    const b7  = calcBreadth(coins, "7d");
    const b30 = calcBreadth(coins, "30d");
    const vw24 = calcVWBreadth(coins, "24h");
    const r = getRegime(b24, b7);
    const k24 = PCT_KEY["24h"];
    const adv = coins.filter(c => (c[k24] ?? c.price_change_percentage_24h ?? 0) > 0).length;
    const dec = coins.filter(c => (c[k24] ?? c.price_change_percentage_24h ?? 0) < 0).length;

    // Sector breakdown
    const secMap = {};
    coins.forEach(c => {
      const s = SECTOR_MAP[c.symbol?.toUpperCase()] || "Other";
      if (!secMap[s]) secMap[s] = { adv: 0, total: 0 };
      secMap[s].total++;
      if ((c[k24] ?? c.price_change_percentage_24h ?? 0) > 0) secMap[s].adv++;
    });
    const sectors = Object.entries(secMap)
      .map(([name, d]) => ({
        name,
        pct: Math.round(d.adv / d.total * 100),
        adv: d.adv,
        total: d.total,
      }))
      .sort((a, b) => b.total - a.total);

    const sorted = [...coins]
      .filter(c => c[k24] != null)
      .sort((a, b) => b[k24] - a[k24]);

    return {
      b1, b24, b7, b30, vw24,
      regime: r,
      regimeMeta: r ? REGIME_META[r] : REGIME_META.NEUTRAL,
      adv, dec,
      sectors,
      gainers: sorted.slice(0, 8),
      losers:  sorted.slice(-8).reverse(),
    };
  }, [coins]);

  // Breadth thrust detection (from history)
  const thrustAlert = useMemo(() => {
    if (history.length < 4) return false;
    const live = history.filter(h => !h.demo);
    if (live.length < 2) return false;
    const recent = live.slice(-8);
    const hadLow = recent.some(h => h.b24h != null && h.b24h < 42);
    const nowHigh = (recent.at(-1)?.b24h ?? 0) > 60;
    return hadLow && nowHigh;
  }, [history]);

  // Sorted coin table
  const tableCoins = useMemo(() => {
    let r = [...coins];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(c =>
        c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
      );
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

  const chartColor = breadthColor(m?.b24);

  // ─── Loading ───
  if (loading) return (
    <div style={{
      background: "#060910", minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "Fira Code, monospace",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 26,
          letterSpacing: 5, color: "#00ff88", marginBottom: 12,
        }}>
          CRYPTO BREADTH TERMINAL
        </div>
        <div style={{ color: "#4a5568", fontSize: 11, letterSpacing: 2 }}>
          LOADING MARKET DATA…
        </div>
        <div style={{
          width: 220, height: 2, background: "#1c2333",
          margin: "20px auto 0", borderRadius: 1, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", background: "#00ff88",
            animation: "slide 1.5s ease-in-out infinite",
          }}/>
        </div>
      </div>
      <style>{`
        @keyframes slide {
          0%   { width:0;    margin-left:0 }
          50%  { width:100%; margin-left:0 }
          100% { width:0;    margin-left:100% }
        }
      `}</style>
    </div>
  );

  // ─── Main render ───
  const TH = ({ label, sortK, align = "right" }) => (
    <th
      onClick={() => toggleSort(sortK)}
      style={{
        padding: "8px 10px", fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
        color: sortKey === sortK ? "#00ff88" : "#3a4454",
        textAlign: align, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
        fontFamily: "Fira Code, monospace", fontWeight: 400, borderBottom: "1px solid #1c2333",
      }}
    >
      {label}{sortKey === sortK ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div style={{ background: "#060910", minHeight: "100vh", color: "#c9d1d9", padding: "16px 20px" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:#0d1117; }
        ::-webkit-scrollbar-thumb { background:#1c2333; border-radius:3px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ─── Header ─── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid #1c2333",
        flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{
            fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 20,
            letterSpacing: 4, color: "#00ff88", textTransform: "uppercase",
          }}>
            ⬡ Crypto Breadth Terminal
          </div>
          <div style={{ fontSize: 9, color: "#3a4454", letterSpacing: 1.5, marginTop: 3, fontFamily: "Fira Code, monospace" }}>
            {coins.length} COINS TRACKED · STABLES & WRAPPED EXCLUDED · TOP 200 BY MARKET CAP
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {thrustAlert && (
            <div style={{
              padding: "3px 10px", background: "rgba(255,171,64,0.15)",
              border: "1px solid rgba(255,171,64,0.4)", borderRadius: 3,
              fontSize: 10, color: "#ffab40", letterSpacing: 1.5,
              fontFamily: "Fira Code, monospace",
              animation: "pulse 2s ease-in-out infinite",
            }}>
              ⚡ BREADTH THRUST DETECTED
            </div>
          )}
          {m?.regime && (
            <div style={{
              padding: "3px 12px",
              background: m.regimeMeta.bg,
              border: `1px solid ${m.regimeMeta.color}40`,
              borderRadius: 3, fontSize: 10, color: m.regimeMeta.color,
              letterSpacing: 2, fontFamily: "Fira Code, monospace",
            }}>
              {m.regimeMeta.label}
            </div>
          )}
          {error && (
            <div style={{
              padding: "3px 10px", background: "rgba(255,23,68,0.1)",
              border: "1px solid rgba(255,23,68,0.3)", borderRadius: 3,
              fontSize: 10, color: "#ff4466", letterSpacing: 1, fontFamily: "Fira Code, monospace",
              maxWidth: 240,
            }}>
              {error}
            </div>
          )}
          <button
            onClick={fetchData}
            disabled={refreshing}
            style={{
              background: "none", border: "1px solid #1c2333",
              color: refreshing ? "#3a4454" : "#00ff88",
              padding: "4px 14px", cursor: refreshing ? "not-allowed" : "pointer",
              fontSize: 10, letterSpacing: 1.5, fontFamily: "Fira Code, monospace",
              borderRadius: 3, transition: "all 0.2s",
            }}
          >
            {refreshing ? "UPDATING…" : "↻ REFRESH"}
          </button>
          {lastUpdate && (
            <div style={{ fontSize: 9, color: "#3a4454", fontFamily: "Fira Code, monospace" }}>
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* ─── Metric Cards ─── */}
      {m && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <MetricCard label="24h Breadth" value={`${m.b24}%`} sub={`VW: ${m.vw24 ?? "—"}%`} color={breadthColor(m.b24)} />
          <MetricCard label="1h Breadth"  value={m.b1  != null ? `${m.b1}%`  : "—"} color={breadthColor(m.b1)} />
          <MetricCard label="7d Breadth"  value={m.b7  != null ? `${m.b7}%`  : "—"} color={breadthColor(m.b7)} />
          <MetricCard label="30d Breadth" value={m.b30 != null ? `${m.b30}%` : "—"} color={breadthColor(m.b30)} />
          <MetricCard label="Advancing"   value={m.adv} sub={`of ${m.adv + m.dec}`} color="#00ff88" />
          <MetricCard label="Declining"   value={m.dec} color="#ff1744" />
        </div>
      )}

      {/* ─── Chart + Sectors ─── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>

        {/* Breadth Chart */}
        <div style={{
          background: "#0d1117", border: "1px solid #1c2333",
          borderRadius: 4, padding: "16px", flex: 3, minWidth: 280,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#3a4454", textTransform: "uppercase", fontFamily: "Fira Code, monospace" }}>
              Breadth History
            </div>
            <div style={{ fontSize: 9, color: "#3a4454", fontFamily: "Fira Code, monospace" }}>
              · first 24 pts = seeded demo
            </div>
          </div>

          {/* Regime zone labels */}
          <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            {[["BULL ZONE", "#00ff88", 60], ["NEUTRAL", "#4a5568", 50], ["BEAR ZONE", "#ff1744", 40]].map(([lbl, col]) => (
              <div key={lbl} style={{ fontSize: 8, color: col, letterSpacing: 1.5, fontFamily: "Fira Code, monospace" }}>
                — {lbl}
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="g24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartColor} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="g7" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00b4d8" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#00b4d8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2333" vertical={false}/>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 8, fill: "#3a4454", fontFamily: "Fira Code" }}
                tickLine={false} axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 8, fill: "#3a4454", fontFamily: "Fira Code" }}
                tickLine={false} axisLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={60} stroke={`${chartColor}30`} strokeDasharray="4 4"/>
              <ReferenceLine y={50} stroke="#ffffff12"          strokeDasharray="2 4"/>
              <ReferenceLine y={40} stroke="rgba(255,23,68,0.25)" strokeDasharray="4 4"/>
              <Area dataKey="b1h"  name="1h"  stroke="#9b59b670" fill="none"       strokeWidth={1}   dot={false} connectNulls/>
              <Area dataKey="b24h" name="24h" stroke={chartColor} fill="url(#g24)" strokeWidth={2}   dot={false} connectNulls/>
              <Area dataKey="b7d"  name="7d"  stroke="#00b4d8"    fill="url(#g7)"  strokeWidth={1.5} dot={false} strokeDasharray="5 3" connectNulls/>
            </AreaChart>
          </ResponsiveContainer>

          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {[["1h", "#9b59b6"], ["24h", chartColor], ["7d", "#00b4d8"]].map(([lbl, col]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "#4a5568", fontFamily: "Fira Code, monospace" }}>
                <div style={{ width: 18, height: 2, background: col }}/>
                {lbl} BREADTH
              </div>
            ))}
          </div>
        </div>

        {/* Sector Breadth */}
        <div style={{
          background: "#0d1117", border: "1px solid #1c2333",
          borderRadius: 4, padding: "16px", flex: 1, minWidth: 200,
        }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#3a4454", textTransform: "uppercase", fontFamily: "Fira Code, monospace", marginBottom: 16 }}>
            Sector Breadth (24h)
          </div>
          {m?.sectors.map(s => (
            <SectorRow key={s.name} {...s}/>
          ))}
        </div>
      </div>

      {/* ─── Gainers / Losers ─── */}
      {m && (
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { title: "▲ Top Gainers (24h)", list: m.gainers, sign: 1, color: "#00ff88" },
            { title: "▼ Top Losers (24h)",  list: m.losers,  sign: -1, color: "#ff1744" },
          ].map(({ title, list, color }) => (
            <div key={title} style={{
              background: "#0d1117", border: "1px solid #1c2333",
              borderRadius: 4, padding: "14px 16px", flex: 1, minWidth: 260,
            }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: `${color}80`, textTransform: "uppercase", fontFamily: "Fira Code, monospace", marginBottom: 12 }}>
                {title}
              </div>
              {list.map(c => {
                const pct = c[PCT_KEY["24h"]];
                return (
                  <div key={c.id} style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "5px 0",
                    borderBottom: "1px solid #0a0d14",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {c.image && <img src={c.image} alt="" style={{ width: 18, height: 18, borderRadius: "50%" }}/>}
                      <div>
                        <span style={{ fontSize: 12, color: "#c9d1d9", fontFamily: "Fira Code, monospace" }}>
                          {c.symbol.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 9, color: "#3a4454", marginLeft: 6 }}>{c.name}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color, fontFamily: "Fira Code, monospace", fontWeight: 600 }}>
                        {fmtPct(pct)}
                      </div>
                      <div style={{ fontSize: 9, color: "#3a4454" }}>{fmtPrice(c.current_price)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ─── Coin Table ─── */}
      <div style={{
        background: "#0d1117", border: "1px solid #1c2333",
        borderRadius: 4, padding: "14px 16px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#3a4454", textTransform: "uppercase", fontFamily: "Fira Code, monospace" }}>
            All Coins — Top 100
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              background: "#060910", border: "1px solid #1c2333",
              color: "#c9d1d9", padding: "5px 12px", fontSize: 11,
              fontFamily: "Fira Code, monospace", borderRadius: 3,
              outline: "none", width: 180,
            }}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TH label="#"       sortK="market_cap_rank" align="right" />
                <TH label="Coin"    sortK="name" align="left" />
                <TH label="Price"   sortK="current_price" />
                <TH label="Mkt Cap" sortK="market_cap" />
                <TH label="Vol 24h" sortK="total_volume" />
                <TH label="1h %"    sortK="price_change_percentage_1h_in_currency" />
                <TH label="24h %"   sortK="price_change_percentage_24h_in_currency" />
                <TH label="7d %"    sortK="price_change_percentage_7d_in_currency" />
                <TH label="30d %"   sortK="price_change_percentage_30d_in_currency" />
              </tr>
            </thead>
            <tbody>
              {tableCoins.map((c, i) => (
                <CoinRow key={c.id} c={c} rank={c.market_cap_rank} even={i % 2 !== 0} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div style={{
        marginTop: 16, textAlign: "center",
        fontSize: 9, color: "#1c2333", letterSpacing: 2,
        fontFamily: "Fira Code, monospace",
      }}>
        DATA: COINGECKO FREE API · AUTO-REFRESHES EVERY 2 MIN · FOR INFORMATIONAL USE ONLY · NOT FINANCIAL ADVICE
      </div>
    </div>
  );
}
