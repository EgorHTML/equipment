# Этап сборки
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Копируем package.json и lock-файл
COPY package*.json ./

# Устанавливаем ТОЛЬКО production зависимости для кэширования
RUN npm ci --only=production && npm cache clean --force

# Копируем остальной код приложения
COPY . .

# Устанавливаем ВСЕ зависимости (включая dev для сборки)
RUN npm install --ignore-scripts # --ignore-scripts для безопасности, если нет pre/post install скриптов
# Или просто: RUN npm install

# Собираем приложение
RUN npm run build

# Этап запуска
FROM node:18-alpine
WORKDIR /usr/src/app

# Копируем package.json и production node_modules со стадии сборки
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
# Копируем собранное приложение
COPY --from=builder /usr/src/app/dist ./dist

# Указываем порт, который будет слушать приложение внутри контейнера
# Этот порт должен совпадать с тем, что указан в main.ts и docker-compose.yml (внутренний порт)
EXPOSE 3002

# Команда для запуска приложения
CMD ["npm", "run", "start:dev"]