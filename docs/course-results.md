# Bewertungen und Noten

Der Course Service speichert Kursergebnisse pro Kurs und studentischer
Einschreibung in `course_result`. Einzelne Assignment-Bewertungen bleiben in
`grade`; das Kursergebnis ist eine aggregierte fachliche Sicht.

## Bestehensregel

Die zentrale Regel steht in `apps/backend/src/course-result.rules.ts`:

- Grenzwert: `COURSE_PASSING_THRESHOLD_PERCENT = 50`
- Vergleich: bestanden ist nur, wer mehr als 50 Prozent erreicht.
- Exakt 50 Prozent oder weniger ist nicht bestanden.

## Bewertungsquellen

`CourseResultSource` unterscheidet die Herkunft:

- `MANUAL_ENTRY`: manuell eingetragen, ohne vorherige automatische Bewertung
- `AUTOMATIC_CALCULATION`: automatisch aus finalen Assignment-Punkten berechnet
- `MANUAL_OVERRIDE`: automatische oder bereits überschreibende Bewertung wurde
  bewusst manuell überschrieben

`sourceDetails` dokumentiert die Quelle, die verwendete Regel und bei
automatischen Berechnungen die einbezogenen Assignments.

## Automatische Berechnung

Die automatische Berechnung verwendet vorhandene Daten im Course Service:

- alle Assignments des Kurses mit `isGraded = true`
- pro Studierendem nur finale Einzelbewertungen (`grade.isFinal = true`)
- fehlende finale Einzelbewertungen zählen mit 0 erreichten Punkten
- die maximale Gesamtpunktzahl ist die Summe der maximalen Punkte aller
  bewerteten Assignments

Es gibt keinen direkten Zugriff auf Datenbanken anderer Services und keinen
hypothetischen Aufgabenservice. Falls Aufgabenpunkte später aus einem anderen
Service kommen, muss die Berechnung über eine API-Grenze angebunden werden. Der
Course Service sollte dann nur fachlich notwendige Ergebnisdaten und
Quellreferenzen speichern.

Wenn keine maximale Punktzahl vorhanden ist, wird keine Division durchgeführt.
Der Prozentwert bleibt leer und der Status ist `NOT_ASSESSED`.

## Neuberechnung

Lehrende können ein einzelnes Kursergebnis oder alle Kursergebnisse eines
Kurses neu berechnen. Eine automatische Neuberechnung ersetzt den bisherigen
Kursergebnisstand durch eine neue automatische Bewertung. Eine spätere manuelle
Eingabe wird als `MANUAL_OVERRIDE` dokumentiert.
