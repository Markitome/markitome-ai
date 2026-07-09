FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    pulseaudio \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY start.sh ./start.sh
RUN chmod +x /app/start.sh

ENV PORT=8080
ENV DISPLAY=:99
ENV CHROME_PATH=/usr/bin/chromium

CMD ["/app/start.sh"]
