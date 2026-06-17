FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 4040

ENV NODE_ENV=production
ENV PORT=4040

USER node

CMD ["node", "server.js"]
