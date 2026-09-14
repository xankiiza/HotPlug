FROM node:20-bookworm

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 \
    libxshmfence1 libgtk-3-0 libx11-xcb1 libxdamage1 libxfixes3 libxrandr2 \
    ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install chromium

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8787
ENV HOTPLUG_HOST=0.0.0.0

EXPOSE 8787
CMD ["npm", "start"]
