import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

const P = {
  bg:"#f4f6f2", surface:"#ffffff", surface2:"#f9faf8",
  border:"#e2e8de", border2:"#edf0ea",
  textPri:"#2d3a2e", textSec:"#6b7c6d", textMuted:"#a8b8aa",
  green:"#5a9e78", greenPale:"#eaf4ee",
  red:"#c26b6b",   redPale:"#faecec",
  amber:"#c49a45", amberPale:"#fdf4e3",
  blue:"#5b8fb9",  bluePale:"#e8f1f8",
  lavender:"#8b7fba", teal:"#4a9e9e",
};

const STORAGE_KEY  = "cbt_bybit_v2";
const MIN_HOUR_GAP = 15 * 60 * 1000;
const MAX_POINTS   = 3000;

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
  XRP:"L1",LTC:"L1",BCH:"L1",ETC:"L1",KAS:"L1",TIA:"L1",INJ:"L1",
  BERA:"L1",CORE:"L1",S:"L1",SONIC:"L1",FLOW:"L1",XTZ:"L1",EOS:"L1",
  MATIC:"L2",ARB:"L2",OP:"L2",IMX:"L2",STRK:"L2",ZK:"L2",MNT:"L2",
  MANTLE:"L2",METIS:"L2",BASE:"L2",BLAST:"L2",SCR:"L2",MANTA:"L2",ZRO:"L2",
  UNI:"DeFi",AAVE:"DeFi",MKR:"DeFi",CRV:"DeFi",SNX:"DeFi",COMP:"DeFi",
  LDO:"DeFi",PENDLE:"DeFi",GMX:"DeFi",DYDX:"DeFi",CAKE:"DeFi",JUP:"DeFi",
  SUSHI:"DeFi",ENA:"DeFi",MORPHO:"DeFi",USUAL:"DeFi",RESOLV:"DeFi",
  DRIFT:"DeFi",HYPE:"DeFi",RAY:"DeFi",EIGEN:"DeFi",ETHFI:"DeFi",
  RUNE:"DeFi",SKY:"DeFi",ONDO:"DeFi",PYTH:"DeFi",JTO:"DeFi",OSMO:"DeFi",
  FET:"AI",OCEAN:"AI",RNDR:"AI",RENDER:"AI",WLD:"AI",GRT:"AI",TAO:"AI",
  AGIX:"AI",AKT:"AI",NMR:"AI",VIRTUAL:"AI",AIXBT:"AI",ARC:"AI",GAME:"AI",
  GRASS:"AI",AETHIR:"AI",ATH:"AI",IO:"AI","AI16Z":"AI",SAGA:"AI",
  DOGE:"Meme",SHIB:"Meme",PEPE:"Meme",BONK:"Meme",WIF:"Meme",FLOKI:"Meme",
  BRETT:"Meme",TURBO:"Meme",MOG:"Meme",POPCAT:"Meme",TRUMP:"Meme",
  PNUT:"Meme",GOAT:"Meme",MEW:"Meme",NEIRO:"Meme",FARTCOIN:"Meme",
  SPX:"Meme",MOODENG:"Meme",GIGA:"Meme",PURR:"Meme",CHILLGUY:"Meme",
  PEOPLE:"Meme",DOGS:"Meme",MEME:"Meme",BOME:"Meme",MYRO:"Meme",
  AXS:"Gaming",SAND:"Gaming",MANA:"Gaming",GALA:"Gaming",RON:"Gaming",
  BEAM:"Gaming",PIXEL:"Gaming",PRIME:"Gaming",ILV:"Gaming",YGG:"Gaming",
  APE:"Gaming",ENJ:"Gaming",GMT:"Gaming",
};

const SECTOR_META = {
  L1:{color:P.green}, L2:{color:P.blue}, DeFi:{color:P.lavender},
  AI:{color:P.amber}, Meme:{color:P.red}, Gaming:{color:P.teal},
  Other:{color:P.textMuted},
};

const REGIME_META = {
  BULL:   {label:"Bull Market",  color:P.green,   bg:P.greenPale},
  BEAR:   {label:"Bear Market",  color:P.red,     bg:P.redPale},
  WARMING:{label:"Warming Up",   color:P.amber,   bg:P.amberPale},
  COOLING:{label:"Cooling Off",  color:P.blue,    bg:P.bluePale},
  NEUTRAL:{label:"Neutral",      color:P.textSec, bg:P.surface2},
};

const PCT_KEY = {
  "1h":"price_change_percentage_1h_in_currency",
  "24h":"price_change_percentage_24h_in_currency",
  "7d":"price_change_percentage_7d_in_currency",
  "30d":"price_change_percentage_30d_in_currency",
};

const RANGE_OPTIONS = [
  {label:"7d",  hours:168},
  {label:"14d", hours:336},
  {label:"30d", hours:720},
  {label:"All", hours:10000},
];

const BYBIT_BASE = "https://api.bybit.com";

// ── helpers ──────────────────────────────────
const calcBreadth = (coins, tf) => {
  const k = PCT_KEY[tf];
  const v = coins.filter(c => c[k] != null);
  if (!v.length) return null;
  return Math.round(v.filter(c => c[k] > 0).length / v.length * 100);
};
const getRegime = (b24, b7) => {
  if (b24 == null) return null;
  if (b24 >= 65 && (b7 == null || b7 >= 58)) return "BULL";
  if (b24 <= 32 || (b7 != null && b7 <= 32)) return "BEAR";
  if (b24 >= 55) return "WARMING";
  if (b24 <= 44) return "COOLING";
  return "NEUTRAL";
};
const bc  = p => p == null ? P.textMuted : p >= 60 ? P.green : p <= 40 ? P.red : P.amber;
const bbg = p => p == null ? P.surface2  : p >= 60 ? P.greenPale : p <= 40 ? P.redPale : P.amberPale;
const fmtPct = n => n == null ? "—" : `${n>0?"+":""}${n.toFixed(2)}%`;
const fmtLarge = n => {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
};
const fmtPrice = n => {
  if (n == null) return "—";
  if (n >= 1000) return `$${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mkLabel = ts => {
  const d = new Date(ts);
  return {
    label:     d.toLocaleDateString([],{month:"short",day:"numeric"}) + " " + d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
    dateLabel: d.toLocaleDateString([],{month:"short",day:"numeric"}),
  };
};

const loadHistory = () => {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
};
const saveHistory = pts => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pts.slice(-MAX_POINTS))); }
  catch {}
};

// ── BYBIT: fetch real exchange candles ────────────────────────────────
const fetchBybitSymbols = async () => {
  try {
    const res = await fetch(`${BYBIT_BASE}/v5/market/instruments-info?category=spot&limit=1000`);
    if (!res.ok) throw new Error("instruments-info failed");
    const data = await res.json();
    if (data.retCode !== 0) throw new Error(data.retMsg || "Bybit error");
    const valid = new Set();
    for (const inst of data.result.list) {
      if (inst.quoteCoin === "USDT" && inst.status === "Trading") valid.add(inst.baseCoin);
    }
    return valid;
  } catch (e) {
    console.error("[Bybit] symbols fetch failed:", e);
    return null;
  }
};

const fetchBybitKlines = async (symbol) => {
  try {
    const res = await fetch(
      `${BYBIT_BASE}/v5/market/kline?category=spot&symbol=${symbol}USDT&interval=60&limit=1000`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.retCode !== 0 || !Array.isArray(data.result?.list)) return null;
    // Bybit returns newest→oldest, reverse to oldest→newest
    // Format: [startMs, open, high, low, close, volume, turnover]
    return data.result.list.slice().reverse().map(k => ({
      ts:    parseInt(k[0], 10),
      close: parseFloat(k[4]),
    })).filter(p => !isNaN(p.close) && p.close > 0);
  } catch {
    return null;
  }
};

const fetchAllBybitHistory = async (coins, onProgress) => {
  const validSymbols = await fetchBybitSymbols();
  if (!validSymbols) throw new Error("Bybit instruments-info unreachable");

  const eligible = coins.filter(c => validSymbols.has(c.symbol.toUpperCase()));
  console.log(`[Bybit] ${eligible.length}/${coins.length} coins eligible for klines`);

  const priceData = {};
  let done = 0;
  const CONCURRENCY = 12;

  for (let i = 0; i < eligible.length; i += CONCURRENCY) {
    const batch = eligible.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(coin => fetchBybitKlines(coin.symbol.toUpperCase()))
    );
    batch.forEach((coin, idx) => {
      if (results[idx] && results[idx].length >= 30) {
        priceData[coin.id] = {
          prices: results[idx],
          volume: coin.total_volume || 0,
          symbol: coin.symbol.toUpperCase(),
        };
      }
    });
    done += batch.length;
    onProgress(Math.round(done / eligible.length * 100));
    await sleep(100);
  }

  console.log(`[Bybit] Got kline data for ${Object.keys(priceData).length} coins`);
  return priceData;
};

// ── Compute momentum breadth at 1h, 24h, 7d, 30d windows ─────────────
// mom_N at time t = % of coins where price[t] > price[t-N hours]
const computeBreadthFromBybit = (priceData) => {
  const coinIds = Object.keys(priceData);
  if (coinIds.length < 10) return [];

  // Use the coin with most data as the time reference
  const refId = coinIds.reduce((a, b) =>
    priceData[a].prices.length >= priceData[b].prices.length ? a : b);
  const refTimestamps = priceData[refId].prices.map(p => p.ts);

  // Build O(1) timestamp→index lookup per coin
  const priceIndex = {};
  for (const id of coinIds) {
    const idx = new Map();
    priceData[id].prices.forEach((p, i) => idx.set(p.ts, i));
    priceIndex[id] = idx;
  }

  const pts = [];
  for (let ri = 24; ri < refTimestamps.length; ri++) {
    const ts = refTimestamps[ri];
    let count = 0;
    let adv1  = 0, c1  = 0;
    let adv24 = 0, c24 = 0;
    let adv7d = 0, c7d = 0;
    let adv30 = 0, c30 = 0;

    for (const id of coinIds) {
      const idx = priceIndex[id].get(ts);
      if (idx === undefined) continue;
      const prices = priceData[id].prices;
      const price  = prices[idx].close;
      count++;

      // 1h
      if (idx >= 1) {
        c1++;
        if (price > prices[idx - 1].close) adv1++;
      }
      // 24h
      if (idx >= 24) {
        c24++;
        if (price > prices[idx - 24].close) adv24++;
      }
      // 7d
      if (idx >= 168) {
        c7d++;
        if (price > prices[idx - 168].close) adv7d++;
      }
      // 30d (approximate — we have max ~41 days)
      if (idx >= 720) {
        c30++;
        if (price > prices[idx - 720].close) adv30++;
      }
    }

    if (count < 10) continue;

    pts.push({
      ts, ...mkLabel(ts),
      mom1h:  c1  > 0 ? Math.round(adv1  / c1  * 100) : null,
      mom24:  c24 > 0 ? Math.round(adv24 / c24 * 100) : null,
      mom7d:  c7d > 0 ? Math.round(adv7d / c7d * 100) : null,
      mom30d: c30 > 0 ? Math.round(adv30 / c30 * 100) : null,
      seeded: false, real: true, src: "bybit",
    });
  }

  return pts;
};

// ── components ────────────────────────────────
const MetricCard = ({ label, value, sub, pct }) => {
  const col = bc(pct), bg = bbg(pct);
  return (
    <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderTop:`3px solid ${col}`, padding:"14px 18px", flex:1, minWidth:110, borderRadius:8 }}>
      <div style={{ fontSize:9, letterSpacing:2, color:P.textMuted, textTransform:"uppercase", marginBottom:10, fontFamily:"DM Mono, monospace" }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:600, color:col, fontFamily:"DM Mono, monospace", lineHeight:1 }}>{value ?? "—"}</div>
      {sub && <div style={{ display:"inline-block", marginTop:8, fontSize:10, color:col, background:bg, padding:"2px 8px", borderRadius:20, fontFamily:"DM Mono, monospace" }}>{sub}</div>}
    </div>
  );
};

const SectorRow = ({ name, pct, adv, total }) => {
  const meta = SECTOR_META[name] || SECTOR_META.Other;
  const c = bc(pct);
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:meta.color }}/>
          <span style={{ fontSize:11, color:P.textSec, fontFamily:"DM Mono, monospace" }}>{name}</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:10, color:P.textMuted }}>{adv}/{total}</span>
          <span style={{ fontSize:12, color:c, fontFamily:"DM Mono, monospace", fontWeight:600, background:bbg(pct), padding:"1px 8px", borderRadius:10 }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height:4, background:P.border, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${c}80,${c})`, borderRadius:2, transition:"width 1s ease" }}/>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const fullLabel = payload[0]?.payload?.label ?? "";
  return (
    <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:8, padding:"10px 14px", fontSize:11, fontFamily:"DM Mono, monospace", boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
      <div style={{ color:P.textMuted, marginBottom:6, fontSize:10 }}>{fullLabel}</div>
      {payload.map(p => <div key={p.dataKey} style={{ color:p.color||P.textSec, marginBottom:3 }}>{p.name}: {p.value != null ? `${p.value}%` : "—"}</div>)}
    </div>
  );
};

const CoinRow = ({ c, rank, even }) => {
  const p1=c[PCT_KEY["1h"]], p24=c[PCT_KEY["24h"]]??c.price_change_percentage_24h, p7=c[PCT_KEY["7d"]], p30=c[PCT_KEY["30d"]];
  const pill = v => ({ padding:"2px 8px", borderRadius:10, fontSize:10, fontFamily:"DM Mono, monospace", color:bc(v>0?70:v<0?30:50), background:bbg(v>0?70:v<0?30:50), whiteSpace:"nowrap", display:"inline-block" });
  const TD = ({ val, align="right", style={} }) => <td style={{ padding:"7px 10px", fontSize:11, textAlign:align, borderBottom:`1px solid ${P.border2}`, verticalAlign:"middle", ...style }}>{val}</td>;
  return (
    <tr style={{ background:even?P.surface2:P.surface }}>
      <TD val={<span style={{ color:P.textMuted, fontSize:10, fontFamily:"DM Mono, monospace" }}>{rank}</span>}/>
      <TD align="left" val={<div style={{ display:"flex", alignItems:"center", gap:8 }}>{c.image&&<img src={c.image} alt="" style={{ width:20, height:20, borderRadius:"50%" }}/>}<span style={{ color:P.textPri, fontWeight:500, fontSize:12, fontFamily:"DM Mono, monospace" }}>{c.symbol.toUpperCase()}</span><span style={{ color:P.textMuted, fontSize:10 }}>{c.name}</span></div>}/>
      <TD val={<span style={{ color:P.textSec, fontFamily:"DM Mono, monospace" }}>{fmtPrice(c.current_price)}</span>}/>
      <TD val={<span style={{ color:P.textMuted, fontFamily:"DM Mono, monospace", fontSize:10 }}>{fmtLarge(c.market_cap)}</span>}/>
      <TD val={<span style={{ color:P.textMuted, fontFamily:"DM Mono, monospace", fontSize:10 }}>{fmtLarge(c.total_volume)}</span>}/>
      <TD val={<span style={pill(p1)}>{fmtPct(p1)}</span>}/>
      <TD val={<span style={pill(p24)}>{fmtPct(p24)}</span>}/>
      <TD val={<span style={pill(p7)}>{fmtPct(p7)}</span>}/>
      <TD val={<span style={pill(p30)}>{fmtPct(p30)}</span>}/>
    </tr>
  );
};

// ── main ──────────────────────────────────────
export default function App() {
  const [coins, setCoins]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [history, setHistory]       = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootPct, setBootPct]       = useState(0);
  const [bootStatus, setBootStatus] = useState("");
  const [search, setSearch]         = useState("");
  const [sortKey, setSortKey]       = useState("market_cap");
  const [sortDir, setSortDir]       = useState("desc");
  const [range, setRange]           = useState(336); // default 14d
  const bootRan = useRef(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // ── CoinGecko: current coin list, prices, sectors (fast call) ──
  const fetchCoinGecko = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets" +
        "?vs_currency=usd&order=market_cap_desc&per_page=250&page=1" +
        "&sparkline=false&price_change_percentage=1h,24h,7d,30d"
      );
      if (!res.ok) throw new Error(res.status === 429 ? "Rate limited" : `API error ${res.status}`);
      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error("Bad response");
      const filtered = raw.filter(c => !EXCLUDE.has(c.symbol?.toUpperCase()));
      setCoins(filtered);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCoinGecko();
    const id = setInterval(fetchCoinGecko, 60_000);
    return () => clearInterval(id);
  }, [fetchCoinGecko]);

  // ── Bybit bootstrap: run once we have a coin list, then periodically ──
  useEffect(() => {
    if (!coins.length || bootRan.current) return;
    bootRan.current = true;

    // Load cached history immediately if present
    const cached = loadHistory();
    if (cached && cached.length > 0) {
      setHistory(cached);
    }

    // Always re-fetch fresh Bybit data in background to stay current
    const runBybit = async () => {
      setBootstrapping(true);
      setBootStatus("Connecting to Bybit…");
      try {
        const priceData = await fetchAllBybitHistory(coins, pct => {
          setBootPct(pct);
          setBootStatus(`${pct}% — fetching 41 days of hourly klines`);
        });
        setBootStatus("Computing breadth metrics…");
        const pts = computeBreadthFromBybit(priceData);
        console.log(`[Bybit] Computed ${pts.length} breadth points`);
        if (pts.length > 0) {
          setHistory(pts);
          saveHistory(pts);
          setBootStatus(`${pts.length} real hourly points from Bybit`);
        } else {
          setBootStatus("No Bybit data available — check connection");
        }
      } catch (e) {
        console.error("[Bybit] bootstrap failed:", e);
        setBootStatus(`Bybit error: ${e.message}`);
      } finally {
        setBootstrapping(false);
      }
    };
    runBybit();
  }, [coins]);

  // ── Periodic Bybit refresh every 10 minutes to keep latest bar current ──
  useEffect(() => {
    if (!coins.length) return;
    const id = setInterval(async () => {
      try {
        const priceData = await fetchAllBybitHistory(coins, () => {});
        const pts = computeBreadthFromBybit(priceData);
        if (pts.length > 0) {
          setHistory(pts);
          saveHistory(pts);
        }
      } catch (e) {
        console.error("[Bybit] periodic refresh failed:", e);
      }
    }, 10 * 60_000);
    return () => clearInterval(id);
  }, [coins]);

  const visibleHistory = useMemo(() => {
    if (!history.length) return [];
    const cutoff = Date.now() - range * 60 * 60 * 1000;
    const pts = history.filter(p => p.ts >= cutoff && p.mom24 != null);
    const maxPts = range <= 168 ? pts.length : 500;
    if (pts.length <= maxPts) return pts;
    const step = Math.ceil(pts.length / maxPts);
    return pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  }, [history, range]);

  const m = useMemo(() => {
    if (!coins.length) return null;
    // All timeframes use the same methodology: Bybit momentum breadth
    const latest = history.length > 0 ? history[history.length - 1] : null;
    const b1  = latest?.mom1h  ?? calcBreadth(coins, "1h");
    const b24 = latest?.mom24  ?? calcBreadth(coins, "24h");
    const b7  = latest?.mom7d  ?? calcBreadth(coins, "7d");
    const b30 = latest?.mom30d ?? calcBreadth(coins, "30d");
    const r   = getRegime(b24, b7);
    const k24 = PCT_KEY["24h"];
    const adv = coins.filter(c => (c[k24] ?? c.price_change_percentage_24h ?? 0) > 0).length;
    const dec = coins.filter(c => (c[k24] ?? c.price_change_percentage_24h ?? 0) < 0).length;
    const secMap = {};
    coins.forEach(c => {
      const s = SECTOR_MAP[c.symbol?.toUpperCase()] || "Other";
      if (!secMap[s]) secMap[s] = { adv:0, total:0 };
      secMap[s].total++;
      if ((c[k24] ?? c.price_change_percentage_24h ?? 0) > 0) secMap[s].adv++;
    });
    const sectors = Object.entries(secMap).map(([name,d])=>({name,pct:Math.round(d.adv/d.total*100),adv:d.adv,total:d.total})).sort((a,b)=>b.total-a.total);
    const sorted = [...coins].filter(c=>c[k24]!=null).sort((a,b)=>b[k24]-a[k24]);
    return { b1, b24, b7, b30, regime:r, regimeMeta:r?REGIME_META[r]:REGIME_META.NEUTRAL, adv, dec, sectors, gainers:sorted.slice(0,8), losers:sorted.slice(-8).reverse() };
  }, [coins, history]);

  const tableCoins = useMemo(() => {
    let r=[...coins];
    if(search){const q=search.toLowerCase();r=r.filter(c=>c.name.toLowerCase().includes(q)||c.symbol.toLowerCase().includes(q));}
    r.sort((a,b)=>{const av=a[sortKey]??0,bv=b[sortKey]??0;return sortDir==="desc"?bv-av:av-bv;});
    return r.slice(0,100);
  }, [coins,search,sortKey,sortDir]);

  const toggleSort = key => { if(sortKey===key)setSortDir(d=>d==="desc"?"asc":"desc"); else{setSortKey(key);setSortDir("desc");} };
  const chartColor = bc(m?.b24);

  if (loading && !coins.length) return (
    <div style={{ background:P.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"DM Sans, sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:20, fontWeight:600, color:P.green, marginBottom:8 }}>Crypto Breadth Terminal</div>
        <div style={{ color:P.textMuted, fontSize:12 }}>Loading…</div>
        <div style={{ width:200, height:3, background:P.border, margin:"18px auto 0", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", background:P.green, animation:"slide 1.5s ease-in-out infinite" }}/>
        </div>
      </div>
      <style>{`@keyframes slide{0%{width:0;margin-left:0}50%{width:100%;margin-left:0}100%{width:0;margin-left:100%}}`}</style>
    </div>
  );

  const TH = ({ label, sortK, align="right" }) => (
    <th onClick={()=>toggleSort(sortK)} style={{ padding:"8px 10px", fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:sortKey===sortK?P.green:P.textMuted, textAlign:align, cursor:"pointer", userSelect:"none", whiteSpace:"nowrap", fontFamily:"DM Mono, monospace", fontWeight:400, borderBottom:`2px solid ${P.border}`, background:P.surface2 }}>
      {label}{sortKey===sortK?(sortDir==="desc"?" ↓":" ↑"):""}
    </th>
  );

  return (
    <div style={{ background:P.bg, minHeight:"100vh", color:P.textPri, padding:"16px 20px", fontFamily:"DM Sans, sans-serif" }}>
      <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:${P.surface2};}::-webkit-scrollbar-thumb{background:${P.border};border-radius:3px;}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}@keyframes slide{0%{width:0;margin-left:0}50%{width:100%;margin-left:0}100%{width:0;margin-left:100%}}`}</style>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, paddingBottom:14, borderBottom:`1px solid ${P.border}`, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:600, color:P.textPri }}>Crypto Breadth Terminal</div>
          <div style={{ fontSize:10, color:P.textMuted, marginTop:3, fontFamily:"DM Mono, monospace", letterSpacing:1 }}>
            {coins.length} coins · {history.length} real hourly points · source: Bybit spot klines
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {m?.regime && <div style={{ padding:"4px 14px", background:m.regimeMeta.bg, border:`1px solid ${m.regimeMeta.color}40`, borderRadius:20, fontSize:10, color:m.regimeMeta.color, fontFamily:"DM Mono, monospace" }}>{m.regimeMeta.label}</div>}
          {error && <div style={{ padding:"4px 12px", background:P.redPale, border:`1px solid ${P.red}30`, borderRadius:20, fontSize:10, color:P.red, fontFamily:"DM Mono, monospace" }}>{error}</div>}
          <button onClick={fetchCoinGecko} disabled={refreshing} style={{ background:refreshing?P.surface2:P.greenPale, border:`1px solid ${refreshing?P.border:P.green}60`, color:refreshing?P.textMuted:P.green, padding:"5px 14px", cursor:refreshing?"not-allowed":"pointer", fontSize:10, fontFamily:"DM Mono, monospace", borderRadius:20, transition:"all 0.2s" }}>
            {refreshing?"Updating…":"↻ Refresh"}
          </button>
          {lastUpdate && <div style={{ fontSize:10, color:P.textMuted, fontFamily:"DM Mono, monospace" }}>{lastUpdate.toLocaleTimeString()}</div>}
        </div>
      </div>

      {/* Bootstrap progress banner */}
      {bootstrapping && (
        <div style={{ background:P.bluePale, border:`1px solid ${P.blue}40`, borderRadius:8, padding:"10px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:P.blue, fontFamily:"DM Mono, monospace", marginBottom:6 }}>{bootStatus}</div>
            <div style={{ height:4, background:"#fff", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${bootPct}%`, background:P.blue, borderRadius:2, transition:"width 0.5s ease" }}/>
            </div>
          </div>
          <div style={{ fontSize:10, color:P.blue, fontFamily:"DM Mono, monospace" }}>{bootPct}%</div>
        </div>
      )}

      {/* METRIC CARDS */}
      {m && (
        <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          <MetricCard label="1h Breadth"  value={m.b1  != null?`${m.b1}%`:"—"}  pct={m.b1}/>
          <MetricCard label="24h Breadth" value={m.b24 != null?`${m.b24}%`:"—"} pct={m.b24}/>
          <MetricCard label="7d Breadth"  value={m.b7  != null?`${m.b7}%`:"—"}  pct={m.b7}/>
          <MetricCard label="30d Breadth" value={m.b30 != null?`${m.b30}%`:"—"} pct={m.b30}/>
          <MetricCard label="Advancing"   value={m.adv} pct={70} sub={`of ${m.adv+m.dec}`}/>
          <MetricCard label="Declining"   value={m.dec} pct={30}/>
        </div>
      )}

      {/* CHARTS */}
      <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"18px 18px 14px", flex:3, minWidth:280 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ fontSize:11, color:P.textSec, fontFamily:"DM Mono, monospace", letterSpacing:1 }}>
                24h Breadth
              </div>
              <div style={{ fontSize:9, color:P.textMuted, fontFamily:"DM Mono, monospace", marginTop:2 }}>
                % of coins higher than 24h ago · real hourly closes from Bybit spot
              </div>
            </div>
            <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
              {RANGE_OPTIONS.map(opt => (
                <button key={opt.label} onClick={()=>setRange(opt.hours)} style={{ background:range===opt.hours?P.greenPale:"none", border:`1px solid ${range===opt.hours?P.green:P.border}`, color:range===opt.hours?P.green:P.textMuted, padding:"3px 10px", cursor:"pointer", fontSize:10, fontFamily:"DM Mono, monospace", borderRadius:20, transition:"all 0.15s" }}>{opt.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", gap:14, marginBottom:6, flexWrap:"wrap" }}>
            {[["Bull >60%",P.green],["Neutral 40–60%",P.textMuted],["Bear <40%",P.red]].map(([lbl,col])=>(
              <div key={lbl} style={{ fontSize:9, color:col, fontFamily:"DM Mono, monospace" }}>— {lbl}</div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={visibleHistory} margin={{ top:4, right:4, left:-24, bottom:0 }}>
              <defs>
                <linearGradient id="g24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartColor} stopOpacity={0.22}/>
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={P.border2} vertical={false}/>
              <XAxis dataKey="dateLabel" tick={{ fontSize:8, fill:P.textMuted }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={50}/>
              <YAxis domain={[0,100]} tick={{ fontSize:8, fill:P.textMuted }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <ReferenceLine y={60} stroke={`${P.green}55`}     strokeDasharray="4 4"/>
              <ReferenceLine y={50} stroke={`${P.textMuted}40`} strokeDasharray="2 4"/>
              <ReferenceLine y={40} stroke={`${P.red}55`}       strokeDasharray="4 4"/>
              <Area dataKey="mom24" name="24h Breadth" stroke={chartColor} fill="url(#g24)" strokeWidth={2} dot={false} connectNulls/>
            </AreaChart>
          </ResponsiveContainer>

          {visibleHistory.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 0", color:P.textMuted, fontSize:11, fontFamily:"DM Mono, monospace" }}>
              {bootstrapping ? "Fetching Bybit data…" : "No data for this range yet"}
            </div>
          )}
        </div>

        <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"18px", flex:1, minWidth:200 }}>
          <div style={{ fontSize:11, color:P.textSec, fontFamily:"DM Mono, monospace", letterSpacing:1, marginBottom:18 }}>Sector breadth (24h)</div>
          {m?.sectors.map(s => <SectorRow key={s.name} {...s}/>)}
        </div>
      </div>

      {m && (
        <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap" }}>
          {[{title:"Top gainers (24h)",list:m.gainers,col:P.green,bg:P.greenPale},{title:"Top losers (24h)",list:m.losers,col:P.red,bg:P.redPale}].map(({title,list,col,bg})=>(
            <div key={title} style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"16px 18px", flex:1, minWidth:260 }}>
              <div style={{ fontSize:11, color:P.textSec, fontFamily:"DM Mono, monospace", letterSpacing:1, marginBottom:14 }}>{title}</div>
              {list.map(c=>{const pct=c[PCT_KEY["24h"]];return(
                <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${P.border2}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {c.image&&<img src={c.image} alt="" style={{ width:20, height:20, borderRadius:"50%" }}/>}
                    <div><span style={{ fontSize:12, color:P.textPri, fontFamily:"DM Mono, monospace", fontWeight:500 }}>{c.symbol.toUpperCase()}</span><span style={{ fontSize:10, color:P.textMuted, marginLeft:6 }}>{c.name}</span></div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12, color:col, background:bg, padding:"2px 8px", borderRadius:10, fontFamily:"DM Mono, monospace" }}>{fmtPct(pct)}</div>
                    <div style={{ fontSize:9, color:P.textMuted, marginTop:2 }}>{fmtPrice(c.current_price)}</div>
                  </div>
                </div>
              );})}
            </div>
          ))}
        </div>
      )}

      <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:10, padding:"16px 18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontSize:11, color:P.textSec, fontFamily:"DM Mono, monospace", letterSpacing:1 }}>All coins — top 100</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ background:P.surface2, border:`1px solid ${P.border}`, color:P.textPri, padding:"6px 14px", fontSize:11, fontFamily:"DM Mono, monospace", borderRadius:20, outline:"none", width:180 }}/>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              <TH label="#"       sortK="market_cap_rank"                         align="right"/>
              <TH label="Coin"    sortK="name"                                    align="left"/>
              <TH label="Price"   sortK="current_price"/>
              <TH label="Mkt Cap" sortK="market_cap"/>
              <TH label="Vol 24h" sortK="total_volume"/>
              <TH label="1h %"    sortK="price_change_percentage_1h_in_currency"/>
              <TH label="24h %"   sortK="price_change_percentage_24h_in_currency"/>
              <TH label="7d %"    sortK="price_change_percentage_7d_in_currency"/>
              <TH label="30d %"   sortK="price_change_percentage_30d_in_currency"/>
            </tr></thead>
            <tbody>{tableCoins.map((c,i)=><CoinRow key={c.id} c={c} rank={c.market_cap_rank} even={i%2!==0}/>)}</tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop:16, textAlign:"center", fontSize:9, color:P.textMuted, letterSpacing:1, fontFamily:"DM Mono, monospace" }}>
        Coin list: CoinGecko · Breadth history: Bybit spot klines · Not financial advice
      </div>
    </div>
  );
}
