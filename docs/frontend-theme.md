# Frontend Theme

Das Frontend nutzt das Vuetify-Theme-System als einzige Theme-Infrastruktur.
Es gibt keinen komponentenweiten Dark-Mode-Sonderpfad und keinen manuellen
Theme-Schalter.

## Zentrale Stellen

- `apps/frontend/src/plugins/vuetify.ts` definiert die Themes `ewillLight` und
  `ewillDark`.
- `apps/frontend/src/services/theme.service.ts` liest
  `window.matchMedia('(prefers-color-scheme: dark)')`, setzt das aktive
  Vuetify-Theme und reagiert auf Systemwechsel zur Laufzeit.
- `apps/frontend/src/main.ts` installiert die System-Theme-Logik beim App-Start.

Wenn `window` oder `matchMedia` nicht vorhanden ist, faellt die App defensiv auf
`ewillLight` zurueck.

## Theme-Werte

Beide Themes definieren semantische Vuetify-Farben:

- `background`
- `surface`
- `surface-variant`
- `primary`
- `secondary`
- `error`
- `warning`
- `info`
- `success`
- `outline`
- `on-background`
- `on-surface`
- `on-surface-variant`

Zusaetzlich gibt es projektbezogene Statusfarben:

- `status-locked`
- `status-available`
- `status-progress`
- `status-completed`
- `status-failed`

Neue Komponenten sollen diese Theme-Werte oder Vuetify-Utility-Klassen wie
`bg-background`, `bg-surface`, `bg-surface-variant`, `text-on-surface` und
`text-on-surface-variant` nutzen.

## Regeln fuer Komponenten

- Keine komponentenspezifischen Hex-Farben fuer Text, Flaechen, Rahmen oder
  Status.
- Keine festen Kombinationen wie `background: white`, `color: black` oder
  schwache Grautoene.
- Karten, Dialoge, Tabellen und Formulare sollen Vuetify-Oberflaechen,
  Varianten und Theme-Farben verwenden.
- Statusinformationen duerfen nicht nur durch Farbe unterscheidbar sein.
  Verwende Text, Icons und bei Bedarf Rahmen oder Hilfetexte.
- Neue Features muessen im Light und Dark Mode ohne eigene Dark-Mode-Abfragen
  lesbar bleiben.

## Statusinformationen

`apps/frontend/src/services/statusPresentation.ts` stellt die zentrale
Darstellung fuer Lernprozess-Status bereit:

- `Gesperrt` mit Schloss-Icon
- `Verfuegbar` mit Start-Icon
- `Begonnen` mit Fortschritts-Icon
- `Erfolgreich abgeschlossen` mit Haken-Icon
- `Nicht erfolgreich abgeschlossen` mit Fehler-Icon

Fuer das spaetere Bewertungssystem sind bereits semantische Darstellungen fuer
`Bestanden`, `Nicht bestanden`, `Noch nicht bewertet`, `Manuell bewertet` und
`Automatisch berechnet` vorbereitet. Das ist nur Darstellung, keine
Bewertungslogik.

## Kontrastpruefung

Beim Ergaenzen von Komponenten muss besonders auf folgende Elemente geachtet
werden:

- normaler und sekundaerer Text
- Links, Buttons und deaktivierte Buttons
- Formularlabels, Hilfetexte und Fehlermeldungen
- Tabellenzeilen und Hover-Zustaende
- Chips, Badges und Statuskennzeichen
- Dialoge und fokussierte Elemente

Normale Texte sollten moeglichst mindestens 4,5:1 Kontrast erreichen; grosse
Schrift und wesentliche grafische Bedienelemente mindestens 3:1.
