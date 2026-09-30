FROM node:22-alpine AS build

WORKDIR /app/publisher

COPY publisher/package*.json ./
RUN npm ci

COPY publisher ./
COPY frontend /app/frontend

RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS production

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /app/publisher/package*.json ./
COPY --from=build --chown=node:node /app/publisher/node_modules ./node_modules
COPY --from=build --chown=node:node /app/publisher/.next ./.next

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
