# Política de seguridad

## Reportar una vulnerabilidad

Si encuentras una vulnerabilidad, **no abras un issue público**. Repórtala de forma privada:

- **GitHub**: pestaña **Security → Report a vulnerability** de esta repo (private vulnerability reporting).

Incluye pasos para reproducir y el impacto que observaste. Respondemos tan pronto como sea posible; al ser un proyecto open source mantenido en tiempo libre, agradecemos un plazo razonable antes de cualquier divulgación pública.

## Alcance

Aplica al código de esta repo: la app Next.js, sus endpoints (`pages/api/`), los scripts (`scripts/`) y la configuración de deploy incluida. Las plataformas externas (Vercel, Neon, Slack, OpenAI, APIs del Estado) tienen sus propios programas.

## Diseño de seguridad actual

El detalle vive en [README → Seguridad](./README.md#seguridad). En resumen: todos los endpoints de datos exigen sesión, registro abierto deshabilitado, rate limiting por usuario/IP, crons y polling fail-closed en producción, y comparaciones de secretos en tiempo constante.

## Buenas prácticas al operarlo

- Nunca definas `AUTH_PROVISION` en un servidor desplegado.
- Cambia `LEGAL_POLL_API_KEY` (el valor de fábrica se rechaza en producción).
- Define `CRON_SECRET` en Vercel; sin él los crons rechazan todo.
- No compartas tu `.env` ni lo subas a git (ya está en `.gitignore`).
