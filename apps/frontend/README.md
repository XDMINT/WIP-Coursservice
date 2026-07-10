# Frontend

Vue-3/Vite-SPA fuer die Lernplattform. Im Compose-Betrieb wird das gebaute Frontend intern durch Nginx ausgeliefert und ausschliesslich ueber Traefik unter `/` erreicht.

## Entwicklung

```sh
npm install
npm run dev
```

Der Dev-Server nutzt Port `8085`. Browser-Anfragen an `/api` werden an `http://localhost:3000` weitergeleitet. Der Zielhost kann lokal mit `INTERNAL_API_PROXY_TARGET` angepasst werden.

## Skripte

```sh
npm run type-check
npm test
npm run lint
npm run build
```

## API-Zugriff

Kursdaten laufen ueber `src/services/apiClient.ts` und verwenden standardmaessig `/api` als Basis. Fuer Docker-Builds kann `PUBLIC_API_BASE_URL` im Root-Compose gesetzt werden; es wird als `VITE_PUBLIC_API_BASE_URL` in den Vite-Build uebernommen.

Einige Demo-Services fuer Login, Nutzer und Semester bleiben lokal, weil dafuer im aktuellen Backend noch keine entsprechende fachliche Implementierung vorhanden ist.

## Struktur

```text
apps/frontend/
├── src/
│   ├── components/
│   ├── views/
│   ├── services/
│   ├── router/
│   ├── stores/
│   ├── plugins/
│   ├── assets/
│   ├── enums/
│   └── model/
├── docker/nginx.conf
├── Dockerfile
├── package.json
└── vite.config.ts
```
