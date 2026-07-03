# Guía de instalación paso a paso (para personas no técnicas)

Esta guía explica cómo instalar y usar Radar Legislativo **sin saber programar**. Si ya sabes usar una terminal, el [README](../README.md) tiene la versión corta.

## ¿De verdad necesito instalar algo?

Depende de tu caso. Hay dos formas de "usar" Radar Legislativo:

1. **Solo quieres usar la aplicación** (ver proyectos de ley, audiencias, alertas). Si alguien de tu equipo ya la publicó en internet (por ejemplo con Vercel, ver [README → Deploy](../README.md#deploy-vercel)), **no necesitas instalar nada**: solo un navegador y el usuario y contraseña que te hayan creado. Este es el camino recomendado para equipos no técnicos.

2. **Quieres instalarla y correrla en tu propio computador**. Entonces sí necesitas tres programas gratuitos: **Docker Desktop**, **Git** y **Bun**. Esta guía te lleva de la mano por cada uno. Ninguno es opcional:
   - **Bun** es el "motor" que ejecuta el código de la aplicación.
   - **Docker** ejecuta la **base de datos** (PostgreSQL), donde se guardan los proyectos, audiencias y usuarios.
   - **Git** sirve para descargar el código (y en Windows, además instala la terminal que necesita el instalador).

## Antes de empezar: ¿qué es "la terminal"?

Varios pasos dicen "escribe esto en la terminal". La terminal es una ventana donde le das órdenes al computador escribiendo texto en vez de haciendo clic. Se abre así:

- **Mac**: presiona `Cmd + barra espaciadora`, escribe `Terminal` y presiona Enter.
- **Windows**: presiona la tecla Windows, escribe `PowerShell` y presiona Enter. (Más adelante usaremos también **Git Bash**, que se instala en el Paso 2.)

Cuando la guía diga "ejecuta un comando", significa: copiar el texto, pegarlo en esa ventana y presionar Enter.

---

## Paso 1 — Instalar Docker Desktop (la base de datos)

1. Ve a <https://www.docker.com/products/docker-desktop/> y haz clic en **Download**.
   - **Mac**: elige "Apple Silicon" si tu Mac es de 2021 o posterior (chip M1/M2/M3/M4); "Intel" si es más antiguo. Si no sabes: menú  → "Acerca de este Mac" te lo dice.
   - **Windows**: elige la versión estándar (AMD64).
2. Abre el archivo descargado e instala como cualquier programa (en Mac: arrastra la ballena a la carpeta Aplicaciones; en Windows: siguiente, siguiente, aceptar). En Windows puede pedirte reiniciar el computador — hazlo.
3. Abre **Docker Desktop**. La primera vez te pedirá aceptar los términos y te ofrecerá crear una cuenta: **puedes saltarte la cuenta** (busca "Skip" o "Continue without signing in").
4. Listo cuando veas el ícono de la ballena 🐳 en la barra superior (Mac) o junto al reloj (Windows) sin errores.

> ⚠️ **Importante**: Docker Desktop debe estar **abierto** cada vez que quieras usar la aplicación. Si el computador se reinicia, ábrelo de nuevo antes de arrancar el Radar.

## Paso 2 — Instalar Git (para descargar el código)

- **Mac**: abre la Terminal y escribe `git --version` + Enter. Si no está instalado, aparecerá una ventana ofreciendo instalar las "herramientas de línea de comandos" — acepta y espera a que termine.
- **Windows**: descarga Git desde <https://git-scm.com/download/win> e instálalo dejando **todas las opciones por defecto**. Esto además instala **Git Bash**, la terminal que usarás en el Paso 4 (el instalador automático del proyecto solo funciona en ese tipo de terminal).

## Paso 3 — Instalar Bun (el motor de la aplicación)

- **Mac**: en la Terminal, pega esto y presiona Enter:

  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **Windows**: en PowerShell, pega esto y presiona Enter:

  ```powershell
  powershell -c "irm bun.sh/install.ps1 | iex"
  ```

Luego **cierra la terminal y ábrela de nuevo** (necesario para que reconozca el programa recién instalado). Verifica escribiendo `bun --version` — si responde con un número (ej: `1.2.x`), quedó bien.

## Paso 4 — Descargar y arrancar el Radar

Con Docker Desktop **abierto**, en la terminal (en Windows: usa **Git Bash**, no PowerShell, para este paso), pega estos tres comandos uno por uno:

```bash
git clone https://github.com/raimundo-hp67/Radar-legislativo.git
cd Radar-legislativo
./scripts/setup.sh
```

El instalador hace todo solo: levanta la base de datos, crea la configuración, aplica las migraciones, **te pide inventar tu email y contraseña de acceso** y ofrece cargar proyectos de ley de ejemplo. Cuando termine:

```bash
bun run dev
```

Abre <http://localhost:3000> en tu navegador e inicia sesión con el usuario que creaste. 🎉

## Uso diario

- **Apagar**: vuelve a la terminal y presiona `Ctrl + C`.
- **Volver a usarla otro día**: abre Docker Desktop, abre la terminal y ejecuta:

  ```bash
  cd Radar-legislativo
  bun run dev
  ```

- **Crear cuentas para colegas**: con la terminal en la carpeta del proyecto:

  ```bash
  bun run scripts/create-user.ts colega@email.com 'una-clave-segura' 'Nombre Colega'
  ```

---

## ¿Los datos se actualizan solos?

**No. Corriendo en tu computador, la aplicación no se actualiza sola.** No hay ningún proceso en segundo plano: los datos del Senado y de lobby se refrescan **solo cuando algo lo pide**. Los botones "Actualizar" de la interfaz refrescan lo que ya está guardado en tu base de datos, **no** traen datos nuevos desde el Senado.

### Actualizar a mano (cuando corre en tu computador)

Con la aplicación corriendo (`bun run dev`):

- **Audiencias de lobby**: en la pestaña **Lobby** de la aplicación hay un botón de **sincronizar** que trae las audiencias nuevas. Es la única sincronización con botón en la interfaz.
- **Proyectos de ley** (estados, urgencias, cambios): abre una **segunda terminal** y ejecuta:

  ```bash
  curl -X POST http://localhost:3000/api/legal/poll -H "x-api-key: change-me-in-production"
  ```

  Esto consulta el Senado por cada proyecto en seguimiento, detecta cambios y —si configuraste Slack— envía las alertas. (La clave `change-me-in-production` es la de fábrica; solo sirve en tu computador, en producción se exige cambiarla.)
- **Buscador de proyectos del Senado** (el cache para buscar proyectos nuevos):

  ```bash
  bun run scripts/bulk-sync.ts
  ```

### Actualización automática (sin tocar nada)

Para que se actualice sola necesitas que **algo llame al endpoint de actualización según un horario**. Opciones, de más simple a más artesanal:

1. **Publicarla en Vercel** (recomendado). El archivo [`vercel.json`](../vercel.json) ya trae dos tareas programadas: actualización de proyectos de ley los **lunes a las 12:00 UTC** y sincronización de lobby los **lunes a las 07:00 UTC**. Puedes cambiar la frecuencia editando ese archivo (formato [cron](https://vercel.com/docs/cron-jobs)). Ver [README → Deploy](../README.md#deploy-vercel).
2. **Un cron externo** apuntando a tu instancia: cualquier servicio de tareas programadas (cron de un servidor, GitHub Actions, cron-job.org) que haga `POST /api/legal/poll` con el header `x-api-key` (definiendo un `LEGAL_POLL_API_KEY` propio en `.env`). Requiere que la aplicación esté accesible desde internet.
3. **Tu propio computador**: técnicamente puedes programar el comando `curl` de arriba con el programador de tareas de tu sistema, pero exige que tu computador esté **encendido y con la app corriendo** en ese momento — por eso no lo recomendamos como solución permanente.

### ¿Y es "en vivo"?

Ni siquiera en Vercel es en vivo en sentido estricto: es una **revisión programada** (semanal por defecto, configurable a diaria o cada pocas horas). Para este caso de uso es suficiente — la tramitación legislativa se mueve en días, no en segundos — y evita saturar la API pública del Senado.

| Escenario | ¿Se actualiza sola? | Frecuencia |
|-----------|--------------------|------------|
| Corriendo en tu computador (`bun run dev`) | ❌ No | Solo cuando la actualizas a mano |
| Publicada en Vercel | ✅ Sí | Lunes por semana (configurable en `vercel.json`) |
| Cualquier servidor + cron externo | ✅ Sí | La que definas en el cron |

---

## Problemas frecuentes

- **"docker: command not found" o el instalador dice que falta Docker** → Docker Desktop no está abierto. Ábrelo, espera a que la ballena deje de "cargar" y vuelve a intentar.
- **"bun: command not found" justo después de instalar Bun** → cierra la terminal y ábrela de nuevo.
- **En Windows `./scripts/setup.sh` no funciona** → estás en PowerShell; abre **Git Bash** (se instaló con Git) y repite el Paso 4 ahí.
- **La página no carga en localhost:3000** → revisa que la terminal donde ejecutaste `bun run dev` siga abierta y sin errores rojos.
- **Olvidé mi contraseña** → crea otro usuario con `bun run scripts/create-user.ts` y entra con ese.
