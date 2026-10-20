# Containerbetrieb

Vom Repository-Stamm starten: `docker compose --env-file .env -f infrastructure/docker/compose.yaml up --build -d backend`.

Optional Bot: `docker compose --env-file .env -f infrastructure/docker/compose.yaml --profile discord up --build -d`.

`COMPANION_TOKEN` muss gesetzt sein. Backend ist nur an 127.0.0.1 des Hosts veröffentlicht. Der Bot teilt den Netzwerk-Namespace des Backends, damit kein Token über ein unverschlüsseltes externes Netz übertragen wird. Produktivbetrieb auf einem entfernten Server benötigt einen TLS-Reverse-Proxy; öffentliche Freigabe ist nicht vorkonfiguriert.

Der aktuelle Backend-Speicher ist SQLite (persistentes Docker-Volume), nicht PostgreSQL. Ein nicht implementierter PostgreSQL-Dienst wird daher nicht vorgetäuscht. `HOST` und der tatsächlich vom Backend gelesene Datenbankpfad müssen mit `apps/backend/src/index.ts` übereinstimmen. Docker-Image und Compose sind eingerichtet; ein realer Docker-Start hängt von einer installierten Docker-Engine ab.
