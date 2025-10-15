# Multi-stage build to run the telegram-bot subdirectory

FROM node:20-alpine AS base
WORKDIR /app

# Copy only package files first for better caching
COPY telegram-bot/package*.json ./telegram-bot/
WORKDIR /app/telegram-bot
RUN npm ci --omit=dev

# Copy the rest of the app
WORKDIR /app
COPY telegram-bot ./telegram-bot

WORKDIR /app/telegram-bot

# Expose nothing (bot runs as a worker)

ENV NODE_ENV=production

CMD ["node", "main.js"]


