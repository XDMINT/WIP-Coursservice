# 004 PostgreSQL Persistence

Status: Accepted

## Kontext

Der alte Compose-Stand nutzte MySQL fuer den Kursservice. Der aktuelle Course Service benoetigt eine eigene PostgreSQL-Instanz. Spaetere fachlich eigenstaendige Services duerfen eigene PostgreSQL-Instanzen besitzen.

## Alternativen

- PostgreSQL
- MySQL beibehalten
- In-Memory-Datenbank
- eine gemeinsame Datenbank fuer alle Services
- eine Datenbank pro eigenstaendigem Service

## Entscheidung

PostgreSQL ist die relationale Datenbanktechnologie. Der Course Service nutzt `course-postgres`. Spaetere eigenstaendige Services folgen einem Database-per-Service-Ansatz.

## Begruendung

PostgreSQL bietet Transaktionen, Constraints, JSON-Unterstuetzung und gute Docker-Unterstuetzung. Eine eigene Datenbank pro eigenstaendigem Service erhaelt Datenbesitz und verhindert direkte Kopplung ueber Tabellen fremder Services.

## Konsequenzen

Positiv: reproduzierbare Migrationen, klare lokale Datenhaltung und klare Datenverantwortung pro Service.

Negativ: Serviceuebergreifende Auswertungen muessen ueber APIs oder spaeter bewusst eingefuehrte Events geloest werden. MySQL-spezifische Entity-Details mussten bereinigt werden; bestehende Daten muessten bei Bedarf migriert werden.

## Risiken

Die aktuelle Initialmigration ist neu. Falls produktive MySQL-Daten existieren, braucht es eine separate Datenmigration. Bei spaeteren Services muessen Datenbesitz und API-Grenzen konsequent eingehalten werden.

## Neubewertung

Wenn ein spaeterer Service keine echte fachliche Eigenstaendigkeit besitzt, soll er nicht als separater Service mit eigener Datenbank eingefuehrt werden.
