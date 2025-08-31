// Two-pane charts: price 420px + volume 140px, always visible
import { API } from './utils.js';

const LWC = window.LightweightCharts;
const priceEl = document.getElementById('chartContainer');
const volEl   = document.getElementById('volumeContainer');

// Price chart
const priceChart = LWC.createChart(priceEl, {
  layout: { background: { type: 'solid', color: '#0a0f14' }, textColor: '#e6f0f9' },
  grid: { vertLines: { color: '#1f2a36' }, horzLines: { color: '#1f2a36' } },
  timeScale: { borderColor: '#1f2a36', timeVisible: true, secondsVisible: false },
  rightPriceScale: { borderColor: '#1f2a36' },
  crosshair: { mode: 1 },
  width: priceEl.clientWidth,
  height: 420,
});

const candleSeries = priceChart.addCandlestickSeries({
  upColor: '#00d69e', downColor: '#f45d48', borderVisible: false, wickUpColor: '#00d69e', wickDownColor: '#f45d48',
});
const ema12Series = priceChart.addLineSeries({ color: '#39bdf8', lineWidth: 1, priceLineVisible: false });
const ema26Series = priceChart.addLineSeries({ color: '#b389ff', lineWidth: 1, priceLineVisible: false });

// Volume chart
const volChart = LWC.createChart(volEl, {
  layout: { background: { type: 'solid', color: '#0a0f14' }, textColor: '#e6f0f9' },
  grid: { vertLines: { color: '#1f2a36' }, horzLines: { color: '#1f2a36' } },
  timeScale: { borderColor: '#1f2a36', timeVisible: true, secondsVisible: false },
  rightPriceScale: { visible: true, borderColor: '#1f2a36' },
  width: volEl.clientWidth,
  height: 140,
});
const volumeSeries = volChart.addHistogramSeries({ priceFormat: { type: 'volume' } });

// Sync time scales
function syncTimes(){
  const tsMain = priceChart.timeScale();
  const tsVol  = volChart.timeScale();
  let blocking = false;
  const apply = (from, to)=>{
    if(blocking) return;
    blocking = true;
    try{
      const r = from.getVisibleRange();
      if(r && r.from && r.to) to.setVisibleRange(r);
    }catch{}
    blocking = false;
  };
  tsMain.subscribeVisibleTimeRangeChange(()=> apply(tsMain, tsVol));
  tsVol.subscribeVisibleTimeRangeChange(()=> apply(tsVol, tsMain));
}
syncTimes();

let candles = []; // {time, open, high, low, close}
let lastClose = null;
let lastSignals = [];

// WS
let ws = null;
let onPriceListeners = new Set();
export function onPrice(fn){ onPriceListeners.add(fn); return ()=> onPriceListeners.delete(fn); }
function notifyPrice(){ for(const fn of onPriceListeners) try { fn(lastClose); } catch{} }

// Indicators
function ema(values, period){
  const out = Array(values.length).fill(null);
  const k = 2/(period+1);
  let sum=0;
  for(let i=0;i<values.length;i++){
    const v = values[i];
    if(v==null){ out[i]=null; continue; }
    sum += v;
    if(i===period-1) out[i]=sum/period;
    else if(i>=period) out[i]= v*k + out[i-1]*(1-k);
  }
  return out;
}
function rsi(values, period=14){
  const out = Array(values.length).fill(null);
  let gains=0, losses=0;
  for(let i=1;i<values.length;i++){
    const ch = values[i]-values[i-1];
    const up = ch>0?ch:0, dn = ch<0?-ch:0;
    if(i<=period){ gains+=up; losses+=dn; if(i===period){ let avgG=gains/period, avgL=losses/period; out[i]=100-(100/(1+(avgL===0?100:avgG/avgL))); for(let j=i+1;j<values.length;j++){ const ch2=values[j]-values[j-1]; const up2=ch2>0?ch2:0, dn2=ch2<0?-ch2:0; avgG=(avgG*(period-1)+up2)/period; avgL=(avgL*(period-1)+dn2)/period; const rs=avgL===0?100:avgG/avgL; out[j]=100-(100/(1+rs)); } break;} }
  }
  return out;
}
function macd(values, fast=12, slow=26, signal=9){
  const emaF = ema(values, fast), emaS = ema(values, slow);
  const macdLine = values.map((_,i)=> (emaF[i]==null||emaS[i]==null)?null:(emaF[i]-emaS[i]));
  const signalLine = ema(macdLine.map(v=>v??0), signal).map((v,i)=> macdLine[i]==null?null:v);
  return { macdLine, signalLine };
}

function computeSignals(candles){
  const closes = candles.map(c=>c.close);
  const times  = candles.map(c=>c.time);
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const r = rsi(closes, 14);
  const { macdLine, signalLine } = macd(closes, 12, 26, 9);

  // overlays
  const d12=[], d26=[];
  for(let i=0;i<candles.length;i++){
    if(e12[i]!=null) d12.push({ time: times[i], value: e12[i] });
    if(e26[i]!=null) d26.push({ time: times[i], value: e26[i] });
  }
  ema12Series.setData(d12); ema26Series.setData(d26);

  const markers=[], sigs=[];
  for(let i=1;i<candles.length;i++){
    if(e12[i-1]!=null&&e26[i-1]!=null&&e12[i]!=null&&e26[i]!=null){
      if(e12[i-1]<=e26[i-1]&&e12[i]>e26[i]){ markers.push({time:times[i],position:'belowBar',color:'#00d69e',shape:'arrowUp',text:'EMA+'}); sigs.push({time:times[i],price:candles[i].close,type:'EMA',dir:'BUY',note:'Cruce EMA12>EMA26'}); }
      else if(e12[i-1]>=e26[i-1]&&e12[i]<e26[i]){ markers.push({time:times[i],position:'aboveBar',color:'#f45d48',shape:'arrowDown',text:'EMA-'}); sigs.push({time:times[i],price:candles[i].close,type:'EMA',dir:'SELL',note:'Cruce EMA12<EMA26'}); }
    }
    if(macdLine[i-1]!=null&&signalLine[i-1]!=null&&macdLine[i]!=null&&signalLine[i]!=null){
      if(macdLine[i-1]<=signalLine[i-1]&&macdLine[i]>signalLine[i]){ markers.push({time:times[i],position:'belowBar',color:'#29d',shape:'arrowUp',text:'MACD+'}); sigs.push({time:times[i],price:candles[i].close,type:'MACD',dir:'BUY',note:'MACD cruza sobre señal'}); }
      else if(macdLine[i-1]>=signalLine[i-1]&&macdLine[i]<signalLine[i]){ markers.push({time:times[i],position:'aboveBar',color:'#d62',shape:'arrowDown',text:'MACD-'}); sigs.push({time:times[i],price:candles[i].close,type:'MACD',dir:'SELL',note:'MACD cruza bajo señal'}); }
    }
    if(r[i-1]!=null&&r[i]!=null){
      if(r[i-1]<30&&r[i]>=30){ markers.push({time:times[i],position:'belowBar',color:'#0a8',shape:'arrowUp',text:'RSI↑30'}); sigs.push({time:times[i],price:candles[i].close,type:'RSI',dir:'BUY',note:'RSI sale de <30'}); }
      else if(r[i-1]>70&&r[i]<=70){ markers.push({time:times[i],position:'aboveBar',color:'#c50',shape:'arrowDown',text:'RSI↓70'}); sigs.push({time:times[i],price:candles[i].close,type:'RSI',dir:'SELL',note:'RSI sale de >70'}); }
    }
  }
  candleSeries.setMarkers(markers.slice(-300));
  lastSignals = sigs;
}

export async function loadKlines(symbol, interval){
  const url = `${API.binance}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data = await res.json();
  const vols = [];
  candles = data.map(k => ({
    time: Math.floor(k[0]/1000),
    open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]),
  }));
  for(let i=0;i<data.length;i++){
    const k = data[i];
    const time = Math.floor(k[0]/1000);
    const open = Number(k[1]), close = Number(k[4]), vol = Number(k[5]);
    vols.push({ time, value: vol, color: close>=open ? 'rgba(0,214,158,0.7)' : 'rgba(244,93,72,0.7)' });
  }
  lastClose = candles.at(-1)?.close ?? null;
  candleSeries.setData(candles);
  volumeSeries.setData(vols);
  computeSignals(candles);
  try{ const r = priceChart.timeScale().getVisibleRange(); if(r) volChart.timeScale().setVisibleRange(r);}catch{}
  notifyPrice();
  return { candles, lastClose };
}

export function getCandles(){ return candles; }
export function getLastClose(){ return lastClose; }
export function getSignals(){ return lastSignals; }

function wsUrl(symbol, interval){
  const s = symbol.toLowerCase(), i = interval.toLowerCase();
  return `wss://stream.binance.com:9443/stream?streams=${s}@kline_${i}/${s}@miniTicker`;
}
function applyWsKline(payload){
  const k = payload.k;
  const t = Math.floor(k.t/1000);
  const c = { time:t, open:Number(k.o), high:Number(k.h), low:Number(k.l), close:Number(k.c) };
  const volBar = { time:t, value:Number(k.v), color: c.close>=c.open ? 'rgba(0,214,158,0.7)' : 'rgba(244,93,72,0.7)' };
  lastClose = c.close;
  const idx = candles.findIndex(x=>x.time===t);
  if(idx>=0) candles[idx]=c; else candles.push(c);
  if(candles.length>1000) candles.shift();
  candleSeries.update(c);
  volumeSeries.update(volBar);
  computeSignals(candles);
  notifyPrice();
}
function applyMiniTicker(payload){
  const price = Number(payload.c);
  if(Number.isFinite(price)){ lastClose = price; notifyPrice(); }
}
export function startLive(symbol, interval, onStatus){
  stopLive();
  try{ ws = new WebSocket(wsUrl(symbol, interval)); }catch(e){ onStatus?.('error', e.message); return; }
  ws.onopen = ()=> onStatus?.('open');
  ws.onmessage = (msg)=>{
    try{
      const data = JSON.parse(msg.data);
      const stream = data?.stream||''; const payload = data?.data;
      if(stream.includes('@kline_')) applyWsKline(payload);
      else if(stream.includes('@miniticker')) applyMiniTicker(payload);
    }catch{}
  };
  ws.onerror = (e)=> onStatus?.('error', String(e?.message||'WS error'));
  ws.onclose = ()=> onStatus?.('close');
}
export function stopLive(){ if(ws){ try{ws.close();}catch{} ws=null; } }

window.addEventListener('resize', ()=>{
  priceChart.applyOptions({ width: priceEl.clientWidth });
  volChart.applyOptions({ width: volEl.clientWidth });
  try{ const r = priceChart.timeScale().getVisibleRange(); if(r) volChart.timeScale().setVisibleRange(r);}catch{}
});
