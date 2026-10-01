#!/bin/sh
set -eu
curl -fsS http://127.0.0.1:8080/health >/dev/null
date -u +"%Y-%m-%dT%H:%M:%SZ health ok" >> /app/.generated/cron-heartbeat.log
