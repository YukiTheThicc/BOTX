// App wiring
import { store, getEffectiveFeePerTrade } from './utils.js';
import { loadKlines, getLastClose, getCandles, startLive, stopLive, onPrice } from './chart.js';
import './arbitrage.js';
import './staking.js';
import './signals.js';

// Tabs
const tabs = document.querySelectorAll('.tab');
const panes = document.querySelectorAll('.tab-pane');
tabs.forEach(btn=> btn.addEventListener('click', ()=>{
  tabs.forEach(b=>b.classList.remove('active'));
  panes.forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).classList.add('active');
}));

// Trading controls
const symbolSel = document.getElementById('symbolSelect');
const intervalSel = document.getElementById('intervalSelect');
const lastPriceEl = document.getElementById('lastPrice');

async function refreshChart(){
  try{
    const { lastClose } = await loadKlines(symbolSel.value, intervalSel.value);
    lastPriceEl.textContent = lastClose ? Intl.NumberFormat('es-ES').format(lastClose) : '—';
  }catch(e){
    lastPriceEl.textContent = 'Error';
    console.error(e);
    alert('Error cargando datos (CORS o red).');
  }
}
document.getElementById('refreshChart').addEventListener('click', async ()=>{
  if(liveOn){ await refreshChart(); startWS(); } else { await refreshChart(); }
});
onPrice((p)=>{ if(!p) return; lastPriceEl.textContent = Intl.NumberFormat('es-ES').format(p); });

// Auto first load
refreshChart();

// DCA
document.getElementById('runDCA').addEventListener('click', ()=>{
  const amount = Math.max(1, Number(document.getElementById('dcaAmount').value)||50);
  const every  = Math.max(1, Number(document.getElementById('dcaEvery').value)||5);
  const kl = getCandles(); if(kl.length===0){ alert('Sin datos. Pulsa "Actualizar".'); return; }
  let spent=0, qty=0;
  for(let i=0;i<kl.length;i+=every){ const price = kl[i].close; qty += amount/price; spent += amount; }
  const avg=spent/qty, curr=(kl.at(-1)?.close||0)*qty, pnl=curr-spent, pnlPct=spent?(pnl/spent*100):0;
  document.getElementById('dcaResult').innerHTML = `Invertido: ${spent.toFixed(2)} — Qty: ${qty.toFixed(6)} — Precio medio: ${avg.toFixed(6)}<br>Valor actual: ${curr.toFixed(2)} — PnL: ${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`;
});

// Grid
document.getElementById('runGrid').addEventListener('click', ()=>{
  const levels = Math.max(2, Number(document.getElementById('gridLevels').value)||6);
  const range  = Math.max(1, Number(document.getElementById('gridRange').value)||8);
  const kl = getCandles(); if(kl.length===0){ alert('Sin datos. Pulsa "Actualizar".'); return; }
  const last = kl.at(-1).close, half = range/200, min = last*(1-half), max = last*(1+half);
  const step = (max-min)/(levels-1), lvls = Array.from({length:levels},(_,i)=>min+i*step);
  let fills=0; for(const k of kl.slice(-200)){ for(const L of lvls){ if(k.low<=L && k.high>=L){ fills++; break; } } }
  const estPnl = fills*step*0.1;
  document.getElementById('gridResult').innerHTML = `Niveles: ${lvls.map(x=>x.toFixed(6)).join(' | ')}<br>Fills estimados (últimas 200 velas): ${fills} — PnL estimado: ${estPnl.toFixed(6)}`;
});

// Ajustes
const baseFeeInput = document.getElementById('baseFee');
document.getElementById('saveSettings').addEventListener('click', ()=>{
  const v = Math.max(0, Number(baseFeeInput.value)||0.10); store.set('botx_baseFee', v);
  alert('Fee guardado. Fee efectivo (con descuento): ' + (getEffectiveFeePerTrade()*100).toFixed(3) + '%');
});
baseFeeInput.value = store.get('botx_baseFee', 0.10);

// Login/Wallet stubs
document.getElementById('loginBtn').addEventListener('click', ()=> alert('Login local (demo).'));
document.getElementById('connectWalletBtn').addEventListener('click', ()=> alert('Conectar wallet (demo).'));

// Live WS
const toggleLiveBtn = document.getElementById('toggleLive'), liveStatus = document.getElementById('liveStatus');
let liveOn=false;
function setLiveUI(state,text){ liveOn=state; toggleLiveBtn.textContent='En vivo: '+(liveOn?'ON':'OFF'); liveStatus.textContent='WS: '+text; }
function startWS(){ setLiveUI(true,'conectando...'); startLive(symbolSel.value, intervalSel.value, (ev)=>{
  if(ev==='open') setLiveUI(true,'conectado'); else if(ev==='close') setLiveUI(false,'desconectado'); else if(ev==='error') setLiveUI(false,'error');
});}
function stopWS(){ stopLive(); setLiveUI(false,'desconectado'); }
symbolSel.addEventListener('change', async ()=>{ await refreshChart(); if(liveOn) startWS(); });
intervalSel.addEventListener('change', async ()=>{ await refreshChart(); if(liveOn) startWS(); });
toggleLiveBtn.addEventListener('click', ()=>{ if(liveOn) stopWS(); else startWS(); });

// Density only
const densitySel = document.getElementById('density');
document.body.classList.add(localStorage.getItem('botx_density')||'normal');
densitySel.addEventListener('change', ()=>{ document.body.classList.remove('compact','normal','comfy'); document.body.classList.add(densitySel.value); localStorage.setItem('botx_density', densitySel.value); });
