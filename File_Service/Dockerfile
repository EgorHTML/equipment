FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./

# Устанавливаем ТОЛЬКО production зависимости для кэширования
RUN npm ci --only=production && npm cache clean --force

COPY . .

# Устанавливаем ВСЕ зависимости (включая dev для сборки)
RUN npm install

RUN npm run build

FROM node:18-alpine
WORKDIR /usr/src/app

# Копируем package.json и production node_modules со стадии сборки
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
# Копируем собранное приложение
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3001

CMD ["npm", "run", "start:dev"]