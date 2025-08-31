// Panel de señales: filtros + lista + trades + export + colapsable
import { getCandles, getSignals } from './chart.js';
import { fmt, getEffectiveFeePerTrade } from './utils.js';

const bodyWrap = document.getElementById('signalsBody');
const sigScroll = document.getElementById('signalsScroll');
const trdScroll = document.getElementById('tradesScroll');
const tableBody = document.querySelector('#signalsTable tbody');
const tradesBody = document.querySelector('#tradesTable tbody');
const sumEl = document.getElementById('signalsSummary');

const chkEma = document.getElementById('sigEma');
const chkMacd = document.getElementById('sigMacd');
const chkRsi = document.getElementById('sigRsi');
const entrySel = document.getElementById('entryType');

document.getElementById('refreshSignals').addEventListener('click', renderSignals);
document.getElementById('exportSignals').addEventListener('click', exportSignalsCSV);
document.getElementById('exportTrades').addEventListener('click', exportTradesCSV);
document.getElementById('runBacktest').addEventListener('click', ()=>{ buildTrades(); renderTrades(); showTrades(); });
document.getElementById('viewSignals').addEventListener('click', showSignals);
document.getElementById('viewTrades').addEventListener('click', ()=>{ buildTrades(); renderTrades(); showTrades(); });
document.getElementById('collapseSignals').addEventListener('click', ()=>{
  if(!bodyWrap) return;
  const hidden = bodyWrap.classList.toggle('hidden');
  localStorage.setItem('botx_sig_collapsed', hidden?'1':'0');
});
if(localStorage.getItem('botx_sig_collapsed')==='1') bodyWrap.classList.add('hidden');

function filterSignals(list){
  return list.filter(s =>
    (s.type==='EMA' && chkEma.checked) ||
    (s.type==='MACD' && chkMacd.checked) ||
    (s.type==='RSI' && chkRsi.checked)
  );
}

function renderSignals(){
  const list = filterSignals(getSignals());
  tableBody.innerHTML='';
  for(const s of list){
    const dt = new Date(s.time*1000).toLocaleString();
    const badge = s.dir==='BUY' ? '<span class="badge-buy">BUY</span>' : '<span class="badge-sell">SELL</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="small mono">${dt}</td><td>${s.type}</td><td>${badge}</td>
      <td class="mono">${fmt(s.price,6)}</td><td class="small">${s.note}</td>`;
    tableBody.appendChild(tr);
  }
  sumEl.textContent = `${list.length} señales en la ventana cargada.`;
}

// Trades
let trades=[];
function buildTrades(){
  const type = entrySel.value;
  const fee = getEffectiveFeePerTrade();
  const sigs = getSignals().filter(s=>s.type===type).sort((a,b)=>a.time-b.time);
  trades=[]; let pos=null;
  for(const s of sigs){
    if(s.dir==='BUY' && !pos){ pos={tIn:s.time,pIn:s.price,type,dir:'LONG'}; }
    else if(s.dir==='SELL' && pos){
      const gross = (s.price/pos.pIn)-1;
      const net = ((s.price*(1-fee))/(pos.pIn*(1+fee)))-1;
      trades.push({ entryTime:pos.tIn, exitTime:s.time, type, dir:'LONG',
        entryPrice:pos.pIn, exitPrice:s.price, durationMin:Math.round((s.time-pos.tIn)/60),
        pnlGross:gross*100, pnlNet:net*100 });
      pos=null;
    }
  }
  return trades;
}
function renderTrades(){
  tradesBody.innerHTML='';
  if(!trades.length){ sumEl.textContent='No hay trades (genera señales o ejecuta backtest).'; return; }
  let wins=0,total=0;
  for(const t of trades){
    const win = t.pnlNet>0; if(win) wins++; total+=t.pnlNet;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="small mono">${new Date(t.entryTime*1000).toLocaleString()}</td>
      <td class="small mono">${new Date(t.exitTime*1000).toLocaleString()}</td>
      <td>${t.type}</td><td>${t.dir}</td><td class="mono">${fmt(t.entryPrice,6)}</td>
      <td class="mono">${fmt(t.exitPrice,6)}</td><td class="small">${t.durationMin}m</td>
      <td class="mono">${t.pnlGross.toFixed(2)}%</td>
      <td class="mono">${win?'<span class="badge-win">'+t.pnlNet.toFixed(2)+'%</span>':'<span class="badge-lose">'+t.pnlNet.toFixed(2)+'%</span>'}</td>`;
    tradesBody.appendChild(tr);
  }
  const n=trades.length, wr = n?(wins/n*100):0, avg=n?(total/n):0;
  sumEl.textContent = `${n} trades (${entrySel.value}). Winrate ${wr.toFixed(1)}% • PnL neto total ${total.toFixed(2)}% • Media ${avg.toFixed(2)}% (fee inc.)`;
}

function exportSignalsCSV(){
  const list = filterSignals(getSignals());
  if(!list.length){ alert('No hay señales para exportar.'); return; }
  const rows = [['time_iso','type','dir','price','note']];
  for(const s of list){ rows.push([new Date(s.time*1000).toISOString(), s.type, s.dir, s.price, s.note]); }
  downloadCSV(rows, 'signals.csv');
}
function exportTradesCSV(){
  if(!trades.length){ alert('No hay trades para exportar.'); return; }
  const rows = [['entry_iso','exit_iso','type','dir','entry_price','exit_price','duration_min','pnl_gross_pct','pnl_net_pct']];
  for(const t of trades){
    rows.push([ new Date(t.entryTime*1000).toISOString(), new Date(t.exitTime*1000).toISOString(),
      t.type, t.dir, t.entryPrice, t.exitPrice, t.durationMin, t.pnlGross.toFixed(4), t.pnlNet.toFixed(4) ]);
  }
  downloadCSV(rows, 'trades.csv');
}
function downloadCSV(rows, filename){
  const csv = rows.map(r=>r.map(v=>(''+v).replace(/"/g,'""')).map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function showSignals(){ if(sigScroll) sigScroll.classList.remove('hidden'); if(trdScroll) trdScroll.classList.add('hidden'); }
function showTrades(){ if(sigScroll) sigScroll.classList.add('hidden'); if(trdScroll) trdScroll.classList.remove('hidden'); }

// Initial render
setTimeout(renderSignals, 400);
