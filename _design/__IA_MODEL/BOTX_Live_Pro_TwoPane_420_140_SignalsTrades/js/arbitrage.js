// Triangular arbitrage ranking with bookTicker (bid/ask) + fee + slippage
import { API, fmt, nowTime, getEffectiveFeePerTrade } from './utils.js';

let timer=null;
const tbody = document.querySelector('#arbTable tbody');
const baseSel = document.getElementById('arbBase');
const slipInput = document.getElementById('slippage');

function assets(){ return ['BTC','ETH','BNB','XRP','ADA','SOL']; }
function cycles(base){
  const A = assets(), out=[];
  for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++){ out.push([base,A[i],A[j]]); out.push([base,A[j],A[i]]); }
  return out;
}
async function fetchBook(){
  const res = await fetch(`${API.binance}/api/v3/ticker/bookTicker`);
  if(!res.ok) throw new Error('bookTicker fail');
  const arr = await res.json(), m = new Map();
  for(const it of arr) m.set(it.symbol, { bid:Number(it.bidPrice), ask:Number(it.askPrice) });
  return m;
}
function convert(amt, from, to, book){
  if(from===to) return amt;
  const d = `${from}${to}`, i = `${to}${from}`;
  if(book.has(d)){ const {bid}=book.get(d); return bid? amt*bid : null; }
  if(book.has(i)){ const {ask}=book.get(i); return ask? amt/ask : null; }
  return null;
}
function applyCosts(x, fee, slip){ return x * (1-fee) * (1-slip/100); }
function label(b,a,c){ return `${b} → ${a} → ${c} → ${b}`; }

async function runOnce(){
  const base = baseSel.value;
  const fee  = getEffectiveFeePerTrade();
  const slip = Number(slipInput.value)||0;
  const book = await fetchBook();
  const res = [];
  for(const [B,A,C] of cycles(base)){
    let amt = 1.0;
    const s1 = convert(amt,B,A,book); if(s1==null) continue; amt = applyCosts(s1,fee,slip);
    const s2 = convert(amt,A,C,book); if(s2==null) continue; amt = applyCosts(s2,fee,slip);
    const s3 = convert(amt,C,B,book); if(s3==null) continue; amt = applyCosts(s3,fee,slip);
    res.push({ key:label(B,A,C), pnlPct:(amt-1)*100, amt, fee, slip, time:nowTime() });
  }
  res.sort((a,b)=> b.pnlPct - a.pnlPct);
  tbody.innerHTML='';
  for(const r of res.slice(0,20)){
    const good = r.pnlPct>0.05;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="mono">${r.key}</td>
      <td>${good?`<strong style="color:#00d69e;">${fmt(r.pnlPct,4)}%</strong>`:`<span class="muted">${fmt(r.pnlPct,4)}%</span>`}</td>
      <td class="small mono">fee=${(r.fee*100).toFixed(3)}% | slip=${r.slip}% | 1 → ${fmt(r.amt,6)}</td>
      <td class="small muted">${r.time}</td>`;
    tbody.appendChild(tr);
  }
}
function start(){ if(timer) return; runOnce().catch(console.error); timer=setInterval(()=>runOnce().catch(console.error),3000); }
function stop(){ if(timer){ clearInterval(timer); timer=null; } }
document.getElementById('startArb').addEventListener('click', start);
document.getElementById('stopArb').addEventListener('click', stop);
