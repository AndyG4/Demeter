# Seguridad y privacidad

## 1. Modelo de amenaza

Demeter es un sitio **público, sin login y sin escritura**. Los activos a proteger son:

1. **Personas:** nombres y lugares asociados a desapariciones. El riesgo principal es la enumeración, el scraping y la reidentificación.
2. **Integridad del dato:** que un archivo malicioso o corrupto altere el índice o el modelo.
3. **Disponibilidad:** que un actor agote CPU/memoria con búsquedas o grafos.
4. **Reputación:** que una predicción se lea como acusación o certeza.

Fuera de alcance: cuentas de usuario, pagos, sesiones, datos de salud, documentos de identidad.

## 2. Controles implementados

| Amenaza | Control | Dónde |
|---|---|---|
| XSS reflejado/almacenado | Todo dato se inserta con `textContent`; CSP `script-src 'self'`; sin `innerHTML` con datos de usuario | frontend, `SecurityHeadersFilter` |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | `SecurityHeadersFilter` |
| MIME sniffing | `X-Content-Type-Options: nosniff` | idem |
| Fuga de referrer | `Referrer-Policy: no-referrer` | idem |
| APIs de navegador | `Permissions-Policy` sin geolocalización, cámara, micrófono ni pagos | idem |
| Fuerza bruta / enumeración | 30 búsquedas/minuto por IP; mínimo 3 letras; máximo 25 resultados; sin paginación profunda | `RateLimitFilter`, `SearchService` |
| Agotamiento general | 120 solicitudes/minuto por IP; respuestas comprimidas; consultas acotadas | `RateLimitFilter` |
| Inyección | Sin SQL, sin shell, sin plantillas dinámicas; entrada validada por allowlist | `SearchService`, `Csv` |
| Path traversal | `recordsFile` sin `/` ni `\`; ruta normalizada y confinada a `dataDir` | `DatasetService` |
| CSV malicioso | Límite de filas, columnas, campo y longitud; validación de tipos; descarte de filas inválidas | `Csv`, `RecordsLoader` |
| SSRF | No hay fetch remoto configurable; sólo lectura local | `DatasetService` |
| Fuga de errores | Handler global sin stack trace; `server.error.include-* = never` | `GlobalExceptionHandler` |
| Request smuggling / cabeceras gigantes | Límite de cabecera 16 KB; sin multipart; body de formulario 64 KB | `application.properties` |
| Correlación de logs | `X-Request-Id` aleatorio; no se registran nombres ni consultas | `RequestIdFilter` |
| Fuerza bruta de modelos | El modelo se entrena una vez por versión; no hay endpoint de reentrenamiento | `PredictionService` |
| Dependencias | Sólo Spring Web, Jackson, Tomcat, JUnit; sin librerías de gráficos ni analytics | `pom.xml` |

### Cabeceras

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self';
  img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none';
  base-uri 'none'; frame-ancestors 'none'; form-action 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains   (sólo HTTPS)
Cache-Control: no-store                                          (sólo /api/)
```

La CSP no usa `unsafe-inline` ni `unsafe-eval`. Leaflet y GSAP se sirven localmente y modifican estilos mediante propiedades DOM, no mediante atributos `style` inyectados.

## 3. Privacidad por diseño

- **Minimización:** el registro sólo contiene nombre, edad, sexo, fecha, municipio, estatus, condición, folio y fuente. No direcciones, teléfonos, documentos, fotografías, familiares ni narrativas.
- **Búsqueda individual:** no hay listado completo, exportación, API de paginación ni endpoint de “todos los nombres”. La consulta exige 3 letras.
- **Sin cuentas:** no hay cookies de sesión, perfiles, historial ni publicidad. El servidor no guarda la consulta.
- **Base anonimizada por defecto:** la instalación incluida no expone nombres; usa 137,583 registros reales anonimizados. Los nombres sólo se habilitan con un CSV autorizado.
- **Agregados para el mapa:** el mapa inicial muestra conteos por entidad, no puntos de personas. Los puntos individuales sólo aparecen tras una búsqueda.
- **Metadatos:** `robots.txt` bloquea `/api/`; no hay sitemap de fichas.

### Lo que el sitio no hace

- No evade captchas, puertas de términos, `robots.txt` ni controles de acceso.
- No automatiza la consulta individual del RNPDNO.
- No ingiere fichas personales de la SCJN ni de registros estatales con datos sensibles.
- No usa bases filtradas ni datos de origen ilícito.
- No infiere autoría, motivación, pertenencia a grupos criminales ni “perfil de víctima”.
- No vende, comparte ni cruza datos con terceros.

## 4. Seguridad de la ingesta

El único canal de actualización es un archivo local colocado por el operador. No hay endpoint de subida.

1. `manifest.json` se valida contra un esquema fijo; propiedades desconocidas fallan.
2. `recordsFile` no puede contener separadores de ruta.
3. La ruta resuelta debe quedar dentro de `dataDir`.
4. El CSV se lee con límites de 8 KB por campo, 32 columnas y 200,000 filas.
5. Cada fila se valida: nombre normalizado de 3-120 caracteres, municipio existente, fecha válida y no futura, estatus reconocido.
6. Los registros inválidos se descartan; si no queda ninguno, la carga falla y se conserva la versión anterior.
7. Se calcula SHA-256 para la versión.
8. La instantánea se publica completa; no se muta el índice en caliente.

### Riesgo residual

Si un atacante ya puede escribir en `dataDir`, puede introducir registros falsos o leer archivos locales a través del parser. `dataDir` debe tener permisos de sistema de archivos restringidos y no debe estar dentro de una carpeta servida por el proxy.

### Datos reales

El modo real no cambia el canal: sigue siendo un archivo local autorizado. No hay endpoint de subida, scraping ni conexión saliente al RNPDNO. Si el manifest declara `synthetic:false` y el CSV no existe, el servicio falla al iniciar en lugar de caer a la demostración. Antes de cargar nombres reales se requiere base legal, evaluación de impacto, minimización y protocolo de corrección/eliminación. Ver [`DATOS_REALES.md`](DATOS_REALES.md).

La capa de nombres (`data/registros_nombres.csv`) es pública pero sensible: se carga localmente, no se empaqueta y sólo se consulta por nombre; no hay endpoint de listado masivo. La ubicación es estatal, no municipal. El operador debe atender solicitudes de retiro y no convertir el buscador en un directorio.

### Mapa de calles

El mapa estándar usa **OpenStreetMap**; el relieve usa **Esri Topo**. El navegador solicita teselas a `tile.openstreetmap.org` o `server.arcgisonline.com`; la CSP permite únicamente esos hosts en `img-src`. El servidor no envía la consulta ni el nombre de la persona al proveedor, pero éste recibe la IP y la tesela solicitada. La política de referrer es `strict-origin-when-cross-origin` para que OpenStreetMap acepte la solicitud; no se envía la ruta ni parámetros. Las teselas de OpenStreetMap están sujetas a su política de uso: para tráfico alto hay que autohospedar o contratar un proveedor. Si la instancia debe ser completamente offline o sin terceros, se puede desactivar la capa en `map.js`.

## 5. Límite de tasa

`TokenBucketRateLimiter` mantiene un bucket por IP y por tier (`general`, `search`) en memoria. Capacidad = límite por minuto; recarga continua; limpieza cada 10 minutos de buckets inactivos.

- Sin `rastro.trust-forwarded=true`, se usa `request.getRemoteAddr()` y `X-Forwarded-For` se ignora (evita spoofing).
- Detrás de un proxy propio, activar `trust-forwarded` y limitar el acceso al proxy.
- En varias instancias, el límite es por instancia; para un límite global se necesita Redis u otro almacén compartido.

## 6. Checklist de despliegue

- [ ] TLS terminado en un proxy confiable; HSTS activo.
- [ ] `rastro.demo-enabled=false` y `manifest.synthetic=false` con datos autorizados.
- [ ] `dataDir` fuera del webroot, permisos 700, propietario del servicio.
- [ ] `rastro.trust-forwarded=true` sólo si hay proxy propio y el puerto de la app no está expuesto.
- [ ] Revisar licencia y base legal de cada fuente antes de cargar datos reales.
- [ ] Revisar aviso de privacidad y protocolo de atención a familiares.
- [ ] Cache de estáticos con hash de contenido; este proyecto sirve nombres estables.
- [ ] Logs sin nombres, sin query strings y con retención corta.
- [ ] Respaldos cifrados del CSV y del manifiesto; borrar copias temporales.
- [ ] Monitoreo de 429, 5xx y latencia de búsqueda.
- [ ] Análisis de dependencias (`mvn dependency:tree`, SCA) en CI.
- [ ] Prueba de carga con el límite activo.
- [ ] Revisión de que `dataDir` no sea accesible por el proxy.
- [ ] Sustituir el rate limit en memoria si hay más de una instancia.

## 7. Riesgos residuales

1. **Enumeración distribuida.** Muchas IPs pueden reconstruir el padrón consultando nombres comunes. El límite por IP no lo impide. Mitigación adicional: pruebas de esfuerzo, detección de patrones, registro de anomalías agregadas y, en producción, autenticación institucional para acceso masivo.
2. **Datos sintéticos confundidos con reales.** Mitigado con banner, ficha y API; no eliminado.
3. **Sesgo del registro.** No es un riesgo de seguridad informática, pero sí de seguridad humana: un modelo entrenado con datos incompletos puede reforzar la invisibilidad de ciertos municipios.
4. **Cache del navegador.** Los estáticos se sirven con `max-age=1h`; un cambio de JS puede tardar. En producción usar fingerprint.
5. **Dependencias del sistema.** Java, Tomcat y Jackson deben actualizarse; el proyecto fija Spring Boot 3.4.4.

## 8. Respuesta a incidentes

1. Retirar la versión de datos publicada (`data/` a cuarentena) y volver a la instantánea anterior.
2. Invalidar cache/CDN.
3. Conservar logs con `X-Request-Id`, sin nombres.
4. Notificar a la organización responsable de los datos y, si hay datos personales comprometidos, seguir el protocolo legal aplicable.
5. Documentar causa, alcance y mitigación; actualizar este documento.

## 9. Lo que no se debe hacer

- No poner un captcha como única defensa y luego automatizarlo.
- No usar un proxy/scraper para saltar la puerta de términos del RNPDNO.
- No cargar bases filtradas “porque ya son públicas”.
- No publicar fichas individuales completas ni fotos.
- No usar el modelo para señalar municipios como “narcos” o para inferir motivos.
- No habilitar CORS abierto ni endpoints de escritura sin autenticación.



