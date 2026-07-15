# Política de seguridad

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad, **no abras un issue público**. Repórtala de forma privada:

- **GitHub**: pestaña **Security → Report a vulnerability** de esta repo (private vulnerability reporting).

Incluye pasos para reproducir y el impacto que observaste. Respondemos tan pronto como sea posible; al ser un proyecto open source mantenido en tiempo libre, agradecemos un plazo razonable antes de cualquier divulgación pública.

## Alcance

Aplica al código de esta repo: la app Next.js, sus endpoints (`pages/api/`) y los scripts (`scripts/`). Las plataformas externas (Slack, OpenAI, APIs del Estado) tienen sus propios programas.

## Diseño de seguridad actual

El detalle vive en [README → Seguridad](./README.md#seguridad). En resumen: la app está diseñada para correr **local** (los datos nunca salen de tu máquina salvo que conectes Slack/OpenAI), todos los endpoints de datos exigen sesión, cada usuario solo ve sus propios proyectos y notas, hay rate limiting por usuario/IP, el polling es fail-closed en producción y las comparaciones de secretos son en tiempo constante.

El registro está cerrado salvo una ventana de una sola vez: `/signup` permite crear **la primera cuenta** de una instalación nueva sin usuarios todavía, y se cierra sola apenas esa cuenta existe. Esa ventana **nunca se abre** si `AUTH_ALLOWED_EMAIL_DOMAIN` está configurado (en ese caso el único camino es SSO de dominio verificado o `scripts/create-user.ts`). Fuera de esa ventana de arranque solo hay registro abierto si el operador lo activa explícitamente con `AUTH_OPEN_SIGNUP=1` (pensado para instalaciones compartidas de equipo).

## Buenas prácticas al operarlo

- Nunca definas `AUTH_PROVISION` fuera del proceso de `scripts/create-user.ts`.
- Si expones la app fuera de localhost, cambia `LEGAL_POLL_API_KEY` (el valor de fábrica se rechaza en producción).
- No compartas tu `.env` ni lo subas a git (ya está en `.gitignore`).
- Si compartes una instalación nueva con más gente (ej: en la red de la oficina), crea tu cuenta vía `/signup` o `create-user.ts` **antes** de compartir la dirección — la ventana de bootstrap la gana quien llegue primero.
