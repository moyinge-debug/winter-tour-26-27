# Winter Tour 26/27

Mobilvennlig turneringsapp for ni runder med spilleradministrasjon, lag, scorekort og sammenlagt leaderboard.

Regler-fanen beskriver spilleformater, poengfordeling, scoreføring og handicapberegning. Admin kan redigere simulator- og husreglene; teksten lagres sammen med turneringsdataene og følger sikkerhetskopien.

## Kom i gang

```bash
npm install
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000). Uten Supabase-oppsett lagres data bare i nettleserens `localStorage`. En engangsmigrering legger spillerne til eksisterende turneringsdata uten å overskrive eksisterende navn eller handicap.

## Felles lagring med Supabase

For å dele score, tee-oppsett og øvrige turneringsdata mellom nettleseren og hjemskjerm-appen:

1. Opprett et Supabase-prosjekt.
2. Kjør SQL-en i `supabase/schema.sql` i Supabase SQL Editor.
3. Kopier `.env.example` til `.env.local` og fyll inn prosjektets URL og anon/public key.
4. Start appen på nytt, eller legg de samme miljøvariablene inn i produksjonsmiljøet og bygg/deployer appen på nytt.

Ved første oppstart opprettes den delte turneringen fra lokale data i nettleseren som åpner appen først. Åpne derfor først konteksten som inneholder dataene du vil beholde; de andre nettleser-/app-kontekstene laster deretter den delte turneringen.

Supabase lagrer én felles turneringspost. Vent til statusen viser «Felles lagring» etter en endring før du bytter kontekst. Tilgang er offentlig etter eget valg: alle med appens adresse kan lese og endre posten. Admin-PIN-en er bare en klientbasert grensesnittlås, ikke tilgangskontroll. Ikke lagre sensitive opplysninger i denne turneringen. Ta jevnlig sikkerhetskopi fra Admin.

## Sammenlagt leaderboard

Leaderboard summerer netto score mot par (`brutto slag − spille-HCP − banepar`) fra registrerte runder og rangerer laveste totalsum først. I singelrunder brukes spillerens spillehandicap; i lagrunder brukes gjennomsnittet av spillernes spillehandicap, og lagets netto score føres på begge spillerne.

## Handicap og tee-oppsett

Spillerens registrerte handicap er Start-HCP, lagret med én desimal. Turnerings-HCP for hver runde beregnes fra Start-HCP og resultatene i tidligere runder. Spillehandicap er `Turnerings-HCP × (Slope / 113) + (CR − Par)`, avrundet til nærmeste heltall. Etter registrert score justeres HCP med `(brutto − spillehandicap − Par) / 2`, avrundet til én desimal. Endring eller sletting av en score beregner automatisk senere runder på nytt.

I lagrunder benytter lagresultatet gjennomsnittlig spillehandicap. Lagets brutto score brukes for hver lagspiller når deres individuelle HCP-utvikling beregnes. Tee-oppsettene har redigerbare, veiledende startverdier; bekreft CR og Slope med golfklubben. Med Supabase konfigurert synkroniseres turneringsdata på tvers av nettleser og hjemskjerm-app, og en lokal kopi beholdes som cache.

Admin kan importere tee-data fra en Golfify-kurside; hentede tee-steder vises først i en forhåndsvisning og lagres først etter bekreftelse. Score kan registreres manuelt eller foreslås fra et bilde med Tesseract.js OCR. OCR kan lese feil, så kontroller alltid tee, spiller og score før du lagrer. Tekstimport av tee-oppsett støtter linjer som `Hvit | Par 72 | CR 73,1 | Slope 132` eller `Hvit 72 73.1 132`.

Scorekortbilder komprimeres i nettleseren til JPEG (maks. 1000 px bredde, kvalitet 0,65) og lagres sammen med resultatet. Bildene vises i rundeoversikten, scorekortet og spillerhistorikken, og følger med i sikkerhetskopier. Admin kan bytte eller slette bilder uten å fjerne resultatet.

## Admin

Admin åpnes fra hengelås-knappen med standard-PIN `2026`. PIN-koden kan endres i `ADMIN_PIN` i `app/page.tsx`. Opplåsing varer i fanens `sessionStorage`. Admin kan redigere/slette spillere, lag, score, runder og tee-steder, styre manuelle HCP-overstyringer og eksportere/importere JSON-sikkerhetskopier. Sletting krever bekreftelse; full nullstilling krever en ekstra bekreftelse.

Admin-PIN er en klientbasert grensesnittlås, ikke serverbasert autentisering. PIN-koden finnes i klientkoden. Med offentlig Supabase-policy kan alle som får tak i appens adresse lese og endre turneringsdata. Ikke bruk dette som sikkerhetsgrense for sensitive data.

## Datamodell

De sentrale typene (`Player`, `Round`, `Team`, `Score`) ligger i `lib/types.ts`. Turneringsprogram og startdata ligger i `lib/data.ts`; delt lagring håndteres av `lib/shared-storage.ts`.
