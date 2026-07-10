# Traefik

Die aktive Traefik-Konfiguration liegt bewusst direkt in `compose.yaml`, weil die Routingregeln klein sind:

- `/api` und `/api/*` gehen an den aktuellen Backend-/Course-Service.
- Alle anderen Pfade gehen an das Frontend.
- `providers.docker.exposedByDefault=false` ist aktiv.
- Das Dashboard ist deaktiviert.
- Traefik nutzt fuer anwendungsnahe Services das gemeinsame Docker-Netzwerk `coursservice-proxy-network`.

Eine separate dynamische Traefik-Konfiguration sollte erst entstehen, wenn wiederverwendbare Middlewares, TLS-Optionen oder mehrere Router-Gruppen die Lesbarkeit in `compose.yaml` verschlechtern.
