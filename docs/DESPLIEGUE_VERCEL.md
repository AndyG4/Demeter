# Despliegue en Vercel

## Resumen

Vercel puede ejecutar Java y Spring Boot mediante su **Container Runtime** en beta. No se usa un runtime Java nativo ni una función Java tradicional: Vercel construye una imagen OCI desde `Dockerfile.vercel` y enruta todo el tráfico HTTP a esa imagen.

La aplicación es un servidor Spring Boot que sirve el HTML, CSS, JavaScript y la API desde el mismo proceso. Por eso el contenedor debe escuchar en `0.0.0.0` y en el puerto que Vercel indique con `PORT`.

Referencias oficiales:

- [Container Runtime](https://vercel.com/docs/functions/runtimes/container)
- [Run any Dockerfile on Vercel](https://vercel.com/blog/dockerfile-on-vercel)
- [Deploy a container from a plain Dockerfile](https://vercel.com/changelog/deploy-a-container-from-a-plain-dockerfile)
- [Functions limits](https://vercel.com/docs/functions/limitations)

## Archivos añadidos

### `Dockerfile.vercel`

Construcción en dos etapas:

1. `maven:3.9.9-eclipse-temurin-21` compila el jar.
2. `eclipse-temurin:21-jre-jammy` ejecuta el jar como usuario no root.

La imagen:

- escucha en `PORT`, con respaldo en `80`;
- fija `TZ=America/Mexico_City`;
- limita el heap al 70% de la memoria del contenedor;
- usa `UseSerialGC` para un contenedor pequeño;
- no escribe en disco;
- no incluye la capa local de nombres.

### `vercel.json`

```json
{
  "framework": "container"
}
```

`Dockerfile.vercel` también activa el preset de contenedor. El archivo explícito evita que Vercel detecte otro framework.

### `application.properties`

```properties
server.port=${PORT:8080}
server.address=0.0.0.0
server.forward-headers-strategy=framework
```

`0.0.0.0` es obligatorio: un servidor en `127.0.0.1` no recibe tráfico desde el contenedor.

## Pasos de despliegue

### Opción A: GitHub + Vercel

1. Subir el repositorio a GitHub.
2. En Vercel: **Add New Project**.
3. Importar el repositorio.
4. Vercel debe detectar `Dockerfile.vercel` y el framework `container`.
5. No configurar Build Command ni Output Directory.
6. Desplegar.

### Opción B: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel link
vercel deploy
vercel --prod
```

## Variables de entorno

Obligatoria, gestionada por Vercel:

```text
PORT
```

Opcionales:

```text
JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Djava.awt.headless=true
TZ=America/Mexico_City
```

No hay base de datos, login ni almacenamiento persistente.

## Límites que afectan la experiencia

- El Container Runtime está en **beta**.
- En Hobby, la función tiene **2 GB de memoria y 1 vCPU**; el máximo de duración es **300 s**.
- La instancia se apaga tras **5 minutos sin tráfico** en producción.
- El primer request después del apagado paga el **cold start** de Spring Boot y la carga del dataset. En local el arranque tarda alrededor de **36 s**.
- Para una demostración con tráfico intermitente, el cold start puede ser perceptible.
- Para un servicio siempre disponible, Render, Fly.io o Cloud Run son más adecuados; Vercel Container es válido para demo y tráfico moderado.

## Verificación local

No hay Docker instalado en este entorno, así que la imagen no se construyó aquí. Lo que sí se verificó:

```bash
mvn -o test
mvn -o -DskipTests package
java -jar target/demeter.jar
```

Cuando haya Docker:

```bash
docker build -f Dockerfile.vercel -t demeter .
docker run --rm -p 8080:80 -e PORT=80 demeter
curl http://localhost:8080/api/v1/health
```

## Seguridad y datos

- La imagen incluye `data/registros_nombres.csv` para habilitar la búsqueda por nombre. Ese archivo se publica en el repositorio y queda descargable.
- La capa de nombres sólo publica entidad, no municipio.
- La fuente de nombres no tiene una licencia de reutilización explícita; revisar autorización y política de retiro antes de un despliegue público.
- El rate limiting es por instancia, no global. En Vercel con varias instancias no equivale a un límite distribuido.
- Revisar CSP y cabeceras al cambiar de dominio.
- El contenedor corre como usuario no root.

## Decisión

Vercel es viable para una **demo pública**. No es la mejor opción para un servicio operativo con búsquedas sensibles, necesidad de disponibilidad constante o rate limiting global.

