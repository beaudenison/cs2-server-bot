#!/bin/sh
set -e

# Ensure data directory exists (named volume)
mkdir -p /data

exec node bot.js
