# Guía de instalación paso a paso (para personas no técnicas)

Esta guía explica cómo instalar y usar Radar Legislativo **sin saber programar**. Si ya sabes usar una terminal, el [README](../README.md) tiene la versión corta.

> 🤖 **Atajo**: si tienes Claude Code (u otro asistente de IA de código), puedes pedirle que instale todo por ti conversando — el paso a paso con el prompt listo está en **[Instalar con Claude Code](./INSTALAR-CON-CLAUDE.md)**.

## ¿De verdad necesito instalar algo?

Sí: Radar Legislativo **corre en tu propio computador** — así tus notas, tus proyectos seguidos y tus usuarios nunca salen de tu máquina. Para eso necesitas tres programas gratuitos: **Docker Desktop**, **Git** y **Bun**. Esta guía te lleva de la mano por cada uno. Ninguno es opcional:

- **Bun** es el "motor" que ejecuta el código de la aplicación.
- **Docker** ejecuta la **base de datos** (PostgreSQL), donde se guardan los proyectos, audiencias y usuarios.
- **Git** sirve para descargar el código (y en Windows, además instala la terminal que necesita el instalador).

La buena noticia: la instalación es **una sola vez** y el instalador hace prácticamente todo solo, incluyendo descargar los datos iniciales (audiencias de lobby y el catálogo de proyectos de ley).

> ☁️ ¿Quieres además que **tu** radar funcione 24/7, aunque tu computador esté apagado? Puedes desplegar **tu propia copia** en la nube con cuentas gratuitas que tú controlas — ver [README → Desplegar tu propia copia](../README.md#desplegar-tu-propia-copia-en-la-nube-vercel--neon-opcional). No es obligatorio: la instalación local de esta guía es autosuficiente.

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

El instalador hace todo solo: levanta la base de datos, crea la configuración, aplica las migraciones, **carga las audiencias de lobby de los últimos 2 años** (para que la pestaña Lobby ya tenga datos; tarda 1-2 minutos, una sola vez), **deja cargando el catálogo de proyectos de ley en segundo plano** (para el buscador de la pestaña Investigación; tarda 10-30 minutos la primera vez, pero puedes usar la app mientras tanto) y **enciende el portal abriendo tu navegador automáticamente**. No tienes que escribir nada más en la terminal.

Lo primero que verás en el navegador es una pantalla para **crear tu cuenta**: escribe tu nombre, un email y una contraseña (mínimo 8 caracteres), presiona "Crear cuenta" y entras directo al portal. 🎉

> 💡 Si el navegador no se abre solo (algunos computadores lo bloquean), abre tú mismo <http://localhost:3000/signup> y verás la misma pantalla de crear cuenta. El registro queda **abierto**: si comparten la instalación, cada colega crea su propia cuenta ahí mismo y **cada cuenta ve solo sus propios proyectos y notas**. (Si prefieres cerrarlo, pon `AUTH_OPEN_SIGNUP=0` en el archivo `.env` y reinicia la app.)

## Uso diario

- **Apagar**: vuelve a la terminal y presiona `Ctrl + C`.
- **Volver a usarla otro día**: abre Docker Desktop, abre la terminal y ejecuta:

  ```bash
  cd Radar-legislativo
  bun run dev:open
  ```

  (`dev:open` abre el navegador solo; si prefieres abrirlo tú, usa `bun run dev`.)

- **Cuentas para colegas**: no necesitas hacer nada — cada colega entra a <http://localhost:3000/signup> (o a la dirección de la instalación compartida) y **crea su propia cuenta**. Cada cuenta ve solo sus propios proyectos y notas. Si cerraste el registro (`AUTH_OPEN_SIGNUP=0` en `.env`), créalas tú por terminal:

  ```bash
  bun run scripts/create-user.ts colega@email.com 'una-clave-segura' 'Nombre Colega'
  ```

## Recorrido por la interfaz

- **Inicio**: resumen ejecutivo (cuántos proyectos sigues, cuántas audiencias hay, cambios y alertas) y atajos.
- **Tu logo**: pasa el mouse sobre el ícono del encabezado y pulsa el lápiz para subir el logotipo de tu organización (PNG, JPG o WebP, hasta 2 MB) — el portal queda personalizado para todo tu equipo. La X lo quita.
- **Proyectos**: tu radar. Agrega proyectos con el botón **"Agregar Proyecto"** (necesitas el [boletín](./GLOSARIO.md#boletín)); cada proyecto tiene página de detalle con su historial de cambios (snapshots) y un botón **"Actualizar del Senado"** para consultarlo al instante.
- **Lobby**: tres sub-pestañas — **Explorador** (busca audiencias por institución, cargo, fecha o texto), **Cruces** (quién se reúne con quién: institución ↔ organización/persona) y **Agente IA** (pregúntale en lenguaje natural; requiere `OPENAI_API_KEY`). El botón **"Sincronizar Lobby"** trae audiencias nuevas.
- **Investigación**: buscador sobre el catálogo de proyectos del Senado (el instalador lo carga solo y la app le va sumando los proyectos nuevos) + un agente de IA que analiza tus proyectos y, si se lo pides, **envía alertas a Slack**.
- **Cambios detectados** (`/legal/changes`, atajo en Inicio): historial completo de cambios en tus proyectos, filtrable por prioridad y período.

---

## ¿Los datos se actualizan solos?

**Sí — mientras la aplicación esté prendida.** La app trae un actualizador integrado: cada **6 horas** consulta al Senado por los proyectos en seguimiento, sincroniza las audiencias de lobby y suma al buscador los **proyectos de ley nuevos** que van entrando al Congreso, sin que hagas nada. Además, al arrancarla revisa si los datos llevan mucho tiempo sin refrescarse y los pone al día a los pocos minutos.

Dos cosas que conviene entender:

- La app solo puede actualizarse **mientras está corriendo** (Docker Desktop abierto + `bun run dev` andando). Si el computador está apagado o cerraste la terminal, no pasa nada hasta que la vuelvas a abrir — y al abrirla, se pone al día sola.
- Puedes cambiar la frecuencia editando `AUTO_UPDATE_INTERVAL_HOURS` en el archivo `.env` (número de horas; `0` la desactiva).

Los botones "Actualizar" de la interfaz solo refrescan lo que ya está guardado en tu base de datos; la actualización de verdad la hace el actualizador integrado (o las opciones de abajo).

### Actualizar a mano, sin esperar el ciclo

Con la aplicación corriendo (`bun run dev`):

- **Audiencias de lobby**: en la pestaña **Lobby** de la aplicación hay un botón de **sincronizar** que trae las audiencias nuevas.
- **Un proyecto puntual**: botón **"Actualizar del Senado"** en su página de detalle.
- **Todos los proyectos de ley** (estados, urgencias, cambios): abre una **segunda terminal** y ejecuta:

  ```bash
  curl -X POST http://localhost:3000/api/legal/poll -H "x-api-key: change-me-in-production"
  ```

  Esto consulta el Senado por cada proyecto en seguimiento, detecta cambios y —si configuraste Slack— envía las alertas. (La clave `change-me-in-production` es la de fábrica; solo sirve en tu computador, en producción se exige cambiarla.)
- **Buscador de proyectos del Senado** (el instalador ya lo cargó; esto es para recargarlo o ampliar la historia):

  ```bash
  bun run scripts/bulk-sync.ts
  ```

  ⏱️ Este demora varios minutos (consulta ~1500 proyectos respetando la API pública). Puedes interrumpirlo con `Ctrl + C` y retomarlo después.
- **Audiencias de lobby por terminal** (equivalente al botón de la app):

  ```bash
  bun run scripts/sync-lobby.ts --months 6
  ```

### ¿Y si mi computador estuvo apagado unos días?

No pasa nada: los datos no se pierden ni se "vencen". La próxima vez que enciendas la app, el actualizador nota que los datos están atrasados y **se pone al día solo a los pocos minutos** (proyectos, lobby y boletines nuevos). Lo único que no existe con el computador apagado son las alertas de Slack de esos días — los cambios igual quedan registrados y los ves al volver.

### Actualización 24/7 (aunque tu computador esté apagado)

Si quieres que **tu** radar se actualice siempre, la opción es desplegar **tu propia copia** en la nube (tú controlas las cuentas; nadie hostea nada por ti):

1. **Tu propia copia en Vercel** (recomendado). El archivo [`vercel.json`](../vercel.json) trae tres tareas programadas **diarias**: proyectos de ley (12:00 UTC), lobby (07:00 UTC) y catálogo de boletines (08:00 UTC). El paso a paso está en [README → Desplegar tu propia copia](../README.md#desplegar-tu-propia-copia-en-la-nube-vercel--neon-opcional).
2. **GitHub Actions** (gratis, complementa lo anterior). La repo incluye [`auto-update.yml`](../.github/workflows/auto-update.yml), que llama a los endpoints de actualización **cada 6 horas**. Para activarlo, en **tu fork** ve a **Settings → Secrets and variables → Actions** y crea dos secrets: `APP_URL` (la URL de tu copia desplegada) y `CRON_SECRET` (el mismo valor que configuraste en Vercel). Sin esos secrets el workflow no hace nada.
3. **Un cron externo** apuntando a tu instancia: cualquier servicio de tareas programadas que haga `POST /api/legal/poll` con el header `x-api-key` (definiendo un `LEGAL_POLL_API_KEY` propio). Requiere que tu copia esté accesible desde internet.

### ¿Y es "en vivo"?

No en sentido estricto: es una **revisión periódica** (cada 6 horas local, diaria en un deploy en Vercel, cada 6 horas con GitHub Actions). Para este caso de uso es suficiente — la tramitación legislativa se mueve en días, no en segundos — y evita saturar la API pública del Senado.

| Escenario | ¿Se actualiza sola? | Frecuencia por defecto |
|-----------|--------------------|------------------------|
| Corriendo en tu computador (`bun run dev`) | ✅ Sí, mientras esté prendida | Cada 6 h (`AUTO_UPDATE_INTERVAL_HOURS`) |
| Tu copia desplegada en Vercel | ✅ Sí, 24/7 | Diaria (`vercel.json`) |
| Tu copia + GitHub Actions | ✅ Sí, 24/7 | Cada 6 h (`auto-update.yml`) |

---

## Recomendaciones de seguridad (en simple)

La aplicación viene protegida por diseño: nadie puede ver nada sin usuario y contraseña, y **cada cuenta ve únicamente sus propios proyectos y notas** — por eso el registro puede venir abierto sin riesgo (quien cree una cuenta parte con su espacio vacío, no con tu trabajo). Si igual prefieres que nadie más pueda registrarse, pon `AUTH_OPEN_SIGNUP=0` en el archivo `.env` y reinicia. Pero la seguridad también depende de cómo la uses. Estas son las reglas de oro, sin tecnicismos:

### Cuentas y contraseñas

1. **Una cuenta por persona, nunca compartidas.** Dentro de la aplicación **todos los usuarios pueden ver, editar y borrar todo** (no hay "roles" ni permisos parciales). Crea cuentas solo para personas de tu confianza directa.
2. **Contraseñas largas y únicas** (idealmente una frase de 4+ palabras, o generada por un gestor de contraseñas como 1Password o Bitwarden). Nunca reutilices la contraseña de tu correo.
3. **Cuando alguien deja el equipo, elimina su cuenta el mismo día:**

   ```bash
   bun run scripts/delete-user.ts expersona@email.com
   ```

   Eso cierra sus sesiones abiertas y revoca su acceso al instante.
4. Si tu organización usa Google Workspace, **activa el login con Google** ([README → Google SSO](../README.md#google-sso-opcional)): menos contraseñas que administrar y solo entra gente de tu dominio.

### El archivo `.env` es la llave maestra

Dentro de la carpeta del proyecto hay un archivo llamado `.env` que contiene los secretos de la aplicación. **Trátalo como la llave de tu oficina**: no lo envíes por correo ni WhatsApp, no lo subas a carpetas compartidas (Drive/Dropbox), no se lo muestres a nadie que no lo necesite. Si crees que alguien lo vio, cambia el valor de `BETTER_AUTH_SECRET` por uno nuevo (genera otro con `openssl rand -base64 32`) — eso cierra todas las sesiones abiertas de inmediato.

### En tu computador

- **Bloquea la pantalla** cuando te levantes (la app queda con sesión iniciada en tu navegador).
- No la instales en computadores compartidos sin que cada persona tenga su propia sesión de sistema.
- **Respalda tus datos** cada cierto tiempo ([cómo hacerlo](#respaldar-tus-datos)) y guarda el respaldo en un lugar seguro: tus notas y prioridades son estrategia de tu estudio.

### Si conectas servicios externos (Slack / OpenAI)

- Si configuraste la IA (`OPENAI_API_KEY`), ponle un **límite de gasto mensual** en tu cuenta de OpenAI (Settings → Limits): cualquier usuario de tu instalación puede usar los chats, y los chats cuestan dinero.
- Recuerda que con Slack/OpenAI configurados, **parte de la información viaja a esos servicios** (detalle en [README → Costos y privacidad](../README.md#costos-y-privacidad)). Sin esas keys, nada sale de tu computador.

### Si despliegas tu propia copia en internet (Vercel)

- Usa siempre la dirección **https://** (Vercel la entrega automáticamente — nunca configures un dominio sin candado).
- Define `CRON_SECRET` y cambia `LEGAL_POLL_API_KEY` por textos largos e impredecibles (la app **rechaza** el valor de fábrica en producción, no lo dejes pasar).
- Crea tu cuenta en `/signup` **antes** de compartir la URL con nadie (la ventana de la primera cuenta la gana quien llegue primero).
- Recuerda el modelo: es **tu** copia, en **tus** cuentas de Vercel y Neon. Si compartes la URL con tu equipo, activa `AUTH_OPEN_SIGNUP=1` para que cada uno tenga su cuenta (cada cuenta ve solo lo suyo).

### Mantente al día

Las actualizaciones traen también correcciones de seguridad. Una vez al mes, ejecuta los tres comandos de [Actualizar la aplicación](#actualizar-la-aplicación-a-una-versión-nueva). Y si descubres algo que parezca una falla de seguridad, repórtala en privado siguiendo [SECURITY.md](../SECURITY.md).

---

## Operación del día a día

### Respaldar tus datos

Tus proyectos, notas y prioridades viven en la base de datos local. Para respaldarlos (con Docker Desktop abierto):

```bash
docker compose exec db pg_dump -U postgres postgres > respaldo-radar.sql
```

Eso crea un archivo `respaldo-radar.sql` con TODO (guárdalo donde respaldas tus documentos). Para restaurarlo en una instalación nueva:

```bash
docker compose exec -T db psql -U postgres postgres < respaldo-radar.sql
```

### Actualizar la aplicación a una versión nueva

Cuando la repo tenga mejoras y quieras traerlas:

```bash
cd Radar-legislativo
git pull
bun install
bun run db:migrate
```

y vuelve a arrancarla con `bun run dev`. Tus datos no se tocan (las migraciones solo agregan estructura).

### Desinstalar

1. Apaga la app (`Ctrl + C`) y la base de datos: `docker compose down`
   - Si además quieres **borrar los datos**: `docker compose down -v` (destruye el respaldo automático — haz un `pg_dump` antes si te importa)
2. Borra la carpeta `Radar-legislativo`.
3. (Opcional) Desinstala Docker Desktop y Bun como cualquier programa.
4. Si desplegaste tu propia copia: borra el proyecto en Vercel y la base en Neon desde sus dashboards.

### Glosario

¿Qué es un boletín, la relevancia HIGH o un snapshot? → **[docs/GLOSARIO.md](./GLOSARIO.md)** explica cada término y su efecto en la herramienta.

## Problemas frecuentes

- **"docker: command not found" o el instalador dice que falta Docker** → Docker Desktop no está abierto. Ábrelo, espera a que la ballena deje de "cargar" y vuelve a intentar.
- **"bun: command not found" justo después de instalar Bun** → cierra la terminal y ábrela de nuevo.
- **En Windows `./scripts/setup.sh` no funciona** → estás en PowerShell; abre **Git Bash** (se instaló con Git) y repite el Paso 4 ahí.
- **La página no carga en localhost:3000** → revisa que la terminal donde ejecutaste `bun run dev` siga abierta y sin errores rojos.
- **Olvidé mi contraseña** → crea otro usuario con `bun run scripts/create-user.ts` y entra con ese.
