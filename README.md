# Weekend HU – Weekendapp til efterskolebrug

Weekend HU er en browserbaseret weekendapp udviklet til brug på Himmerlands Ungdomsskole.  
Appen hjælper weekendlærere med overblik, opgavefordeling og print i forbindelse med weekender.

Appen er bygget som en **single-file React/TypeScript-app** med fokus på:
- hurtigt overblik
- få klik
- printklare A4-layouts
- minimal teknisk kompleksitet for brugerne

---

## 🧭 Hvad hjælper appen med?

Weekend HU samler og automatiserer det praktiske arbejde, som ellers typisk kræver:

- Excel-ark fra Viggo  
- manuelle noter om sovesteder  
- håndholdt fordeling af køkken- og rengøringstjanser  
- gentagne rettelser i brandlister og weekendlister  

Appen hjælper weekendlæreren med at:
- bevare overblik, også når planer ændrer sig
- sikre sammenhæng mellem elevliste, sovesteder og print
- udskrive klare lister til vagtrum og opslagstavler
- aflevere weekenden struktureret videre til næste vagt

---

## 🧑‍🏫 Weekendlærerens flow (kort)

1. **Importér elevliste**  
   Hent weekendens elevtilmeldinger fra Viggo (Excel/CSV).

2. **Elevliste**  
   Markér tilstedeværelse og køkkenhold.

3. **Gangrunder / sovesteder**  
   Registrér hvor eleverne sover – også når de flytter fra eget værelse.

4. **Fordel opgaver**  
   Fordel mad- og rengøringstjanser automatisk eller manuelt.

5. **Print & del**  
   Print weekendplan, brandlister, søndagsliste og tjanser i faste A4-layouts.

---

## 🖨️ Print

Appen indeholder særskilte print-layouts til:
- Weekendplan (A4 landscape, 2 kolonner)
- Brandlister
- Søndagsliste
- Madtjanser og rengøring

Alle print er optimeret til **én side pr. liste**, hvor det er muligt.

---

## ⚠️ VIGTIGT: Udvikling vs. distribueret udgave

Der findes **to forskellige udgaver** af appen:

### 🔧 Udviklingsudgave (til videre arbejde)
Hvis du vil **rette, udvide eller videreudvikle appen**, skal du bruge:

> **`WeekendAppDevFiler.zip`**

Denne indeholder:
- `index.tsx` (hele appens kildekode)
- `package.json` / `package-lock.json`
- Vite- og TypeScript-konfiguration
- øvrige nødvendige udviklingsfiler

👉 **Kun denne udgave kan bruges til udvikling.**

---

### 📦 Distribueret udgave (til brug)
Den færdigbyggede udgave består typisk af:
- `index.html`
- `assets/`-mappe

Denne version er:
- klar til brug i browser
- egnet til deling med kolleger
- **ikke egnet til udvikling eller redigering**

👉 Forsøg ikke at videreudvikle appen ud fra den distribuerede udgave.

---

## 🛠️ Lokal udvikling (kort)

```bash
npm install
npm run dev
