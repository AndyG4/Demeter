# Matemáticas del modelo

Este documento concentra las definiciones que antes vivían en comentarios del código.

## 1. Unidades y notación

- \(m\): municipio.
- \(e\): entidad federativa.
- \(t\): año.
- \(P_m\): población municipal.
- \(P_e\): población estatal.
- \(F_e\): fosas documentadas de la entidad en 2006-2016.
- \(y_m \in \{0,1\}\): presencia documentada de fosas en el municipio.
- \(N_m\): registros de desaparición del municipio en 2015-2024.
- \(N_e\): registros de desaparición de la entidad en 2015-2024.

La etiqueta \(1\) significa presencia documentada. La etiqueta \(0\) significa ausencia de registro, no ausencia física verificada.

## 2. M0: persistencia histórica

Tasa estatal suavizada:

\[
r_e = \frac{F_e + 1}{\frac{P_e}{100{,}000} + 10}
\]

Puntaje municipal:

\[
s_m^{M0} = r_e \cdot \frac{P_m}{100{,}000}
\]

Fosas esperadas:

\[
\widehat{F}_m = r_e \cdot \frac{P_m}{100{,}000}
\]

La prioridad publicada es el percentil de \(s_m^{M0}\) entre los 2,469 municipios.

## 3. M1: KDE espacial

Para cada municipio:

\[
d_m = \sum_e F_e \cdot \exp\left(-\frac{1}{2}\left(\frac{\operatorname{haversine}(m,e)}{120}\right)^2\right)
\]

Normalización:

\[
s_m^{M1} = \frac{d_m}{\max_j d_j}
\]

La distancia está en kilómetros y el ancho de banda es 120 km.

## 4. M2: Random Forest

Variables:

\[
x_m = \left[
\log(1+P_m),\ \text{lat}_m,\ \text{lon}_m,\ \log(1+F_e),\
r_e,\ d^{\text{centro}}_m,\ d^{\text{frontera}}_m,\
\log(1+\text{municipios}_e),\ \log(1+P_e)
\right]
\]

El bosque tiene 180 árboles, profundidad máxima 12 y hoja mínima 4 en producción. La probabilidad es el promedio de las hojas:

\[
\widehat{p}_m = \frac{1}{T}\sum_{t=1}^{T} p_t(x_m)
\]

La validación usa 80 árboles, profundidad 10 y hoja mínima 5.

## 5. M3: persistencia más historia municipal

M3 conserva las nueve variables de M2 y agrega:

\[
\log(1+N_m),\quad \frac{N_m}{P_m/100{,}000},\quad
\log(1+N_e),\quad \frac{N_e}{P_e/100{,}000}
\]

El modelo es un Random Forest regularizado:

- 160 árboles;
- profundidad máxima 5;
- hoja mínima 60;
- semilla fija.

La regularización se fija antes de evaluar y no se ajusta contra el conjunto de prueba.

### Calibración isotónica

Sea \(s_i\) el puntaje out-of-fold de M3 y \(y_i\) la etiqueta. Se ajusta una función monótona no decreciente \(\phi\) por Pool Adjacent Violators:

\[
\phi = \arg\min_{\phi \text{ monótona}} \sum_i (y_i - \phi(s_i))^2
\]

La probabilidad calibrada es:

\[
\widetilde{p}_i = \phi(s_i)
\]

La calibración no cambia el orden del ranking, sólo la escala de probabilidad. El Brier baja de 0.149 a 0.130.

### Regla de selección

Un challenger se publica sólo si:

\[
AP_{\text{challenger}} > 1.05 \cdot \max(AP_{M0}, AP_{M1})
\]

M3 cumple:

\[
0.804 > 1.05 \cdot 0.749 = 0.786
\]

## 6. Métricas

### AUC

Para un positivo y un negativo elegidos al azar:

\[
AUC = P(\widehat{p}_{+} > \widehat{p}_{-})
\]

### Average Precision

\[
AP = \sum_{k=1}^{n} (R_k - R_{k-1}) P_k
\]

donde \(P_k\) y \(R_k\) son precisión y recall en el corte \(k\).

### Precisión y recall en el decil superior

\[
P@10\% = \frac{\text{positivos en el top }10\%}{\text{municipios en el top }10\%}
\]

\[
R@10\% = \frac{\text{positivos en el top }10\%}{\text{total de positivos}}
\]

### Lift

\[
\text{Lift}@10\% = \frac{P@10\%}{\text{prevalencia}}
\]

### Brier

\[
Brier = \frac{1}{n}\sum_{i=1}^{n}(\widehat{p}_i-y_i)^2
\]

### ECE

\[
ECE = \sum_{b=1}^{10}\frac{n_b}{n}\left|\overline{y}_b-\overline{\widehat{p}}_b\right|
\]

## 7. Diagnóstico de sobreajuste

### Ablación

Se compara M3 contra un bosque con la misma regularización y sólo las nueve variables originales:

\[
\Delta AP = AP_{M3} - AP_{M2\text{-reg}}
\]

Resultado:

\[
\Delta AP = 0.059,\quad IC_{95\%}=[0.043, 0.075]
\]

### Permutación

Se barajan las cuatro variables de historia municipal entre municipios y se repite la validación:

\[
p = \frac{1+\#\{AP_{\text{permutada}} \ge AP_{\text{real}}\}}{1+B}
\]

Resultado: \(AP_{\text{real}}=0.804\), \(AP_{\text{permutada}}=0.736\), \(p=0.05\) con 19 permutaciones.

### Brecha de generalización

\[
\Delta_{\text{gen}} = AP_{\text{in-sample}} - AP_{\text{out-of-sample}}
\]

M3: \(0.831-0.790=0.041\). M2-regularizado: \(0.794-0.731=0.063\).

## 8. M4: nuevo contexto documentado

M4 cambia el objetivo:

\[
z_{m,t} = 1 \text{ si el municipio }m\text{ tuvo al menos un contexto nuevo documentado en }t
\]

Variables:

\[
x_{m,t} = [C_{m,t-1}, C_{m,t-2}, C_{m,t-3}, \log(1+P_m)]
\]

Modelo logístico con regularización L2:

\[
P(z_{m,t}=1\mid x_{m,t}) = \sigma(w^\top x_{m,t}+b)
\]

\[
\mathcal{L} = -\sum_i \left[z_i\log \widehat{z}_i+(1-z_i)\log(1-\widehat{z}_i)\right] + \lambda\|w\|_2^2
\]

Entrenamiento 2021-2023, validación 2024, prueba 2025 y 2026. Sin ajuste de hiperparámetros con los años de prueba.

### Ajuste de prevalencia

Para una prevalencia de origen \(\pi_s\) y una prevalencia objetivo \(\pi_t\):

\[
\text{odds}_{\text{new}} = \text{odds}_{\text{old}}\cdot
\frac{\pi_t/(1-\pi_t)}{\pi_s/(1-\pi_s)}
\]

\[
p_{\text{new}} = \frac{\text{odds}_{\text{new}}}{1+\text{odds}_{\text{new}}}
\]

En M4 se usó la prevalencia del año anterior. No mejoró el Brier; se reporta como diagnóstico, no como mejora publicada.

## 9. Límites

- La etiqueta municipal de M3 es presencia histórica documentada, no incidencia real.
- La validación es espacial, no temporal prospectiva.
- Los ceros son ausencia de registro, no ausencia confirmada.
- M4 sólo tiene un estado y 46 municipios.
- La calibración local de Jalisco sigue siendo alta en ECE.
- No se puede concluir que el modelo prediga fosas nuevas.
