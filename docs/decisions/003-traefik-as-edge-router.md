# 003 Traefik als Edge Router

Status: Accepted

## Kontext

Traefik war bereits Teil der frueheren Infrastruktur. Die neue Architektur braucht weiterhin einen einzigen oeffentlichen Einstiegspunkt, aber kein fachliches API-Gateway.

## Alternativen

- Traefik beibehalten
- Wechsel zu Caddy
- Wechsel zu Nginx
- eigener Gateway-Service
- kein Reverse Proxy

## Entscheidung

Traefik bleibt als technischer Edge Router in Docker Compose.

## Begruendung

Traefik unterstuetzt den Docker Provider, Labels und klare Router-Prioritaeten. Dadurch bleibt der Migrationsaufwand klein. Ein eigener Gateway-Service waere fuer dieses Projekt unnoetige Anwendungslogik.

## Konsequenzen

Positiv: ein oeffentlicher Einstiegspunkt, keine direkten Host-Ports fuer Frontend/Backend, einfache Pfadregeln.

Negativ: Docker-Socket muss read-only eingebunden werden; Netzwerkzuordnung muss bei mehreren Netzwerken explizit sein.

## Risiken

Fehlerhafte Router-Prioritaeten koennen `/api` versehentlich ans Frontend leiten. Dies wird durch Prioritaet `100` fuer das Backend vermieden.

## Neubewertung

Bei komplexer TLS-/Middleware-Konfiguration kann eine separate dynamische Traefik-Konfiguration sinnvoll werden.
