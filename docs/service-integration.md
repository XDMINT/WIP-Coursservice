# Service-Integration

Dieses Dokument beschreibt, wie spaeter ein fachlich eigenstaendiger Service ergaenzt werden kann, ohne die aktuelle Anwendung kuenstlich aufzuteilen.

## Regeln

- `compose.yaml` bleibt der Kern fuer Traefik, Frontend, Course Service und Course PostgreSQL.
- Zusaetzliche Services werden ueber eine zusaetzliche Compose-Datei eingebunden.
- Traefik bleibt der einzige oeffentliche Einstiegspunkt.
- Interne Servicekommunikation laeuft direkt ueber Docker-DNS.
- Jeder eigenstaendige Service kontrolliert seine eigene Datenbank, Migrationen und Repositories.
- Kein Service greift direkt auf Tabellen oder Datenbankverbindungen eines anderen Services zu.
- Gleiche interne Container-Ports sind erlaubt. Entscheidend ist der Docker-Service-Name.
- Leere Serviceverzeichnisse oder hypothetischer Anwendungscode werden nicht angelegt.

## Start mit Erweiterung

```sh
docker compose \
  -f compose.yaml \
  -f compose.group-task.yaml \
  up --build
```

## Beispiel fuer einen spaeteren Group/Task Service

Das Beispiel ist bewusst Dokumentation und keine aktive Konfiguration. Es setzt voraus, dass ein echtes Image oder echter Code fuer `group-task-service` existiert.

```yaml
services:
  group-task-service:
    image: example/group-task-service:latest
    environment:
      PORT: "8080"
      DATABASE_HOST: group-task-postgres
      DATABASE_PORT: "5432"
      DATABASE_NAME: "${GROUP_TASK_DB_NAME:-group_tasks}"
      DATABASE_USER: "${GROUP_TASK_DB_USER:-group_tasks}"
      DATABASE_PASSWORD: "${GROUP_TASK_DB_PASSWORD}"
      COURSE_SERVICE_URL: "http://backend:3000"
    depends_on:
      group-task-postgres:
        condition: service_healthy
    networks:
      - proxy-network
      - group-task-internal
    labels:
      traefik.enable: "true"
      traefik.docker.network: "coursservice-proxy-network"
      traefik.http.routers.group-task.rule: "PathPrefix(`/api/groups`) || PathPrefix(`/api/tasks`)"
      traefik.http.routers.group-task.entrypoints: "web"
      traefik.http.routers.group-task.priority: "110"
      traefik.http.services.group-task.loadbalancer.server.port: "8080"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1"]
      interval: 10s
      timeout: 3s
      retries: 10

  group-task-postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: "${GROUP_TASK_DB_NAME:-group_tasks}"
      POSTGRES_USER: "${GROUP_TASK_DB_USER:-group_tasks}"
      POSTGRES_PASSWORD: "${GROUP_TASK_DB_PASSWORD}"
    volumes:
      - group-task-postgres-data:/var/lib/postgresql/data
    networks:
      - group-task-internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  group-task-postgres-data:

networks:
  proxy-network:
    external: true
    name: coursservice-proxy-network
  group-task-internal:
    internal: true
```

## Interne URLs

Der aktuelle Course Service ist im gemeinsamen Proxy-Netzwerk unter folgendem Docker-DNS-Namen erreichbar:

```env
COURSE_SERVICE_URL=http://backend:3000
```

Ein spaeterer Service darf intern ebenfalls Port `3000` oder `8080` verwenden. Das ist kein Konflikt, solange andere Container den Service ueber seinen Compose-Service-Namen ansprechen.

## Datenbesitz

Ein spaeterer Group/Task Service darf eigene Tabellen in seiner eigenen Datenbank besitzen. Der Course Service darf nicht direkt auf diese Datenbank zugreifen. Wenn Kursdaten benoetigt werden, ruft der Group/Task Service eine dokumentierte Course-Service-API auf oder nutzt spaeter eine bewusst eingefuehrte Event-Integration.

In der aktuellen Mini-Version ist die Gruppenfunktion kein separater Service.
CourseRun-Gruppen, Gruppenmitglieder, Gruppenaufgaben-Fortschritt und
Gruppenbewertungen liegen im Course Service und bleiben dort an die bestehenden
Kurs-, Aufgaben-, Fortschritts- und Assessment-Regeln gebunden.
