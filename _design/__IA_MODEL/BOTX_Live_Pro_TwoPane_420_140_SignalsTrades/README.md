# BOTX — Live Pro (Extended)

App estática con:
- **Gráfico** LightweightCharts (REST + WS opcional).
- **Simuladores** DCA y Grid.
- **Arbitraje triangular** usando **bookTicker (bid/ask)** + fee efectivo (con descuento por staking) + slippage por salto.
- **Staking BOTX** con niveles (Bronce/Plata/Oro) que afectan al fee.
- **Ajustes** para fee base.

## Uso
1) Sirve la carpeta con un server simple (por CORS):
   - `python -m http.server 8080` y abre http://localhost:8080/
   - o `npx http-server .`
2) En Trading: elige par/intervalo → **Actualizar** → (opcional) **En vivo ON**.
3) En Simuladores: DCA/Grid funcionan sobre los datos del gráfico.
4) En Arbitraje: **Iniciar escáner** (cada 3s). Usa `ticker/bookTicker` (bid/ask).

## Notas
- Es educativo; no ejecuta órdenes reales.
- El descuento por staking reduce el **fee efectivo** empleado en los cálculos.
- Para arbitraje profesional deberías usar `/depth` (order book completo) y latencia baja.
