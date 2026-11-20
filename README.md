# Winter Tour 26/27

Mobilvennlig turneringsapp for ni runder med spilleradministrasjon, lag, scorekort og Order of Merit.

## Kom i gang

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000). Appen starter med seks demospillere, eksempel-lag og resultater fra to runder. Endringer lagres i nettleserens `localStorage`.

## Poeng

Runder rangeres på brutto slag, lavest score først. Plassering gir 12, 10, 8, 6, 4 og 2 poeng; delte plasseringer deler poengene som ellers ville gått til plassene de opptar. Begge spillerne på et lag får lagets poeng i Order of Merit.

## Datamodell

De sentrale typene (`Player`, `Round`, `Team`, `Score`) ligger i `lib/types.ts`. Turneringsprogram og startdata ligger i `lib/data.ts`, slik at lagring senere kan flyttes til for eksempel Supabase uten å endre domenemodellen.
