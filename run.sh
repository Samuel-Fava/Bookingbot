#!/usr/bin/env bash

/dockerstartup/kasm_startup.sh &
/dockerstartup/vnc_startup.sh &
/dockerstartup/kasm_default_profile.sh &
cd /app &
node index.js