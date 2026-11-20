# Winter Tour 26/27

Mobilvennlig turneringsapp for ni runder med spilleradministrasjon, lag, scorekort og Order of Merit.

## Kom i gang

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000). Appen starter med seks demospillere, eksempel-lag og resultater fra to runder. Endringer lagres i nettleserens `localStorage`.

## Poeng

Runder rangeres på netto score (brutto slag minus spille-HCP), lavest først. I singelrunder brukes spillerens HCP; i lagrunder brukes gjennomsnittet av spillernes spillehandicap. Plassering gir 12, 10, 8, 6, 4 og 2 poeng; delte plasseringer deler poengene som ellers ville gått til plassene de opptar. Begge spillerne på et lag får lagets poeng i Order of Merit.

## Handicap og tee-oppsett

Spillerens registrerte handicap er Start-HCP, lagret med én desimal. Turnerings-HCP for hver runde beregnes fra Start-HCP og resultatene i tidligere runder. Spillehandicap er `Turnerings-HCP × (Slope / 113) + (CR − Par)`, avrundet til nærmeste heltall. Etter registrert score justeres HCP med `(brutto − spillehandicap − Par) / 2`, avrundet til én desimal. Endring eller sletting av en score beregner automatisk senere runder på nytt.

I lagrunder benytter lagresultatet gjennomsnittlig spillehandicap. Lagets brutto score brukes for hver lagspiller når deres individuelle HCP-utvikling beregnes. Tee-oppsettene har redigerbare, veiledende startverdier; bekreft CR og Slope med golfklubben. Tee-data og score lagres lokalt i nettleserens `localStorage`.

Score kan registreres manuelt eller foreslås fra et bilde med Tesseract.js OCR. OCR kan lese feil, så kontroller alltid tee, spiller og score før du lagrer. Tekstimport av tee-oppsett støtter linjer som `Hvit | Par 72 | CR 73,1 | Slope 132` eller `Hvit 72 73.1 132`.

## Datamodell

De sentrale typene (`Player`, `Round`, `Team`, `Score`) ligger i `lib/types.ts`. Turneringsprogram og startdata ligger i `lib/data.ts`, slik at lagring senere kan flyttes til for eksempel Supabase uten å endre domenemodellen.
