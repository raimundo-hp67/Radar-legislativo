# Instalar con Claude Code (que la IA lo haga por ti)

¿No quieres pelear con la terminal? Esta guía es para instalar Radar Legislativo **conversando con un asistente de IA** que ejecuta los comandos por ti. Está escrita para [Claude Code](https://claude.com/claude-code), pero funciona igual con Codex, Cursor u otro agente de código: la repo incluye instrucciones internas (`AGENTS.md` / `CLAUDE.md`) que cualquiera de ellos lee automáticamente.

> ¿Prefieres hacerlo tú a mano, paso a paso? Usa la [guía de instalación clásica](./INSTALACION.md).

## La idea en 30 segundos

1. Instalas **dos programas** una sola vez: Docker Desktop y Claude Code.
2. Abres Claude Code y le pegas **un prompt** (te lo damos listo más abajo).
3. Claude descarga la repo, corre el instalador, resuelve los problemas que aparezcan y te abre el navegador para crear tu cuenta.

De ahí en adelante, cualquier cosa que necesites (actualizar, cargar datos, respaldar, entender un error) también se la pides conversando.

---

## Paso 1 — Instalar Docker Desktop (única instalación "a mano")

Docker ejecuta la base de datos donde se guardan tus proyectos y las audiencias. Los asistentes no pueden instalarlo por ti porque es una aplicación con ventanas:

1. Descárgalo de <https://www.docker.com/products/docker-desktop/> e instálalo como cualquier programa.
   - **Mac**: elige "Apple Silicon" si tu Mac es de 2021 o posterior; "Intel" si es más antiguo.
2. Ábrelo. Puedes saltarte la creación de cuenta ("Skip" / "Continue without signing in").
3. Listo cuando veas la ballena 🐳 quieta en la barra del sistema.

> ⚠️ Docker Desktop debe estar **abierto** cada vez que uses el Radar. Si reinicias el computador, ábrelo de nuevo.

## Paso 2 — Instalar Claude Code

Necesitas una cuenta de Claude (el plan de pago incluye Claude Code). Instrucciones oficiales siempre actualizadas en <https://claude.com/claude-code>; el camino corto:

- **Mac**: abre la Terminal (`Cmd + espacio` → escribe "Terminal") y pega:

  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

- **Windows**: abre PowerShell (tecla Windows → escribe "PowerShell") y pega:

  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```

Cierra la terminal, ábrela de nuevo y escribe `claude`. La primera vez te pedirá iniciar sesión con tu cuenta — sigue las instrucciones en pantalla y ya está.

## Paso 3 — Pedirle a Claude que instale todo

En la terminal, con Docker Desktop abierto:

```bash
claude
```

Y cuando aparezca el asistente, **pega este prompt tal cual**:

```text
Quiero instalar Radar Legislativo, una app open source para seguir proyectos
de ley y lobby en Chile. No sé programar, así que hazlo todo tú y explícame
en simple lo que vas haciendo:

1. Clona https://github.com/raimundo-hp67/Radar-legislativo.git en esta
   carpeta y entra a ella.
2. Revisa que estén las herramientas necesarias (Bun, Git, Docker corriendo).
   Si falta Bun, instálalo tú. Si Docker no está corriendo, avísame para
   abrirlo yo.
3. Corre el instalador (scripts/setup.sh) y supervísalo: descarga las
   audiencias de lobby y deja cargando el catálogo de proyectos en segundo
   plano. Si algo falla, diagnostícalo y arréglalo o dime en simple qué
   necesitas de mí.
4. Cuando el portal esté corriendo, confírmame que puedo abrir
   http://localhost:3000/signup para crear mi cuenta.

Importante: no borres nada fuera de la carpeta del proyecto y avísame antes
de cualquier acción que no se pueda deshacer.
```

Claude te irá pidiendo permiso antes de ejecutar comandos (verás botones o preguntas de "¿permitir?"). Di que sí a lo que sea dentro de la carpeta del proyecto. Al final se abrirá el navegador en la pantalla de **crear tu cuenta**: nombre, email, contraseña, y adentro.

> ⏱️ Tiempos normales: instalador 2-4 min, descarga de audiencias 3-6 min, catálogo del buscador 10-30 min **en segundo plano** (puedes usar la app mientras). No cierres la terminal ni presiones `Ctrl + C` durante las descargas — si lo haces por accidente, no se pierde nada: pídele a Claude "retoma la carga de datos que quedó a medias".

## Prompts útiles para el día a día

Abre `claude` dentro de la carpeta `Radar-legislativo` y pide lo que necesites en tus palabras. Ejemplos que funcionan bien:

| Quieres… | Pégale a Claude |
|---|---|
| Prender la app otro día | "Levanta Radar Legislativo y ábreme el portal en el navegador." |
| Traer mejoras nuevas de la repo | "Actualiza la app a la última versión: git pull, dependencias y migraciones, y comprueba que arranca bien." |
| Cargar/completar datos | "Corre la sincronización de audiencias de lobby de los últimos 24 meses y espera a que termine completa." |
| Crear cuenta a un colega (si cerraste el registro) | "Crea un usuario para maria@miestudio.cl con una contraseña segura y dímela." |
| Respaldar tus datos | "Haz un respaldo de la base de datos en un archivo .sql y dime dónde quedó." |
| Entender un error | Pega el texto completo del error y agrega: "¿qué significa esto y cómo lo arreglo?" |
| Apagar todo | "Apaga la app y la base de datos." |

**La regla de oro cuando algo falla**: copia TODO lo que salió en la terminal (aunque sea largo y parezca chino) y pégaselo a Claude. Con el texto completo casi siempre puede diagnosticar y arreglar solo; con un resumen tuyo ("me tiró un error rojo"), no.

## Preguntas frecuentes

- **¿Esto es seguro? ¿Qué puede hacer Claude en mi computador?** Claude Code te pide permiso antes de ejecutar comandos y tú ves cada uno. El prompt de arriba además le pide explícitamente no tocar nada fuera de la carpeta del proyecto y avisarte antes de acciones irreversibles.
- **¿Sirve con Codex o Cursor?** Sí — el mismo prompt del Paso 3 funciona: la repo trae `AGENTS.md` con las convenciones del proyecto y cualquier agente de código lo lee solo.
- **¿Necesito pagar algo?** Radar Legislativo es gratis. Claude Code requiere una suscripción de Claude; Docker Desktop y Bun son gratuitos. Nada más.
- **¿Y mis datos?** Todo queda en tu computador (base de datos local). Claude solo ejecuta los comandos de instalación y mantención; tus proyectos y notas no se suben a ninguna parte.
- **La ventana donde corre la app, ¿la puedo cerrar?** La app corre mientras esa terminal esté abierta. Ciérrala (o `Ctrl + C`) y la app se apaga; los datos quedan guardados y vuelven al prenderla de nuevo.
