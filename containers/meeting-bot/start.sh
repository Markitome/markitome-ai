#!/usr/bin/env bash
set -euo pipefail

Xvfb "${DISPLAY}" -screen 0 1280x720x24 -nolisten tcp &

pulseaudio --daemonize=yes --exit-idle-time=-1 --log-level=warning || true
pactl load-module module-null-sink sink_name=meetingbot sink_properties=device.description=meetingbot >/dev/null 2>&1 || true
pactl set-default-sink meetingbot >/dev/null 2>&1 || true

node /app/src/server.js
