#!/data/data/com.termux/files/usr/bin/bash

PGDATA="$PREFIX/var/lib/postgresql"
PGLOG="$PGDATA/logfile"

if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
    echo "AUREX PostgreSQL is already running."
else
    echo "Starting AUREX PostgreSQL..."
    pg_ctl -D "$PGDATA" -l "$PGLOG" start
fi

pg_isready -h 127.0.0.1 -p 5432
