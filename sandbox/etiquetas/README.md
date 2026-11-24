# Sandbox de etiquetas verificables · fosas 2025-2026

Estado: **sandbox, no integrado a producción**. No se entrenó ningún modelo nuevo
ni se modificó M3.

## Qué hace

Construye un panel `municipio-año` a partir de eventos con fuente y URL, y se
niega a convertirlo en datos de entrenamiento si no cumple los mínimos de
cobertura y verificación.

## Reglas de etiqueta

| Etiqueta | Significado | Requisito |
|---|---|---|
| `1` | Fosa documentada | Evento confirmado o probable, con URL y evidencia |
| `0` | Ausencia verificada | Cobertura estatal **completa** y evento de ausencia |
| `-1` | Desconocido | Sin positivos; no hay evidencia de ausencia |

Un `0` de evento con cobertura parcial se degrada a `-1` en el panel.
Un evento con `status=discarded` no cuenta.

## Comandos

```powershell
$py = "C:\Users\elmic\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"

# Demo sintética: valida el pipeline, no el modelo.
& $py sandbox\etiquetas\build_labels.py `
  --input sandbox\etiquetas\fixtures\etiquetas_demo.csv `
  --coverage sandbox\etiquetas\fixtures\cobertura_demo.csv `
  --out sandbox\etiquetas\out\demo `
  --kind synthetic

# Evaluación temporal de scores ya congelados; no reentrena.
& $py sandbox\etiquetas\build_labels.py `
  --input sandbox\etiquetas\fixtures\eventos_2026_pilot.csv `
  --coverage sandbox\etiquetas\fixtures\cobertura_2026_pilot.csv `
  --out sandbox\etiquetas\out\pilot_2026 `
  --kind real

& $py sandbox\etiquetas\positive_eval.py `
  --panel sandbox\etiquetas\out\pilot_2026\panel_municipio_anio.csv `
  --scores sandbox\etiquetas\out\pilot_2026\scores.csv `
  --out sandbox\etiquetas\out\pilot_2026\positive_evaluation.json

# Panel estatal con registro oficial documentado (Jalisco).
& $py sandbox\etiquetas\state_panel.py `
  --estado 14 --year 2026 `
  --positives sandbox\etiquetas\fixtures\eventos_2026_pilot.csv `
  --source "Registro de Sitios de Inhumación Clandestina de Jalisco" `
  --source-url "https://www.ntrguadalajara.com/post.php?id_nota=248223" `
  --out sandbox\etiquetas\out\jalisco_2026\panel.csv

& $py sandbox\etiquetas\evaluate.py `
  --panel sandbox\etiquetas\out\jalisco_2026\panel.csv `
  --scores sandbox\etiquetas\out\pilot_2026\scores_probability.csv `
  --out sandbox\etiquetas\out\jalisco_2026\evaluation_probability.json `
  --kind real
```

## Compuerta de entrenamiento

El panel sólo es `trainable=true` si:

- es `--kind real`;
- tiene al menos 100 positivos verificados;
- tiene al menos 50 negativos confirmados;
- al menos 50% de los municipio-año tienen etiqueta conocida;
- al menos 70% de las entidad-año tienen cobertura completa.

La demo sintética falla deliberadamente. Ese resultado es el correcto: **no hay
datos reales 2025-2026 suficientes para entrenar sin inventar etiquetas.**

## Resultado de la demo

- 8 municipio-año.
- 4 positivos.
- 2 negativos confirmados.
- 2 desconocidos.
- `trainable=false`.
- Razones: dataset sintético, menos de 100 positivos, menos de 50 negativos,
  cobertura completa insuficiente.

## Piloto real 2026

Se construyó un piloto con **27 municipios** y eventos 2026 documentados por prensa,
colectivos y fiscalías. Cada evento tiene URL, fecha, definición y evidencia en
[`fixtures/eventos_2026_pilot.csv`](C:/Users/elmic/OneDrive/Documents/rastro/sandbox/etiquetas/fixtures/eventos_2026_pilot.csv).

Resultado del panel:

- 27 positivos.
- 0 negativos confirmados.
- 1 entidad-año con cobertura completa (Jalisco).
- `trainable=false`.

Evaluación exploratoria de M3, sólo con positivos:

| Métrica | Resultado |
|---|---:|
| Positivos evaluados | 27 |
| En el decil superior | 19 |
| Tasa en decil superior | 70.4% |
| IC 95% | 51.5%–84.2% |
| Enriquecimiento vs azar | 7.04× |
| Prioridad media de positivos | 90.1 |
| Prioridad media nacional | 50.0 |
| Bandas A / B / C | 19 / 7 / 1 |
| AUC caso-control descriptivo | 0.905 |
| Permutación estratificada por entidad | **p = 0.0002**; nulo 9.17/27 en decil superior |

La permutación compara los 27 positivos contra municipios aleatorios **de su misma entidad**. El nulo coloca 9.17 de 27 en el decil superior; M3 coloca 19. Eso reduce la explicación por composición estatal, aunque no elimina el sesgo de cobertura periodística.

## Panel oficial de Jalisco 2026

El Registro de Sitios de Inhumación Clandestina de Jalisco permite un panel
estatal con 125 municipios y 7 positivos documentados. Se evaluó M3 sin
reentrenar:

| Métrica | Resultado |
|---|---:|
| Municipios | 125 |
| Positivos documentados | 7 |
| Prevalencia documentada | 5.6% |
| AP | 0.668 |
| AUC | 0.966 |
| Precisión @10% | 46.2% |
| Recall @10% | 85.7% |
| Brier (probabilidad calibrada nacional) | 0.142 |
| ECE local | 0.290 |

**Hallazgo importante:** el ranking es fuerte dentro de Jalisco, pero la
probabilidad nacional está mal calibrada para una prevalencia local de 5.6%.
Un ajuste de prevalencia tipo *label shift* baja el ECE a 0.064 y el Brier a
0.034, pero usa la prevalencia observada de 2026: es un **oráculo post-hoc**, no
un método desplegable. No se puede usar para decir que el modelo ya está
calibrado en producción.

**El AUC de caso-control trata a todos los demás municipios como “no positivos”,
no como negativos verificados.** Los ceros del registro significan “sin sitio
documentado”, no ausencia física comprobada.

El resultado es **prometedor para ranking, pero no es prueba de que prediga
fosas nuevas ni de que esté bien calibrado**. Sólo hay 27 positivos, la selección
viene de prensa/colectivos y falta cobertura estatal.

Limitaciones del piloto:

- La fecha usada es la del reporte cuando el artículo no precisa la fecha exacta del hallazgo.
- No es un censo nacional: es una muestra de conveniencia de casos reportados.
- En Jalisco el registro oficial está completo para sitios documentados, no para fosas no descubiertas.
- No hay negativos confirmados en el panel nacional. Se añadieron Tijuana, Elota, Mazatlán y Miguel Alemán a la muestra de prensa/colectivos.
- Un caso puede repetirse en varios reportes; se deduplicó por municipio y evento.
- El modelo no se reentrenó ni se ajustó con estos casos.

## Panel oficial de Guanajuato 2020-2026

El Registro Estatal de Fosas de Guanajuato publica un JSON oficial de **contextos de hallazgo**:

`https://sgtipoll.guanajuato.gob.mx/cbp/contextos.json`

Con 679 registros se construyó un panel de **46 municipios × 7 años = 322 filas**, con **98 municipio-año positivos**. Los ceros significan “sin contexto documentado en el registro”, no ausencia física.

M3 sobre ese panel:

| Año | Positivos | AP | AUC | Precisión @10% | Recall @10% | ECE |
|---|---:|---:|---:|---:|---:|---:|
| 2025 | 18 | 0.818 | 0.912 | 100% | 27.8% | 0.201 |
| 2026 | 16 | 0.839 | 0.918 | 100% | 31.3% | 0.244 |

## M4: nuevo contexto documentado

Entrené un modelo nuevo en el sandbox con el objetivo correcto: **al menos un contexto nuevo documentado en el año**, no presencia acumulada.

- Entrenamiento: 2021-2023.
- Validación: 2024.
- Prueba congelada: 2025 y 2026.
- Variables: contextos en t−1, t−2, t−3 y log(población).
- Regresión logística L2; sin ajustar hiperparámetros con los años de prueba.

| Año | Modelo | AP | AUC | Precisión @10% | Recall @10% | Brier | ECE |
|---|---|---:|---:|---:|---:|---:|---:|
| 2024 | Persistencia | 0.814 | 0.790 | 100% | 26.3% | — | — |
| 2024 | **M4** | **0.871** | **0.887** | 100% | 26.3% | 0.140 | 0.089 |
| 2025 | Persistencia | 0.894 | 0.914 | 100% | 27.8% | — | — |
| 2025 | **M4** | **0.940** | **0.964** | 100% | 27.8% | 0.099 | 0.176 |
| 2026 | Persistencia | 0.787 | 0.804 | 80% | 25.0% | — | — |
| 2026 | **M4** | **0.856** | **0.910** | 100% | 31.3% | 0.123 | 0.143 |

M4 mejora el ranking de persistencia, sobre todo en 2026. La calibración es moderada: ECE 0.176 en 2025 y 0.143 en 2026. El ajuste de prevalencia con el año previo no mejoró el Brier; no se fuerza.

**Límite:** un solo estado, 46 municipios, 98 positivos. No es validación externa ni prueba nacional. Los ceros son documentales, no ausencias verificadas.

## M4 guardado

M4 queda congelado **localmente, fuera del repositorio**, con su panel, protocolo y resultados. **No está en producción.** El código, el panel y la ficha de M4 están excluidos por `.gitignore`; este documento conserva únicamente la justificación y los resultados.

## Intento de mejorar M3 con los datos de M4

Agregué los positivos oficiales 2025-2026 de Guanajuato y Jalisco a las etiquetas de M3, sin eliminar ningún positivo y sin convertir ceros en negativos:

- Etiquetas base: **788** positivos.
- Municipios oficiales 2025-2026: **33**.
- Positivos nuevos únicos: **4** (`11003`, `11005`, `11014`, `14006`).
- Total candidato: **792**.

Archivos:

- [`m3_labels_augmented.csv`](C:/Users/elmic/OneDrive/Documents/rastro/sandbox/etiquetas/out/m3_labels_augmented.csv)
- [`m3_labels_augmentation.json`](C:/Users/elmic/OneDrive/Documents/rastro/sandbox/etiquetas/out/m3_labels_augmentation.json)

**No reentrené M3 con esas cuatro etiquetas.** La ganancia sería indistinguible del ruido, y evaluar en los mismos estados introduciría fuga. El cambio queda como candidato, no como mejora publicada.

Lo que sí sería una mejora real para M3:

1. Etiquetas oficiales de más estados.
2. Un objetivo anual, como M4.
3. Calibración por estado con prevalencia histórica.
4. Validación externa congelada.

Agregar cuatro positivos a un modelo nacional no es una mejora significativa; sería cosmética.

## Cobertura oficial disponible

Sólo encontré dos registros estatales con datos municipio-año utilizables:

- **Jalisco**: Registro de Sitios de Inhumación Clandestina, 2025 y 2026.
- **Guanajuato**: Registro Estatal de Fosas, contextos 2020-2026 en JSON.

Los demás estados revisados publican notas, conteos estatales o reportes PDF sin tabla municipal-año completa. Por eso no se puede cumplir todavía la meta de 3-5 estados sin una solicitud de transparencia o una base institucional.

## Resultado general

| Evidencia | Resultado | Lectura |
|---|---|---|
| 27 positivos 2026, muestra nacional | 70.4% en decil superior; p=0.0002 | Ranking temporal fuerte, muestra de conveniencia |
| Jalisco 2025 | AUC 0.893; recall 60% | Ranking intraestatal fuerte |
| Jalisco 2026 | AUC 0.966; recall 85.7% | Ranking intraestatal muy fuerte |
| Calibración Jalisco | ECE 0.29 | Probabilidad nacional no calibrada localmente |
| Guanajuato 2025-2026 | AUC 0.912 / 0.918 | Ranking fuerte |
| M4 Guanajuato 2025-2026 | AP 0.940 / 0.856 | Mejor que persistencia, un estado |
| Cobertura multiestatal | 2 estados | Insuficiente para prueba nacional |

**No hay prueba de que prediga fosas nuevas.** Hay evidencia consistente de ranking temporal en dos estados y un M4 que mejora la persistencia en uno. La calibración local sigue siendo el problema principal.

## Qué falta para integrarlo

1. Elegir 2-3 estados piloto con registros oficiales 2025-2026.
2. Capturar eventos con URL/PDF, fecha, definición y revisor.
3. Declarar cobertura estatal con fuente.
4. Congelar el panel como prueba temporal.
5. Evaluar M3 sin reentrenar.
6. Sólo si la compuerta pasa y la evaluación es estable, integrar.

