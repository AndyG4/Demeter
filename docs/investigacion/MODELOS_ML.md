# Modelos de priorización espacial para búsqueda de fosas clandestinas — Informe técnico

**Proyecto:** Demeter (mapa de desapariciones en México y priorización de búsqueda)
**Documento:** revisión metodológica y diseño recomendado · **Versión:** 1.0 · **Corte de fuentes:** noviembre 2026
**Naturaleza:** informe técnico, no código de producción. Las cifras oficiales citadas son las publicadas a la fecha de corte y **cambian entre versiones del registro** (ver §5).

---

## 0. Resumen ejecutivo

1. El problema es **predicción de eventos raros, agregados y con etiquetas incompletas**: la mayoría de los municipios no tienen fosas *reportadas*, no necesariamente cero fosas. Tratar "sin reporte" como "sin fosa" es el error de diseño más grave y el más común.
2. La literatura y la práctica mexicana coinciden en un **embudo de tres capas**: (a) baseline histórico/persistencia, (b) superficie de intensidad (KDE o LGCP), (c) modelo con covariables (RF/GBM) o reglas de idoneidad territorial. El baseline es difícil de vencer: en crimen, el RF supera a KDE y a Risk Terrain Models, pero **sólo marginalmente supera el conteo histórico previo** [6].
3. La evidencia mexicana más avanzada es de **grano fino, no municipal**: el modelo de Baja California (Data Cívica, PDH-Ibero, CentroGeo, Elementa) trabaja con coordenadas de fosas, no con conteos por municipio [21][22][23].
4. La validación honesta es **temporal y espacial por bloques simultáneamente**; la validación aleatoria infla el desempeño por autocorrelación espacial, con sobreestimación documentada de hasta ~2× en R² [13][14].
5. Ningún modelo de este tipo puede sostener afirmaciones sobre **motivación, autoría o pertenencia criminal** de un municipio. Esa restricción no es de prudencia comunicativa: es de identificabilidad estadística (§9).

---

## 1. Modelos candidatos: ventajas, supuestos, costo y datos mínimos

| Modelo | Supuesto clave / qué estima | Datos mínimos | Complejidad | Mejor cuando… | Peor cuando… |
|---|---|---|---|---|---|
| **KDE** (kernel density) | La intensidad es una suma suavizada de eventos pasados; no es un modelo probabilístico generativo | ≥30–50 puntos georreferenciados; proyección métrica; ancho de banda elegido (validación por verosimilitud, Scott/Silverman o K de Ripley) | Baja (horas) | Hotspotting descriptivo, comunicación, capa base de un embudo; es el estándar benchmark en crimen [1][3] | Se necesita incertidumbre calibrada, covariables o extrapolar a zonas sin eventos; el ancho de banda domina el resultado |
| **Proceso de Poisson log-Gaussiano (LGCP) con INLA/SPDE** | Los conteos son Poisson con intensidad λ(s)=exp(βX + campo gaussiano); el campo latente modela clustering residual | ≥50–100 eventos; malla/SPDE bien especificada; covariables; idealmente conteos por área con exposición | Alta (días; requiere INLA, priors PC) | Se requiere **incertidumbre calibrada**, suavizado con correlación espacial explícita y covariables a la vez [4][5] | Pocos eventos (<40), o cuando no hay quién mantenga el modelo; riesgo de sobreajuste del campo latente |
| **Random Forest** | Aproxima E[y\|X] sin forma funcional; captura interacciones y no linealidad | ≥100–200 unidades etiquetadas (positivos y negativos); covariables ex-ante; validación espacial | Media (horas) | Muchas covariables, relaciones no lineales, datos tabulares municipales; es el caballo de batalla del caso mexicano [19][20] | Etiquetas incompletas (PU), eventos muy raros: colapsa a "población" y sobreajusta; no extrapola espacialmente |
| **Gradient Boosting (XGBoost/LightGBM) con pérdida Poisson/Tweedie** | Boosting secuencial sobre residuos; admite *offset* de exposición explícito | Similar a RF, ≥200 unidades; ajuste de hiperparámetros | Media-alta | Conteos con exposición desigual (población), necesidad de offset correcto y mejor calibración que RF | Igual de frágil ante etiquetas incompletas; más opaco; propenso a sobreajuste con validación mal diseñada |
| **MaxEnt (máxima entropía)** | Presencia-only: estima la distribución más uniforme consistente con las presencias y el background | ≥20–30 presencias (mejor ≥50); capas ambientales completas; background bien definido | Media | Sólo hay presencias fiables (fosas confirmadas) y el "no evento" es dudoso o no muestreado [7][8] | Si el sesgo de muestreo (accesibilidad, prensa) se confunde con idoneidad ecológica; interpretación causal |
| **Jerárquico bayesiano (BYM2, Poisson-log-normal, CAR/ICAR)** | Conteos ~ Poisson(E·θ); log θ = μ + b + h (espacial + heterogéneo); *shrinkage* hacia la media global y la de vecinos | ≥2 periodos y ≥100 áreas; estructura de vecindad; exposición | Alta | Áreas pequeñas con conteos inestables, pooling entre municipios, incertidumbre honesta, propagación de rezago de registro | Cómputo y priors delicados; dependencia de la estructura de vecindad; difícil de auditar por terceros |
| **Scan statistics (SaTScan, Kulldorff)** | Contrasta hipótesis de cluster con ventana móvil maximizando verosimilitud; valor p por Monte Carlo | Conteos por área + población (Poisson) o casos/controles (Bernoulli); coordenadas o grafo de áreas | Media | **Vigilancia**: detectar clusters emergentes, no predecir; generar alertas con significancia [9] | Múltiples pruebas → demasiadas señales; el "cluster" puede ser artefacto de datos faltantes o retrasados [10]; no da superficie de riesgo continua |
| **Autologistic / CAR binario** | P(y=1) depende de covariables y de los vecinos: modela dependencia binaria | Malla regular o grafo; ≥100 unidades; cuidado con la verosimilitud (pseudoverosimilitud) | Media-alta | Presencia/ausencia binaria con dependencia espacial fuerte y contagio plausible | La verosimilitud exacta es inviable; pseudoverosimilitud sesgada [11][12]; no es generativo del mecanismo |
| **Autologistic/ETAS auto-excitado (extra)** | Cada evento eleva la intensidad local-temporalmente (contagio, "near-repeat") | Series espacio-temporales densas (cientos) | Alta | Dinámica de contagio, ventanas cortas de reincidencia | Fosas clandestinas no son un proceso de contagio puntual: la analogía es débil y puede inducir a error |

**Notas críticas de la tabla.**
- **KDE no da probabilidad**: da densidad relativa. Presentarlo como "probabilidad de fosa" es un error de comunicación frecuente y grave.
- **SaTScan responde otra pregunta**: "¿hay un exceso significativo aquí?", no "¿dónde estará la próxima fosa?". La distinción importa: en un contexto de subregistro masivo, los clusters detectados frecuentemente reflejan **esfuerzo de búsqueda y cobertura de prensa**, no exceso real [10][27].
- **MaxEnt es la opción más honesta cuando no hay negativos**: en fosas, "municipio sin fosa reportada" no equivale a ausencia. Ese es exactamente el régimen presence-only. Su debilidad es que hereda el sesgo de accesibilidad del muestreo (se busca donde se puede llegar).
- **El caso mexicano ya validó parcialmente el enfoque territorial**: Silván-Cárdenas et al. (2024) evaluaron 30 capas en 10 estados con curvas gROC y un índice τ; el **tiempo de viaje desde calles urbanas** fue la variable más discriminante, seguida de luces nocturnas y densidad poblacional, mientras que el índice de visibilidad resultó **menos correlacionado de lo esperado** [23]. Es decir: la accesibilidad predice mejor que la ocultación.

---

## 2. Validación honesta en series espacio-temporales

### 2.1 El problema
Con autocorrelación espacial, una partición aleatoria deja vecinos en train y test: el modelo **interpola** y la métrica premia la memoria del vecindario, no la capacidad de generalizar. La literatura de ecología y criminología es concluyente: la validación por bloques es "casi universalmente más apropiada" cuando el objetivo es predecir datos o espacio de predictores nuevos [13]; y en un experimento controlado, la validación aleatoria sobreestimó R² hasta **2×**, con sesgo proporcional a la fracción de variables espaciales del modelo [14].

### 2.2 Esquema recomendado (para Demeter)
| Componente | Regla | Por qué |
|---|---|---|
| **Corte temporal** | train 2022–2023 · validación 2024 · test 2025 (test de un solo uso) | Simula el uso real: predecir el año siguiente con lo anterior |
| **Bloques espaciales** | Además del corte temporal, agrupar municipios en bloques contiguos (p. ej. por región o por comunidades Leiden) y hacer *leave-one-block-out* dentro de train | Evita fuga por vecindad; mide extrapolación a regiones no vistas |
| **Fuga de información** | Prohibido usar covariables generadas con el desenlace del mismo año o posterior: hallazgos de fosas del propio año, conteos de búsqueda, cobertura mediática contemporánea | Es la fuga más frecuente en proyectos de DDHH: el "feature" es el resultado |
| **Rezago de registro** | Fijar una *vintage* de datos y estimar la distribución de retraso (fecha de desaparición → alta en el registro); evaluar sólo sobre casos con ventana de maduración suficiente | El registro crece con el tiempo: 2025 siempre parecerá mejor de lo que era (ver §5) |
| **Reproducibilidad** | Semillas, versión de datos (fecha de descarga y hash), y código de métricas público | Permite auditoría por terceros y por colectivos |
| **Reporte** | Métricas por año (2024 y 2025 por separado), no un promedio; intervalos por *bootstrap* de bloques espaciales | Un promedio oculta años malos |

### 2.3 Métricas para conteos raros
| Métrica | Qué mide | Uso recomendado | Cuidado |
|---|---|---|---|
| **MAE / RMSE** | Error absoluto en conteos | Diagnóstico secundario | Dominado por municipios grandes; RMSE castiga desproporcionadamente los outliers |
| **Spearman ρ** | Ordenamiento (lo que importa para priorizar) | **Métrica primaria** de ranking | No dice nada de la magnitud ni de la calibración |
| **precision@k** | Fracción de los k municipios priorizados que tuvieron ≥1 evento | Primaria, con k = capacidad operativa real | Elegir k por logística de brigadas, no por conveniencia |
| **recall@k / hit rate** | Fracción de eventos capturados en el top-k | Primaria en su par (precisión–cobertura) | Sube trivialmente al aumentar k |
| **lift@k** | precision@k ÷ tasa base | **La métrica más comunicable**: "cuántas veces mejor que el azar" | Sensible a la prevalencia; reportar siempre con su IC |
| **PAI** (Prediction Accuracy Index) | % de eventos capturados ÷ % de área priorizada | Estándar en hotspotting [1][2]; útil si la unidad es área | Ignora la población expuesta |
| **AUC-PR** | Discriminación con clases muy desbalanceadas | Si se binariza "tuvo o no ≥1 evento" | Optimista si hay autocorrelación; usar con CV espacial |
| **Brier score** | Error cuadrático de probabilidades | Calibración global | Poco informativo con prevalencia ínfima; descomponer en fiabilidad/resolución |
| **Calibración (slope/intercept, PIT, cobertura IC)** | ¿Las probabilidades significan lo que dicen? | **Obligatoria** si se publican probabilidades | Cobertura nominal ≠ real con dependencia espacial |

La literatura sobre métricas con eventos raros muestra que PPV, sensibilidad y F1 se vuelven **inestables y dominadas por la elección del umbral** al 90.º/99.º percentil, y que el Brier y el AUC son las medidas más estables para comparar modelos [16]. Recomendación: reportar **siempre el par (discriminación + calibración)**; una sin la otra es engañosa.

### 2.4 Cómo reportar incertidumbre
- Intervalos por **bootstrap de bloques espaciales** (no bootstrap i.i.d.) o intervalos creíbles si el modelo es bayesiano.
- Bandas de prioridad (**A/B/C**) en la comunicación pública; los porcentajes puntuales sólo en el anexo técnico.
- Reportar explícitamente el **resultado negativo**: si el modelo no supera al baseline, eso es un hallazgo publicable y debe decirse.

---

## 3. Clustering: para estratificar, no para explicar

| Método | Uso defendible en Demeter | Riesgo |
|---|---|---|
| **KMeans** | Segmentar municipios en perfiles (urbano/rural, violencia alta/baja) para *pooling* y para reportar por estrato | Fuerza clusters esféricos y k arbitrario; sin manejo de outliers. El caso CDMX lo usó para dividir la ciudad en este/oeste [25] — descriptivo, no predictivo |
| **DBSCAN** | Agrupar **puntos de fosas** para replicar el análisis a nivel de cluster en lugar de estado; ya usado con umbral de ≥5 fosas en 14.7 km [22] | Muy sensible a eps/minPts; municipios/puntos "ruido" quedan fuera |
| **HDBSCAN** | Igual que DBSCAN pero con densidad variable; preferible en territorios heterogéneos | Más difícil de explicar a audiencias no técnicas |
| **Louvain / Leiden** | Detección de comunidades sobre el grafo de municipios (adyacencia o flujos); define **regiones funcionales** para validación por bloques y para reportar | Modularidad óptima inestable; el "cluster" es una construcción del analista, no una entidad jurídica ni criminal |
| **Mezclas / modelos de perfil latente** | Alternativa probabilística a KMeans, con incertidumbre de pertenencia | Supuestos distribucionales |

**Regla dura:** los clusters se usan para (a) definir bloques de validación, (b) agrupar unidades para estimaciones más estables, (c) segmentar la comunicación. **Nunca** para inferir motivo, autoría o adscripción criminal.

**Por qué no se puede inferir motivación de datos agregados.** Un conteo municipal de desapariciones mezcla, sin etiqueta, fenómenos con mecanismos distintos: desaparición forzada por agentes estatales, desaparición por grupos criminales, trata, reclutamiento forzado, migración no documentada, violencia de pareja y feminicidio, y ausencias voluntarias. La correlación ecológica entre "reportes de narcomenudeo" y desapariciones (r=0.95 en CDMX [25]) es **una correlación entre tasas agregadas**, exactamente el supuesto que la inferencia ecológica demuestra no identificable: la falacia ecológica consiste en atribuir al individuo (o al caso) una relación observada entre agregados. Además, ambas variables comparten determinantes (densidad, centralidad, movilidad), de modo que la correlación es compatible con confusión total.

**Riesgo de estigmatización.** Nombrar un municipio como "zona de cártel" o "municipio de feminicidas" a partir de un score: (i) traslada responsabilidad de instituciones a territorios y víctimas; (ii) puede aumentar el subregistro (menos denuncia, menos colaboración con la búsqueda); (iii) expone a colectivos y a funcionarios locales; (iv) es jurídicamente frágil. La “geografía de la sospecha” —cómo la configuración territorial del sistema prefigura a quién se vigila— está documentada como mecanismo de discriminación algorítmica [31], y los datos policiales contaminados por prácticas violatorias producen predicciones que perpetúan esas prácticas [30].

---

## 4. Grafos y autocorrelación espacial: usos defendibles

- **Moran's I global**: prueba de dependencia espacial en la tasa de desapariciones. Sirve para **justificar** el uso de modelos espaciales y para diagnosticar fuga en validación; no para localizar nada. Es muy sensible a la matriz W (contigüidad vs. k-vecinos vs. distancia) y a la definición de área.
- **LISA / Getis-Ord Gi***: identifican unidades con asociación local alta-alta. Útiles como **capa exploratoria** y para comunicar ("conglomerados de alta incidencia"), con la advertencia de comparaciones múltiples [17].
- **Centralidad en el grafo municipal** (grado, intermediación, cercanía sobre red carretera): defendible para **logística de búsqueda** —qué municipios son nodos de tránsito, dónde se concentra accesibilidad—, no para atribuir actividad criminal.
- **Difusión / contagio**: los modelos auto-excitados son potentes en crimen urbano denso, pero para fosas clandestinas el mecanismo no es "contagio por proximidad de eventos", sino **logística del perpetrador** (accesibilidad, baja visibilidad, familiaridad). Usar un modelo de contagio sería un préstamo conceptual no justificado.
- **Usos defendibles para priorizar**: (1) W para *shrinkage* espacial (municipios con conteos inestables toman fuerza de vecinos); (2) centralidad para planear rutas y tiempos de brigada; (3) comunidades Leiden como bloques de validación. **No defendible**: inferir jerarquía criminal desde centralidad.

---

## 5. Evidencia sobre desapariciones en México y límites del dato oficial

### 5.1 Magnitud (cifras en disputa, no un dato único)
| Cifra | Valor | Fuente / problema |
|---|---|---|
| Registros totales RNPDNO | **132,534** (2026) frente a 130,178 antes | Cambia entre consultas sin trazabilidad [26] |
| Con datos suficientes para buscar | **43,128** (33%) | El gobierno acota la crisis a esta cifra; ONG lo cuestionan [26] |
| Sin datos suficientes | **46,742** | Categoría administrativa, no ausencia de persona |
| Registros **confidencializados** | **38.5%** del total | Data Cívica: sólo 2% tiene datos incompletos; la mayoría está oculto, no vacío [26] |
| Cifra oculta de delitos (ENVIPE 2026) | **93.4%** de 33.8 millones de delitos en 2025 | INEGI [29] |

### 5.2 Limitaciones estructurales del registro
1. **Subregistro y sesgo de denuncia.** Con ~93% de cifra oculta [29], la ausencia de registro no es ausencia de evento. Y la denuncia depende de capacidad institucional local, de la existencia de colectivos y de la disposición de las familias: el registro mide **denuncia**, no ocurrencia.
2. **Inestabilidad del registro.** Comparaciones entre consultas 2024/2025/2026 muestran disminución de registros en al menos 20 estados; en Tabasco y Jalisco la baja coincide casi exactamente con aumento de "localizados"; la consulta 2026 contiene **1,507 registros más** de casos ocurridos hasta 2024 que la de 2025 [26]. Cualquier serie construida sin fijar la *vintage* es incomparable consigo misma.
3. **Confidencialización.** 38.5% de registros confidencializados, con más registros confidenciales que públicos entre 2021 y 2023 [26]: el denominador visible está sesgado.
4. **Registro de fosas fragmentado.** FGR reportó 18 fosas en 2024 frente a 76 en 2023; las fiscalías estatales reportaron 1,451 (2023–2024) frente a 94 de la FGR; los medios documentaron 1,006. CDMX, Querétaro y Yucatán reportaron cero fosas mientras las fuentes abiertas documentan hallazgos; BCS, Durango, Hidalgo, Morelos y Veracruz negaron la información o se declararon incompetentes [27]. La CNB retiró el mapa nacional de hallazgos de su sitio en 2024 [27]. No existe versión pública del Registro Nacional de Fosas [27][28].
5. **Cambios metodológicos 2018–2026.** La Ley General de 2017 y la creación del Sistema Nacional de Búsqueda y la CNB reordenaron competencias y definiciones; después hubo cambios en el reporte (pérdida de desglose de cuerpos/restos desde el cierre de 2023 [27]) y en la forma de contar (43,128 "con datos para buscar"). Una serie 2018–2026 cruza **al menos tres regímenes de medición**.
6. **Sesgo de fuente en los datos de fosas.** El trabajo académico y de sociedad civil se ha hecho con datos de prensa, solicitudes de transparencia y registros de fiscalías [19][21][23]; cada fuente tiene su propio sesgo de cobertura. La prensa mexicana opera bajo censura y amenazas, con más de 100 periodistas asesinados desde 2000 [20].

### 5.3 Patrones regionales (lo que sí se puede decir)
- Concentración fuerte y persistente: Sonora, Guanajuato, Colima, Jalisco y Chihuahua encabezan hallazgos reportados en medios 2023–2024 (174, 91, 86, 83, 78) [27]; los estados del sur (Quintana Roo, Yucatán) aparecen con probabilidad baja en los modelos [20].
- **Análisis de conglomerados municipales** por fosas, violencia homicida y personas desaparecidas (conteos 2012–2018) identifican municipios y conjuntos continuos que ameritan coordinación interestatal [24].
- **Clustering de puntos**: en Baja California los sitios no son aleatorios (ANN 0.42, z=-8.01; media observada 7 km vs. 16 km esperada) y las nuevas fosas se esperarían a **18–28 km** de una conocida [21]; con 160 puntos el patrón se refuerza (ANN 0.38, z=-14.92; 4.8 km vs. 12.72 km) y las distancias recomendadas por cluster van de **21 a 43 km** (mediana 30) [22].
- **Idoneidad territorial**: 144 de 160 sitios están en zonas de alta accesibilidad y baja visibilidad; ese "espacio clandestino" cubre 17.2% del territorio estatal y permite reducir el área de búsqueda ~80% [22].
- **Evidencia de impacto**: la brigada de búsqueda en BC obtuvo **dos hallazgos positivos** usando los polígonos del modelo [22]. Es la única validación externa prospectiva documentada, y es de n=2.
- **CDMX**: 3,450 desapariciones 2019–2023; hombres 62.5%, mujeres de 15–19 el grupo más vulnerable; el distrito central tiene la tasa más alta, atribuida a movilidad laboral; r=0.95 con reportes de narcomenudeo y r=-0.7 con precios de vivienda tras normalizar por movilidad [25].

### 5.4 Por qué un modelo con datos oficiales reproduce sesgos
El modelo aprende **dónde se denuncia y dónde se busca**, no dónde ocurre. Si el esfuerzo de búsqueda se concentra en municipios con fiscalía activa, prensa local y colectivos organizados, el modelo asignará mayor riesgo a esos municipios y menor a los silenciosos. Al desplegarse, refuerza el patrón (bucle de retroalimentación): se busca donde el modelo dice, se encuentra donde se busca, se confirma el modelo. Este mecanismo está documentado en predictividad policial con "datos sucios" [30] y es estructuralmente idéntico aquí.

---

## 6. Ética y comunicación de riesgo

1. **Agregados, nunca individuos.** El modelo no estima la probabilidad de que una persona sea desaparecida. Publicar scores individuales o por colonia pequeña es reidentificación y estigma.
2. **Vocabulario.** "Área prioritaria de búsqueda" / "zona con alta incidencia registrada". **Nunca** "municipio narco", "zona de cártel", "foco rojo", "tierra de nadie".
3. **Incertidumbre visible.** Banda A/B/C + "el modelo ordena dónde buscar primero, no afirma que haya una fosa". Explicar el falso positivo en el mismo lugar donde se da el ranking: "si buscamos en 50 municipios, esperamos encontrar evidencia en 12–18 de ellos".
4. **Costo del falso positivo.** Un despliegue de brigada tiene costo humano, económico y de riesgo para las familias. El umbral operativo debe elegirse por capacidad real, no por optimización de F1.
5. **Co-diseño y soberanía de datos.** Los colectivos de familias son productores de datos, no sujetos de estudio. Acordar qué se publica, a qué granularidad y con qué retraso; ofrecer derecho de réplica y mecanismo de impugnación del score.
6. **No exponer a riesgo.** Un mapa público de "dónde buscar" puede ser usado por perpetradores para mover o destruir evidencia, o por autoridades para simular búsqueda. Evaluar publicación por niveles: metodología pública, resultados de alta granularidad restringidos a contrapartes.
7. **Marco de derechos.** El informe del Grupo de Trabajo de la ONU sobre nuevas tecnologías y desapariciones forzadas reconoce el potencial de estas metodologías y advierte sobre su mal uso contra familiares y defensores [32].

---

## 7. Diseño recomendado para Demeter

### 7.1 Unidad, desenlace y exposición
- **Unidad:** municipio-mes (~2,470 municipios × 12). Alternativa preferible si el dato lo permite: AGEB o punto georreferenciado para la capa de idoneidad territorial.
- **Desenlace** `y[m,t]`: conteo de personas con **fecha de desaparición** en el mes t y municipio m, en calidad de no localizadas a la *vintage* de datos fijada. No usar fecha de reporte.
- **Exposición** `E[m,t]`: población municipal (proyecciones CONAPO / Censo 2020). Modelar tasa, no conteo, salvo que se use offset explícito.
- **Vintage:** descargar RNPDNO una vez, registrar fecha y hash, y **no mezclar consultas**. Aplicar corrección de rezago con la distribución empírica de retraso.

### 7.2 Capas del sistema (en orden de implementación)
| Capa | Modelo | Rol | Entregable |
|---|---|---|---|
| **M0 — Baseline histórico** | Media/mediana de 2022–2023 por municipio, y "conteo del año previo" como benchmark | **Obligatorio.** Es el rival a vencer [6] | Ranking base + tasas |
| **M1 — KDE** | KDE sobre puntos de fosas/hallazgos con ancho de banda 18–28 km [21]; corregido por red o por accesibilidad | Capa de intensidad y comunicación | Superficie de densidad |
| **M2 — Random Forest** | RF sobre tasa log con covariables ex-ante; alternativamente GBM Poisson con offset de población | Ranking municipal y aporte de variables | Score + importancia permutacional |
| **M3 — Clustering** | HDBSCAN sobre perfiles municipales + Leiden sobre grafo de adyacencia | Estratificar, definir bloques de validación, reportar por región | Etiquetas de estrato/región |
| **M4 — Opcional** | LGCP-INLA/SPDE para incertidumbre calibrada si hay capacidad técnica | Sustituye a M1/M2 cuando se requiera credibilidad estadística [4][5] | Superficie con IC |

**Covariables permitidas (sólo ex-ante):** conteos históricos propios (t-1, t-12, media 3 años), rezago espacial W·y, población y densidad, grado de urbanización, marginación, estructura de edad/sexo, homicidios dolosos y extorsión por 100k (SESNSP), tiempo de viaje a la red carretera, luces nocturnas VIIRS, pendiente, cobertura vegetal. **Prohibidas:** hallazgos del mismo año o posterior, conteos de búsqueda, cobertura mediática contemporánea, cualquier variable construida con el desenlace.

### 7.3 Validación
- **train 2022–2023 · validación 2024 · test 2025 (un solo uso, congelado).**
- Sobre train: *leave-one-block-out* espacial con bloques = comunidades Leiden o regiones.
- Ajuste de hiperparámetros sólo en 2024. **Ninguna decisión de diseño se toma mirando 2025.**
- Reporte por año, con IC por bootstrap de bloques.

### 7.4 Métricas y umbrales de uso
| Métrica | Umbral para publicar M2 | Umbral para publicar sólo M0+M1 | Acción |
|---|---|---|---|
| **lift@10%** (vs. tasa base) | ≥ **1.5** en 2024 **y** 2025 | < 1.2 en cualquiera de los dos | Si falla, retirar M2 del producto |
| **precision@10%** | ≥ 2× la de M0 | ≤ 1.2× M0 | M2 no aporta |
| **Spearman ρ** (ranking municipal) | ≥ **0.60** ambos años | < 0.40 | Ranking inestable |
| **recall@20%** | ≥ 60% de los eventos de 2025 | < 40% | Cobertura insuficiente |
| **Cobertura IC90** | 80–95% | < 80% | Incertidumbre mal calibrada: no publicar cifras |
| **Calibración (slope)** | 0.7–1.3 | fuera de rango | Recalibrar antes de comunicar |
| **Estabilidad** | Jaccard del top-50 entre 2024 y 2025 ≥ 0.5 | < 0.3 | El top es ruido |

**Regla de decisión:** M2 se publica **sólo si supera a M0 en lift@10% por ≥50% relativo en ambos años**. Si no, se publica M0+M1 y se documenta el resultado negativo. Dado el antecedente de la literatura (RF supera a KDE y RTM, pero apenas al conteo previo [6]), esta regla es realista y protege la credibilidad del proyecto.

### 7.5 Comunicación del resultado
- Tres bandas: **A** = top 5% (candidatos a brigada), **B** = 5–15% (monitoreo), **C** = resto.
- Acompañar cada banda con su **lift observado y su IC**, y con la frase de límite: "prioridad de búsqueda, no diagnóstico del territorio".
- Publicar la metodología completa y un anexo con el desempeño por año, incluidos los fallos.

---

## 8. Limitaciones

1. **Sesgo de etiqueta:** el desenlace mide denuncia/hallazgo registrado, no ocurrencia. No es corregible con modelado; sólo acotable con análisis de sensibilidad y con fuentes múltiples.
2. **Registro inestable:** cambios entre consultas del RNPDNO [26] hacen que dos extracciones no sean comparables. Obliga a fijar *vintage* y a renunciar a comparaciones históricas finas.
3. **Granularidad:** el municipio es una unidad demasiado gruesa para una brigada; el modelo municipal sólo ordena, no localiza. La evidencia mexicana que funciona es de escala de punto/parcela [21][22][23].
4. **Pocos eventos:** con decenas de eventos por año y cientos de predictores potenciales, la varianza domina; los rankings serán inestables año a año.
5. **Extrapolación:** el modelo no es válido fuera del periodo y la geografía de entrenamiento; tampoco bajo cambios de política de registro.
6. **No identificabilidad causal:** imposible separar pobreza, presencia criminal, ausencia institucional y esfuerzo de búsqueda con datos observacionales agregados.
7. **Validación externa escasa:** la única evaluación prospectiva documentada es de n=2 hallazgos [22]; el resto es validación interna o gROC retrospectiva [23].
8. **Capacidad:** sin colectivos y sin brigadas, el mejor ranking no produce búsquedas; y sin búsquedas no hay retroalimentación que mejore el modelo.

---

## 9. Qué NO se puede afirmar

1. **No** se puede afirmar que un municipio "sea" de un cártel, ni atribuir autoría, motivo o pertenencia criminal a un territorio o a sus habitantes.
2. **No** se puede inferir motivación (cártel, feminicidio, violencia de pareja, trata) a partir de conteos agregados sin etiquetas de caso: es falacia ecológica y, además, las categorías se traslapan en el registro.
3. **No** se puede afirmar que un municipio sin registros "no tiene fosas": el 93.4% de cifra oculta [29] y los reportes en cero de CDMX, Querétaro y Yucatán frente a hallazgos documentados [27] lo desmienten.
4. **No** se puede afirmar causalidad de covariables ("la marginación causa desapariciones"): son asociaciones ecológicas confundidas.
5. **No** se puede afirmar una probabilidad individual de que una persona sea desaparecida, ni ordenar colonias por riesgo de una persona concreta.
6. **No** se puede comparar entidades o años sin corregir cambios de registro y confidencialización [26][27].
7. **No** se puede presentar un KDE como probabilidad, ni un score de RF como probabilidad calibrada sin verificación.
8. **No** se puede afirmar que el modelo "predice fosas": predice **dónde es más probable que una búsqueda encuentre evidencia**, condicionado a los sesgos descritos.
9. **No** se puede afirmar validez más allá de 2022–2025 ni transportabilidad a otro estado sin revalidación.
10. **No** se puede afirmar que un resultado negativo del modelo invalide la crisis: la crisis existe con independencia de la calidad del instrumento.

---

## 10. Referencias

**Métodos espaciales y hotspotting**
1. Chainey, S., Tompson, L. & Uhlig, S. (2008). The utility of hotspot mapping for predicting spatial patterns of crime. *Security Journal* 21, 4–28. https://doi.org/10.1057/palgrave.sj.8350066
2. Chainey, S. et al. Hit rate y Predictive Accuracy Index (PAI). NIJ. https://www.ojp.gov/pdffiles1/nij/grants/239861.pdf
3. Comparación de métodos de hotspot mapping (KDE y PAI). GISRUK 2012. https://www.geos.ed.ac.uk/~gisteac/proceedingsonline/GISRUK2012/Papers/presentation-72.pdf
4. Rue, H., Martino, S. & Chopin, N. (2009). Approximate Bayesian inference for latent Gaussian models using INLA. *JRSS-B* 71(2), 319–392. https://rss.onlinelibrary.wiley.com/doi/full/10.1111/j.1467-9868.2008.00700.x
5. Aplicación de LGCP con INLA-SPDE a crimen urbano (Almada, Portugal). *Spatial Statistics* (2026). https://www.sciencedirect.com/science/article/pii/S2211675326000679
6. Wheeler, A. & Steenbeek, W. (2021). Mapping the risk terrain for crime using machine learning. *J. Quantitative Criminology* 37, 445–480. https://doi.org/10.1007/s10940-020-09457-7
7. Phillips, S., Anderson, R. & Schapire, R. (2006). Maximum entropy modeling of species geographic distributions. *Ecological Modelling* 190, 231–259. https://doi.org/10.1016/j.ecolmodel.2005.03.026
8. ESRI. Presence-only Prediction (MaxEnt) — documentación técnica (thinning, background). https://doc.esri.com/en/arcgis-pro/latest/tool-reference/spatial-statistics/presence-only-prediction.html
9. Kulldorff, M. (1997). A spatial scan statistic. *Communications in Statistics — Theory and Methods* 26(6), 1481–1496. https://amstat.tandfonline.com/doi/10.1080/03610929708831995
10. Clustering under the null: one reason for too many signals. *Syndromic Surveillance Conference*. https://dev-linux2.syndromicsurveillance.org/sites/default/files/2022-10/Clustering_Under_The_Null_One_Reason_For_Too_Many_Signals.pdf
11. On estimation in binary autologistic spatial models (por qué la MV exacta no es viable). *J. Statistical Computation and Simulation*. https://www.tandfonline.com/doi/full/10.1080/00949650412331320873
12. A model for analyzing spatially correlated binary data clustered in uncorrelated lattices. *Statistical Methodology*. https://www.sciencedirect.com/science/article/abs/pii/S1572312713000129

**Validación y métricas**
13. Roberts, D.R. et al. (2017). Cross-validation strategies for data with temporal, spatial, hierarchical or phylogenetic structure. *Ecography* 40(8), 913–929. https://nsojournals.onlinelibrary.wiley.com/doi/full/10.1111/ecog.02881
14. Spatial Target Leakage in Location Intelligence: quantifying CV bias from spatial autocorrelation. Zenodo. https://www.zenodo.org/records/22149238
15. BORG: Bounded Outcome Risk Guard — diagnóstico de dependencia y esquemas de CV espacial/temporal en R. https://cran.imr.no/web/packages/BORG/index.html
16. Behavior of prediction performance metrics with rare events. arXiv:2504.16185. https://arxiv.org/html/2504.16185v2

**Autocorrelación y grafos**
17. Anselin, L. (1995). Local indicators of spatial association — LISA. *Geographical Analysis* 27(2), 93–115. https://doi.org/10.1111/j.1538-4632.1995.tb00338.x

**Evidencia México (académica y gris)**
18. Xantomila, J. (2022). Crean modelo para localizar fosas clandestinas. *La Jornada*, 17 jul 2022. https://www.jornada.com.mx/2022/07/17/politica/010n2pol
19. Meltis, M., Ball, P. & Ruiz, J. (2017). New results for the identification of municipalities with clandestine graves in Mexico. HRDAG. https://hrdag.org/2017/11/23/new-clandestine-graves-mexico/
20. Wade, L. (2017). Predicting where victims of Mexico's violence are buried. *Science* 356(6345), 1317–1318. https://www.science.org/doi/full/10.1126/science.356.6345.1317
21. Alegre-Mondragón, A.J., Lobo Díaz, F., Ruiz Reyes, J. & Silván-Cárdenas, J.L. (2022). Hallazgos de fosas clandestinas: uso de análisis geoespacial… Baja California. Amnesty Citizen Evidence Lab. https://citizenevidence.org/2022/06/30/hallazgos-de-fosas-clandestinas-uso-de-analisis-geoespacial-para-la-busqueda-de-personas-desaparecidas-en-baja-california-mexico/
22. Ruiz Reyes, J. & Franco, A. (2023). En vías de probar nuestro modelo… Citizen Evidence Lab. https://citizenevidence.org/2023/11/09/en-vias-de-probar-nuestro-modelo-exitos-y-futuro-de-la-localizacion-de-fosas-clandestinas-en-mexico/
23. Silván-Cárdenas, J.L., Alegre-Mondragón, A.J. et al. (2024). Assessing geospatial models to explain the occurrence of clandestine graves in Mexico. *Forensic Science International* 361, 112114. https://www.sciencedirect.com/science/article/abs/pii/S0379073824001956
24. Characteristics of Clandestine Burial Sites in Mexico: A Regional Overview with Multivariate Analysis (2024). Springer. https://link.springer.com/chapter/10.1007/978-3-031-61440-8_5
25. Aguilar-Velázquez, D. et al. (2025). Understanding disappearances in Mexico City: a data-driven analysis. *PLOS ONE* 20(9), e0323405. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0323405
26. Data Cívica, *A quienes nos faltan* (5.ª ed., 2026), reportado por EDUCA. https://www.educaoaxaca.org/no-hay-certeza-sobre-cuantos-desaparecidos-hay-en-mexico-data-civica-encontro-discrepancias-en-datos-oficiales/
27. Artículo 19, Data Cívica y PDH-Ibero (2025). La Plataforma Ciudadana de Fosas revela irregularidades y opacidad en los registros oficiales. https://articulo19.org/la-plataforma-ciudadana-de-fosas-revela-irregularidades-y-opacidad-en-los-registros-oficiales-de-fosas-clandestinas-en-mexico/
28. Plataforma Ciudadana de Fosas Clandestinas. https://plataformaciudadanadefosas.org/
29. INEGI (2026). ENVIPE 2026 — 93.4% de cifra oculta. https://www.inegi.org.mx/app/saladeprensa/noticia/11174

**Ética y sesgo algorítmico**
30. Richardson, R., Schultz, J. & Crawford, K. (2019). Dirty data, bad predictions. *NYU Law Review Online* 94, 192. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3333423
31. *El derecho a la no discriminación algorítmica* (UNAM, IIJ) — geografía de la sospecha y discriminación territorial. https://archivos.juridicas.unam.mx/www/site//publicaciones/298El_derecho_a_la_no_discriminacion_algoritmica_Experiencias_debates_y_desafios_en_la_era_de_la_IA.pdf
32. UN Working Group on Enforced Disappearances (2023). New technologies and enforced disappearances, A/HRC/54/22/Add.5. https://www.ohchr.org/en/documents/thematic-reports/ahrc5422add5-new-technologies-and-enforced-disappearances-report-working

