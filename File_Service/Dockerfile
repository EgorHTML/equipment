FROM node:18-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

FROM base AS dev
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --only=production
COPY --from=builder /usr/src/app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]