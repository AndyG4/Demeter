# Model card · Demeter M3

## Identificación

| Campo | Valor |
|---|---|
| Nombre | Demeter · prioridad municipal de búsqueda |
| Versión | 0.1.0 |
| Fecha | 2026-11-18 |
| Tipo | Ordenamiento territorial (ranking), no clasificación individual |
| Modelo publicado | **M3 · Persistencia + historia municipal** |
| Modelos comparados | M0 Persistencia, M1 KDE, M2 Random Forest |
| Autor | Proyecto Demeter |

## Uso previsto

- Ordenar municipios para priorizar solicitudes de información, brigadas y revisión de casos.
- Visualizar patrones históricos de fosas documentadas.
- Servir como base discutible para periodismo, investigación y política pública.

### Usuarios previstos

Equipos de búsqueda, organizaciones de derechos humanos, periodistas de datos, investigadores y autoridades con capacidad de verificar en campo.

### Fuera de alcance

- Localizar una fosa concreta.
- Estimar el número de fosas o cuerpos.
- Determinar si una persona está viva o muerta.
- Inferir autoría, motivo, grupo criminal o relación con la víctima.
- Sustituir una denuncia, una búsqueda oficial o un dictamen forense.
- Evaluar personas individuales.

## Datos de entrenamiento

- 2,469 municipios de México.
- 788 municipios con presencia documentada de fosas (2006-2024).
- 1,957 fosas agregadas por entidad y año (2006-2016).
- Historia municipal agregada de desapariciones 2015-2024, a partir de registros públicos anonimizados. **2025-2026 no se usa para entrenar ni para elegir hiperparámetros.**
- Población aproximada de GeoNames; límites INEGI.
- Etiqueta municipal de la Plataforma Ciudadana de Fosas, sin licencia explícita; uso de demostración, autorización pendiente para producción.

## Variables

M3 conserva las nueve variables de M2 y añade cuatro: desapariciones municipales 2015-2024 (log), tasa municipal de desapariciones por 100 mil, desapariciones estatales 2015-2024 (log) y tasa estatal de desapariciones por 100 mil.

## Evaluación

Validación espacial de 8 folds: 28 entidades para entrenar, 4 para probar en cada fold.

| Modelo | AUC | AP | Precisión @10% | Lift @10% | Brier |
|---|---:|---:|---:|---:|---:|
| M0 Persistencia | 0.823 | 0.749 | 84.9% | 2.52× | — |
| M1 KDE | 0.562 | 0.457 | 49.4% | 1.39× | — |
| M2 Random Forest | 0.816 | 0.745 | 85.9% | 2.62× | 0.167 |
| **M3 Persistencia + historia** (publicado) | **0.858** | **0.804** | **92.5%** | **2.82×** | **0.130** |

Prevalencia: 31.9%. La regla exige superar el AP del mejor baseline en 5% relativo; M3 lo supera en 7.3%. Es un Random Forest regularizado (profundidad 5, hoja mínima 60, 160 árboles), sin ajuste de hiperparámetros sobre el conjunto de prueba.

Las probabilidades de M3 pasan por una **calibración isotónica ajustada con predicciones out-of-fold**. El ranking no cambia; el Brier baja de 0.149 a **0.130** y reduce la sobreconfianza en deciles bajos.

**Límite de etiqueta:** `presencia_municipal.csv` usa `0` para “sin presencia documentada”, no para “ausencia confirmada”. El modelo de Ibero/HRDAG distinguía `1` (fosa reportada), `0` (ausencia contextual verificada) y `-1` (desconocido). Nuestros ceros son, en su mayoría, **desconocidos**, no negativos confirmados. La calibración corrige la escala, no convierte la ausencia de registro en ausencia de fosa.

### Diagnóstico de sobreajuste

- Ablación contra M2 con la misma regularización y 9 variables: AP 0.731 vs **0.790** para M3; diferencia +0.059, IC 95% 0.043–0.075; M3 gana en 100% de los folds.
- Brecha in-sample/out-of-sample: M3 0.831 vs 0.790 (**0.041**); M2-reg 0.794 vs 0.731 (0.063). M3 no tiene una brecha mayor.
- Permutación de la historia municipal (19 permutaciones): AP real 0.804 vs 0.736 permutado; **p = 0.05**.
- Calibración: ECE 0.056; en el decil superior, predicho 0.917 vs observado 0.948. En deciles bajos hay sobreconfianza.
- **Límite:** no hay prueba temporal 2025-2026; las variables son contemporáneas a la etiqueta acumulada. M3 es un ranking documental, no un pronóstico prospectivo.

Backtest estatal 2015-2016 (13 entidades): MAE 11.705, RMSE 23.876, Spearman 0.740. `n=26`. No es validación municipal.

## Limitaciones

- Sin año por municipio; no hay validación temporal municipal.
- La validación de M3 sigue siendo espacial, no prospectiva. 2025-2026 se reservó, pero no existe un panel municipal completo para convertirlo en prueba temporal.
- La historia de desapariciones 2015-2024 es contemporánea a la etiqueta de presencia 2006-2024; M3 ordena mejor el universo documentado, pero no debe leerse como pronóstico causal.
- Sesgo de reporte y de búsqueda: el registro mide lo que se documenta, no necesariamente lo que ocurre.
- 38.5% de los registros del RNPDNO están confidencializados.
- La serie de fosas termina en 2016.
- 20 municipios usan centroide estatal por falta de coordenada.
- Sin validación prospectiva ni test ciego.
- La etiqueta municipal no tiene licencia explícita.
- La población es aproximada; no es censo.

## Consideraciones éticas

- La prioridad es una hipótesis de trabajo, no una acusación.
- No usar para estigmatizar municipios ni para justificar violencia estatal.
- No usar para inferir motivos o autoría.
- Comunicar bandas A/B/C, no porcentajes de certeza.
- Toda acción debe coordinarse con familias, autoridades y organizaciones locales.
- Mantener un canal de corrección y eliminación de registros.

## Mantenimiento

- Reentrenar sólo con una versión de datos autorizada y documentada.
- Registrar versión, corte, fuente y métricas.
- Revisar deriva y calibración cada actualización.
- Repetir la validación espacial; no comparar contra métricas de otra versión sin fijar el corte.
- Auditoría externa antes de un despliegue público con datos reales.

## Contacto

El repositorio no incluye datos reales de personas. Para acceso institucional o correcciones, usar el canal definido por la organización que despliegue esta instancia.



