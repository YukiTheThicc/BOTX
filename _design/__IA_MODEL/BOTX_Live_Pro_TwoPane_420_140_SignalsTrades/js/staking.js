// Staking BOTX simple
import { store } from './utils.js';
const stakeInput = document.getElementById('stakeInput');
const infoBox = document.getElementById('stakeInfo');
function render(){
  const stake = Number(store.get('botx_stake', 0));
  stakeInput.value = stake;
  let level='Sin nivel', disc=0;
  if(stake>=10000){ level='🥇 Oro'; disc=50; }
  else if(stake>=1000){ level='🥈 Plata'; disc=25; }
  else if(stake>=100){ level='🥉 Bronce'; disc=10; }
  infoBox.textContent = `Stake actual: ${stake} BOTX — Nivel: ${level} — Descuento: ${disc}%`;
}
document.getElementById('saveStake').addEventListener('click', ()=>{
  const v = Math.max(0, Math.floor(Number(stakeInput.value)||0));
  store.set('botx_stake', v); render();
});
render();
