# OCADE relay.
#
# The relay has NO dependencies — it is stock Node and one file — so there is no
# npm install step, no lockfile to drift, and no third-party code in the image.
# That is the point: the relay is the one component an attacker reaches without
# credentials, so its attack surface is kept as close to zero as possible.
FROM node:22-alpine

# Run as the image's existing unprivileged user. The relay binds a high port and
# writes nothing to disk, so it never needs root.
USER node
WORKDIR /app

COPY --chown=node:node server.mjs ./

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0

EXPOSE 8787

# Liveness only: /health touches no client state and reveals no room or client
# id, so exposing it to an orchestrator leaks nothing.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form so SIGTERM reaches Node directly and the shutdown handler can close
# live SSE streams instead of having them severed.
CMD ["node", "server.mjs"]
