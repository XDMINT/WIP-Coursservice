# 001 Modularer Monolith

Status: Accepted

## Kontext

Das Projekt wird als Abschlussprojekt von einer Person weiterentwickelt. Die vorherige Microservice-Idee erzeugte Betriebs-, Netzwerk- und Deployment-Komplexitaet ohne aktuell belegten fachlichen Nutzen.

## Alternativen

- Microservices beibehalten
- modularer Monolith
- unstrukturierter Monolith

## Entscheidung

Das Backend wird als modularer Monolith betrieben.

## Begruendung

Ein gemeinsamer Backend-Prozess reduziert lokale Entwicklungs- und Betriebsaufwaende, vereinfacht Debugging und Transaktionen und passt zur Projektgroesse. Fachliche Grenzen bleiben im Code sichtbar und koennen spaeter bei echtem Bedarf herausgeloest werden.

## Konsequenzen

Positiv: weniger Infrastruktur, reproduzierbarer Start, einfacheres Debugging, keine kuenstliche interne HTTP-Kommunikation.

Negativ: Modulgrenzen muessen bewusst im Code gepflegt werden; Skalierung erfolgt zunaechst pro Gesamtbackend.

## Risiken

Der bestehende Kursservice ist gross und sollte weiter in interne Provider zerlegt werden.

## Neubewertung

Wenn mehrere Teams unabhaengig deployen muessen oder einzelne Module eigene Betriebsanforderungen haben, kann eine Service-Aufteilung neu bewertet werden.
