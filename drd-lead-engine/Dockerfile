# Node 22.5+ required: the app uses the built-in node:sqlite module.
FROM node:22-alpine

WORKDIR /app

# No required runtime dependencies. The optional Anthropic SDK is installed
# only when you want live Claude calls instead of the deterministic engine.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund || true

COPY . .

# The database lives on a mounted volume so it survives redeploys.
ENV DRD_DB_PATH=/data/drd.db \
    NODE_ENV=production \
    DRD_PUBLIC=1 \
    PORT=8080 \
    HOST=0.0.0.0 \
    NODE_NO_WARNINGS=1
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.js"]
