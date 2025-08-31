// Utils & prefs
export const API = { binance: 'https://api.binance.com' };

export const store = {
  get(k, fb=null){ try{return JSON.parse(localStorage.getItem(k)??'null')??fb;}catch{return fb;} },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

export function fmt(n, d=4){
  if(n===undefined||n===null||Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('es-ES', { maximumFractionDigits:d });
}

export function nowTime(){ return new Date().toLocaleTimeString(); }

export function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

export function getStakingDiscount(){
  const stake = Number(store.get('botx_stake', 0));
  if(stake >= 10000) return 0.50;
  if(stake >= 1000) return 0.25;
  if(stake >= 100) return 0.10;
  return 0.0;
}

export function getBaseFee(){ return clamp(Number(store.get('botx_baseFee', 0.10)), 0, 1); }

export function getEffectiveFeePerTrade(){
  const base = getBaseFee()/100;
  const disc = getStakingDiscount();
  return Math.max(0, base*(1-disc));
}
