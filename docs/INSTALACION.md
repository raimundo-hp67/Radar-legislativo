# Guía de instalación paso a paso (para personas no técnicas)

Esta guía explica cómo instalar y usar Radar Legislativo **sin saber programar**. Si ya sabes usar una terminal, el [README](../README.md) tiene la versión corta.

## ¿De verdad necesito instalar algo?

Depende de tu caso. Hay dos formas de "usar" Radar Legislativo:

1. **Solo quieres usar la aplicación** (ver proyectos de ley, audiencias, alertas). Si alguien de tu equipo ya la publicó en internet (por ejemplo con Vercel, ver [README → Ponerla en vivo](../README.md#ponerla-en-vivo-vercel-sin-servidores-propios)), **no necesitas instalar nada**: solo un navegador y el usuario y contraseña que te hayan creado. Este es el camino recomendado para equipos no técnicos.

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

**Sí — mientras la aplicación esté prendida.** La app trae un actualizador integrado: cada **6 horas** consulta al Senado por los proyectos en seguimiento y sincroniza las audiencias de lobby, sin que hagas nada. Además, al arrancarla revisa si los datos llevan mucho tiempo sin refrescarse y los pone al día a los pocos minutos.

Dos cosas que conviene entender:

- La app solo puede actualizarse **mientras está corriendo** (Docker Desktop abierto + `bun run dev` andando). Si el computador está apagado o cerraste la terminal, no pasa nada hasta que la vuelvas a abrir — y al abrirla, se pone al día sola.
- Puedes cambiar la frecuencia editando `AUTO_UPDATE_INTERVAL_HOURS` en el archivo `.env` (número de horas; `0` la desactiva).

Los botones "Actualizar" de la interfaz solo refrescan lo que ya está guardado en tu base de datos; la actualización de verdad la hace el actualizador integrado (o las opciones de abajo).

### Actualizar a mano, sin esperar el ciclo

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

### Actualización 24/7 (aunque tu computador esté apagado)

Para que se actualice siempre —sin depender de que alguien tenga la app abierta— hay que publicarla en un servidor. Opciones, de más simple a más artesanal:

1. **Publicarla en Vercel** (recomendado). El archivo [`vercel.json`](../vercel.json) ya trae dos tareas programadas **diarias**: actualización de proyectos de ley a las 12:00 UTC y sincronización de lobby a las 07:00 UTC. (El plan gratuito de Vercel permite máximo una ejecución al día por tarea; con plan pagado puedes subir la frecuencia editando ese archivo, formato [cron](https://vercel.com/docs/cron-jobs).) Ver [README → Ponerla en vivo](../README.md#ponerla-en-vivo-vercel-sin-servidores-propios).
2. **GitHub Actions** (gratis, complementa a Vercel). La repo incluye [`auto-update.yml`](../.github/workflows/auto-update.yml), que llama a los endpoints de actualización **cada 6 horas**. Para activarlo, en GitHub ve a **Settings → Secrets and variables → Actions** y crea dos secrets: `APP_URL` (la URL pública de tu app) y `CRON_SECRET` (el mismo valor que configuraste en la app). Sin esos secrets el workflow no hace nada.
3. **Un cron externo** apuntando a tu instancia: cualquier servicio de tareas programadas (cron de un servidor, cron-job.org) que haga `POST /api/legal/poll` con el header `x-api-key` (definiendo un `LEGAL_POLL_API_KEY` propio en `.env`). Requiere que la aplicación esté accesible desde internet.

### ¿Y es "en vivo"?

No en sentido estricto: es una **revisión periódica** (cada 6 horas local, diaria en Vercel, cada 6 horas con GitHub Actions). Para este caso de uso es suficiente — la tramitación legislativa se mueve en días, no en segundos — y evita saturar la API pública del Senado.

| Escenario | ¿Se actualiza sola? | Frecuencia por defecto |
|-----------|--------------------|------------------------|
| Corriendo en tu computador (`bun run dev`) | ✅ Sí, mientras esté prendida | Cada 6 h (`AUTO_UPDATE_INTERVAL_HOURS`) |
| Publicada en Vercel | ✅ Sí, 24/7 | Diaria (`vercel.json`) |
| Vercel/servidor + GitHub Actions | ✅ Sí, 24/7 | Cada 6 h (`auto-update.yml`) |

---

## Problemas frecuentes

- **"docker: command not found" o el instalador dice que falta Docker** → Docker Desktop no está abierto. Ábrelo, espera a que la ballena deje de "cargar" y vuelve a intentar.
- **"bun: command not found" justo después de instalar Bun** → cierra la terminal y ábrela de nuevo.
- **En Windows `./scripts/setup.sh` no funciona** → estás en PowerShell; abre **Git Bash** (se instaló con Git) y repite el Paso 4 ahí.
- **La página no carga en localhost:3000** → revisa que la terminal donde ejecutaste `bun run dev` siga abierta y sin errores rojos.
- **Olvidé mi contraseña** → crea otro usuario con `bun run scripts/create-user.ts` y entra con ese.
