# Modelos de priorización

## 1. Qué se modela

**Objetivo:** presencia documentada de fosas clandestinas por municipio (2006-2024).

**Unidad:** municipio (2,469).

**Etiqueta:** `1` si el municipio aparece al menos una vez en el registro público de fosas usado; `0` si no. No hay conteo ni año por municipio en la fuente abierta.

**Salida:** un índice de prioridad 0-100, una banda A/B/C y una estimación de **fosas esperadas** por municipio y entidad. No es una probabilidad de encontrar restos ni una coordenada.

### Lo que el modelo no hace

- No predice la ubicación exacta de una fosa.
- No estima cuántas fosas hay.
- No infiere autoría, motivo, grupo criminal ni relación con la víctima.
- No distingue desaparición forzada, feminicidio o desaparición por pareja.
- No sustituye una brigada de búsqueda ni una investigación ministerial.

### Revisión del modelo de Ibero/HRDAG

El antecedente directo es el modelo de HRDAG, Data Cívica y el Programa de Derechos Humanos de la Ibero. Su procedimiento:

- Etiquetas de tres valores: `1` fosa reportada, `0` ausencia contextual verificada en 100 municipios, `-1` desconocido.
- Random forest entrenado con la mitad de las observaciones y probado con la otra mitad.
- Mil iteraciones por año; se reporta el valor predictivo positivo.
- Predice municipios sin registro donde podría haber fosas no documentadas.
- Fuentes: prensa sistematizada por la Ibero y, después, datos de fiscalías.

**Fortalezas:** distingue explícitamente lo desconocido; no obliga a los municipios sin registro a ser negativos; busca casos no observados.

**Debilidades:** la partición es aleatoria, no espacial ni temporal; el `0` sólo existe para 100 municipios, así que el modelo aprende con negativos muy seleccionados; reporta PPV sin curvas de calibración ni intervalos; la prensa y las fiscalías tienen sesgo de cobertura; el municipio es demasiado grande para localizar una fosa.

**Diferencia con Demeter:** nuestra validación es espacial y repetida, y M3 tiene ablación y calibración. Nuestra debilidad es la etiqueta: usamos `0` para “sin presencia documentada”, no para “ausencia confirmada”. Por eso la probabilidad de M3 debe leerse como **probabilidad de presencia documentada**, no de existencia real de una fosa.

Referencias: [HRDAG México](https://hrdag.org/mexico/), [resultados 2017](https://hrdag.org/2017/11/23/new-clandestine-graves-mexico/), [Ibero](https://prensa.ibero.mx/es-MX/nota/las-fosas-clandestinas-siguen-patrones-ibero-presenta-en-foro-de-amnistia-internacional-metodo-para-predecir-posibles-ubicaciones).

## 2. Datos

| Capa | Filas | Uso |
|---|---:|---|
| Municipios | 2,469 | Unidad de análisis |
| Presencia documentada | 788 positivos (31.9%) | Etiqueta |
| Fosas entidad-año | 145 | Baseline, KDE y backtest |
| Fosas totales 2006-2016 | 1,957 | Intensidad histórica |

Fuentes y licencias: [`DATOS.md`](DATOS.md). La etiqueta municipal proviene de una API sin licencia explícita; para producción se requiere autorización.

## 3. Variables

| Variable | Tipo | Justificación |
|---|---|---|
| `log_poblacion` | continua | Más población, más reportes y más búsqueda |
| `latitud`, `longitud` | continuas | Patrón regional |
| `fosas_entidad_log` | continua | Intensidad histórica de la entidad |
| `tasa_fosas_100k` | continua | Normaliza por población |
| `distancia_centro_entidad_km` | continua | Centralidad/periferia |
| `distancia_frontera_km` | continua | Corredores y dinámica fronteriza |
| `municipios_entidad_log` | continua | Fragmentación administrativa |
| `poblacion_entidad_log` | continua | Escala estatal |

No se usan variables de origen étnico, religión, nivel socioeconómico individual ni cualquier dato personal. No se usan nombres de personas.

## 4. Modelos comparados

### M0 · Persistencia histórica

```
score = tasa_fosas_entidad(2006-2016) × población_municipal / 100,000
```

Es el rival obligatorio: si un modelo complejo no lo supera, no se publica. No requiere entrenamiento y es transparente.

La **fosa esperada** que muestra el mapa se calcula con esta misma tasa:

```
fosas_esperadas_municipio = tasa_fosas_entidad(2006-2016) × población_municipal / 100,000
```

Es un conteo modelado a partir de la intensidad histórica estatal, **no un conteo observado** ni una fosa localizada. La prioridad 0-100 sigue siendo un percentil relativo entre municipios.

### M1 · KDE espacial

Para cada municipio:

```
densidad = Σ_entidades fosas_entidad × exp(-0.5 × (distancia / 120 km)²)
```

Se normaliza por el máximo. No produce probabilidad; produce densidad relativa.

### M2 · Random Forest

- 180 árboles, profundidad máxima 12, hoja mínima 4.
- Cortes histogramáticos de 16 bins por variable (aproximación eficiente de CART).
- Submuestreo de variables por nodo (`sqrt(9) ≈ 3`).
- Probabilidad con suavizado de Laplace en hojas.
- Semilla fija `20261118`.
- Validación: 80 árboles, profundidad 10, hoja 5.

### Clustering

- K-means (k=5) sobre población, latitud, longitud, tasa histórica y distancia a la frontera, estandarizados.
- Grafo kNN (k=6) sobre centroides; componentes conexas mutuas como comunidades geográficas.
- Los perfiles se usan para estratificar y comunicar, no para explicar causalidad.

## 5. Validación

### 5.1 Esquema espacial

8 folds por entidad. En cada fold se dejan fuera 4 entidades completas; se entrena con las otras 28 y se prueba en las 4. Esto evita fuga espacial: un municipio de una entidad no aparece en train y test a la vez.

No se usa validación aleatoria: con autocorrelación espacial, una partición aleatoria sobreestima el desempeño.

### 5.2 Resultados (ejecución de referencia)

| Modelo | AUC | AP | Precisión @10% | Lift @10% | Brier |
|---|---:|---:|---:|---:|---:|
| M0 · Persistencia | 0.823 | 0.749 | 84.9% | 2.52× | — |
| M1 · KDE | 0.562 | 0.457 | 49.4% | 1.39× | — |
| M2 · Random Forest | 0.816 | 0.745 | 85.9% | 2.62× | 0.167 |
| **M3 · Persistencia + historia municipal** | **0.858** | **0.804** | **92.5%** | **2.82×** | **0.130** |

Prevalencia: 31.9%.

**Lectura:** M2 no superó a M0. M3 sí: +7.3% relativo de AP frente a M0, con mejor AUC, precisión, lift y Brier. M3 es un Random Forest regularizado (profundidad 5, hoja mínima 60, 160 árboles) que añade cuatro variables de historia municipal/estatal de desapariciones **2015-2024**. El hiperparámetro no se ajustó contra el conjunto de prueba.

**Límite:** la validación sigue siendo espacial, no prospectiva. Los datos de 2025-2026 se dejaron fuera del entrenamiento y de la selección, pero no existe aún un panel municipal completo para evaluar M3 contra ese periodo. M3 ordena mejor el universo documentado; no demuestra causalidad ni capacidad de pronóstico futuro.

### 5.3 Resultados por fold (M2)

| Fold | Municipios | Positivos | AUC | AP | P@10% | Lift |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 439 | 162 | 0.76 | 0.68 | 84% | 2.3× |
| 2 | 284 | 71 | 0.85 | 0.72 | 83% | 3.3× |
| 3 | 171 | 82 | 0.83 | 0.83 | 89% | 1.9× |
| 4 | 702 | 123 | 0.90 | 0.74 | 85% | 4.8× |
| 5 | 263 | 86 | 0.77 | 0.67 | 93% | 2.8× |
| 6 | 172 | 101 | 0.81 | 0.88 | 100% | 1.7× |
| 7 | 165 | 63 | 0.81 | 0.71 | 65% | 1.7× |
| 8 | 273 | 100 | 0.80 | 0.72 | 89% | 2.4× |

La dispersión importa: el fold 7 baja a 65% de precisión y el fold 6 llega a 100%. Publicar sólo el promedio sería engañoso.

### 5.4 Importancia de variables (M2)

| Variable | Importancia |
|---|---:|
| Población municipal (log) | 35.1% |
| Longitud | 11.3% |
| Distancia a la frontera norte | 9.7% |
| Latitud | 9.5% |
| Distancia al centro de la entidad | 9.3% |
| Tasa de fosas por 100 mil | 8.1% |
| Municipios de la entidad (log) | 7.1% |
| Fosas históricas de la entidad | 6.9% |
| Población de la entidad (log) | 3.1% |

La población domina. Es una señal de **exposición y de reporte**, no de causalidad.

### 5.5 Importancia de variables (M3)

| Variable | Importancia |
|---|---:|
| Desapariciones municipales 2015-2024 (log) | 45.6% |
| Población municipal (log) | 18.7% |
| Tasa estatal de desapariciones por 100 mil | 6.5% |
| Municipios de la entidad (log) | 5.8% |
| Tasa de fosas por 100 mil | 5.5% |
| Fosas históricas de la entidad | 4.8% |
| Desapariciones estatales 2015-2024 (log) | 4.0% |
| Latitud | 2.1% |

La historia municipal de desapariciones domina. Puede reflejar tanto exposición como intensidad de reporte; por eso M3 se presenta como **ordenamiento documental**, no como pronóstico causal.

### 5.6 Diagnóstico de sobreajuste (M3)

Para separar el efecto de las variables del efecto de la regularización se repitieron **3 validaciones espaciales completas (8 folds cada una)** y se comparó M3 contra un bosque con **la misma regularización y sólo las 9 variables originales** (M2-reg).

| Prueba | Resultado |
|---|---:|
| AP M2-reg, 9 variables | 0.731 |
| AP M3, 13 variables | 0.790 |
| Diferencia AP (M3 − M2-reg) | **+0.059** |
| IC 95% de la diferencia | **0.043 a 0.075** |
| Folds donde M3 gana | **100%** |
| AP in-sample M3 | 0.831 |
| Brecha in-sample vs out-of-sample M3 | **0.041** |
| Brecha in-sample vs out-of-sample M2-reg | 0.063 |
| Brier M3 sin calibrar | 0.149 |
| Brier M3 calibrado out-of-fold | **0.130** |
| Brier M2-reg | 0.173 |
| ECE de calibración M3 sin calibrar | 0.056 |
| Permutación de historia municipal (19 permutaciones) | AP real **0.804** vs permutada **0.736**, **p = 0.05** |

**Lectura:** la mejora no viene sólo de regularizar; viene de la historia municipal. La brecha entre entrenamiento y validación es menor que la de M2-reg, y al barajar la historia municipal el AP cae. No hay evidencia de sobreajuste severo.

**Lo que sigue faltando:** una prueba temporal. Las variables son 2015-2024 y la etiqueta es presencia acumulada 2006-2024; el modelo ordena mejor el universo documentado, pero no demuestra que prediga fosas futuras. La calibración isotónica reduce la sobreconfianza (Brier 0.149 → 0.130), pero no convierte los ceros no documentados en negativos confirmados: el modelo de Ibero/HRDAG usaba `-1` para desconocido y sólo 100 municipios con `0` contextual.

### 5.7 Backtest temporal estatal

Con las 13 entidades que tienen serie completa 2012-2016:

- Predicción 2015 = media 2012-2014.
- Predicción 2016 = media 2013-2015.
- Resultados: MAE 11.705 fosas, RMSE 23.876, Spearman 0.740.
- `n = 26` predicciones. Es un ejercicio pequeño y estatal; **no sustituye** una validación municipal ni prospectiva.

No se reporta una validación 2025-2026 porque no existe una fuente abierta municipal-año comparable. Inventar esa métrica sería peor que declarar su ausencia.

## 6. Selección y uso

- La prioridad se calcula con el modelo seleccionado y se convierte a percentil (0-100).
- Banda A: top 10%; B: siguiente 20%; C: resto.
- La probabilidad del Random Forest seleccionado se conserva en el campo `probabilidadRf` para auditoría.
- La prioridad sirve para **ordenar brigadas y solicitudes de información**, no para acusar a un municipio.
- Toda decisión operativa requiere revisión humana, contraste con fuentes locales y coordinación con autoridades.

## 7. Reproducibilidad

```bash
mvn -o test
mvn -o -DskipTests package
java -jar target/demeter.jar
curl -s http://localhost:8080/api/v1/models | jq
```

- Semilla fija en `PredictionService.SEED`.
- Datos versionados en `src/main/resources/data`.
- Reporte completo en `/api/v1/models` (JSON).
- El entrenamiento se ejecuta al iniciar; tarda ~4-6 s en la máquina de referencia.

## 8. Limitaciones

1. **Sin año municipal.** La etiqueta es binaria y acumulada; no se puede validar temporalmente a nivel municipal.
2. **Sesgo de reporte.** Un municipio con más prensa o fiscalía activa parece más riesgoso.
3. **Confidencialización.** 36.7% de los registros del dataset abierto están confidencializados.
4. **Fuga estatal.** El baseline usa el total estatal, que incluye los municipios de prueba; la validación espacial reduce pero no elimina la dependencia.
5. **Serie de fosas termina en 2016.** La capa actual es una extrapolación de persistencia, no una predicción 2026.
6. **Coordenadas aproximadas.** 20 municipios usan centroide estatal por falta de dato municipal.
7. **Sin validación prospectiva.** No hay un test ciego a futuro.
8. **Etiqueta sin licencia.** La presencia municipal debe autorizarse para producción.
9. **No hay contrafactual.** No se puede saber qué habría pasado sin búsqueda.
10. **Riesgo de estigmatización.** Un mapa de prioridad puede reforzar narrativas sobre territorios.

### Por qué no se predice la causa

El dataset abierto no contiene una variable causal confiable ni un identificador de perpetrador. La causa de una desaparición —desaparición forzada, privación por particulares, secuestro, trata, feminicidio, ausencia voluntaria— es una calificación jurídica y contextual, no un atributo que se pueda inferir de municipio, sexo, edad y fecha. Un clasificador de causa entrenado con datos incompletos produciría acusaciones falsas y estigmatizaría personas y territorios. Demeter no lo implementa.

Si una institución entrega una base autorizada con una variable de causa **declarada y revisada**, se puede hacer un análisis descriptivo de esa variable, nunca una predicción individual.

## 9. Qué haría falta para mejorar

- Convenio con fiscalías o CNB para conteos municipal-año y puntos de hallazgo.
- Validación prospectiva con un año completo reservado y pre-registro de métricas.
- Validación por bloques espaciales y temporales, no sólo por entidad.
- Calibración isotónica o Platt y reporte de intervalos.
- Variables de accesibilidad (tiempo de viaje a caminos urbanos), que la evidencia mexicana señala como más discriminantes que la visibilidad.
- Auditoría externa y participación de colectivos de familias en el diseño de la comunicación.
- Modelo jerárquico bayesiano (LGCP/INLA) cuando haya datos suficientes.

## 10. Referencias

- Investigación completa: [`investigacion/MODELOS_ML.md`](investigacion/MODELOS_ML.md).
- Ruiz Reyes & Franco (2023), Citizen Evidence Lab, sobre localización de fosas y el único test prospectivo documentado.
- Silván-Cárdenas et al. (2024), *Forensic Science International* 361:112114, accesibilidad y visibilidad en 10 estados.
- Data Cívica, *A quienes nos faltan*, 5.ª ed., sobre inestabilidad del RNPDNO.
- Wheeler & Steenbeek (2021), sobre Random Forest frente a conteos históricos en criminología espacial.
- Documentación de la Plataforma Ciudadana de Fosas, nota metodológica 2024-2025.

## 11. Model card

Versión resumida para despliegue: [`modelos/MODEL_CARD.md`](modelos/MODEL_CARD.md).


