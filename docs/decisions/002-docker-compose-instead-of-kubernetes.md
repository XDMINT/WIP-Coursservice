# 002 Docker Compose statt Kubernetes

Status: Accepted

## Kontext

Kubernetes war fuer eine groessere Microservice-Architektur vorgesehen. Das aktuelle Projekt benoetigt einen reproduzierbaren lokalen und demonstrationsfaehigen Betrieb mit wenigen Komponenten.

## Alternativen

- Kubernetes
- Docker Compose
- rein manueller lokaler Betrieb

## Entscheidung

Docker Compose ist die Standard-Betriebsform.

## Begruendung

Compose startet Traefik, Frontend, Backend und PostgreSQL reproduzierbar mit geringerer Komplexitaet als Kubernetes. Fuer das Abschlussprojekt reicht diese Orchestrierung aus.

## Konsequenzen

Positiv: einfache Demo, klare Services, weniger Dateien, geringere Einstiegshuerde.

Negativ: keine Kubernetes-spezifischen Skalierungs- und Rollout-Funktionen.

## Risiken

Produktionsbetrieb auf mehreren Hosts waere mit Compose nicht ausreichend abgedeckt.

## Neubewertung

Bei echtem Multi-Host-Betrieb, hoher Skalierungsanforderung oder Team-Deployment-Prozessen kann Kubernetes wieder geprueft werden.
