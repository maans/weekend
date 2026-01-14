# 🧭 WeekendLister

En moderne, mobile-first webapplikation designet specifikt til efterskolelærere til administration af elever, gangrunder, madtjanser og rengøring i weekenderne. Appen er optimeret til brug på farten med intuitive gestures og lynhurtig automatisering.

## 🚀 Nyeste Funktioner

- **Swipe Navigation:** Naviger lynhurtigt mellem fanerne (Dashboard, Elevliste, Runder osv.) ved blot at swipe til højre eller venstre på skærmen. Det giver en "native app" følelse direkte i browseren.
- **Shake to Shuffle (Ryst for fordeling):** Fordel automatisk madtjanser eller rengøringshold ved at ryste din telefon eller trykke på det centrale terning-ikon.
- **Home Gesture:** Et hurtigt swipe nedad fra toppen af skærmen sender dig altid direkte tilbage til Dashboard/Import-fanen.
- **Tydelig Markering af Udeboende:** Elever, der er flyttet til andre værelser eller fællesarealer, markeres med et tydeligt gult "FLYTTET" badge i gangrunden, så læreren altid har overblikket.
- **Professionelle Print-layouts:** Generer A4-klare weekendplaner, brandlister og rengøringsskemaer med ét klik. Alle madtjanser er renset for unødig tekst for maksimal læsbarhed på opslagstavlen.

## ✨ Kernefunktioner

- **Intelligent Import:** Indlæs elever direkte fra skolens Excel-ark eller CSV-filer. Appen genkender automatisk navne, huse og værelser.
- **Avanceret Soveplads-styring:** Flyt nemt elever mellem værelser eller til fællesarealer (telt, gymnastiksal, biograf osv.). Brandlisterne opdateres automatisk til print.
- **Udelukkelseslogik:** Appen sikrer automatisk retfærdig fordeling – f.eks. udelukkes elever med Mokost-opvask automatisk fra rengøringsholdene.
- **Sikkerhed (Global Lås):** Et rødt skjold i toppen forhindrer utilsigtede ændringer af data (som f.eks. hvem der er tilstede), mens du går din runde.
- **Offline Funktionalitet:** Alle data gemmes sikkert i browserens lokale lager (LocalStorage). Du kan også eksportere en manuel backup-fil til dine kolleger.

## 🛠️ Teknisk Setup

Appen er bygget med fokus på hastighed, stabilitet og moderne webstandarder:
- **Frontend:** [React 19](https://react.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Ikoner:** [Lucide React](https://lucide.dev/)
- **Data-parsing:** [SheetJS (XLSX)](https://sheetjs.com/)

### Installation & Udvikling

1. Klun repositoriet:
   ```bash
   git clone [url-til-dit-repo]
   ```
2. Installer afhængigheder:
   ```bash
   npm install
   ```
3. Start udviklingsserver:
   ```bash
   npm run dev
   ```
4. Byg til produktion:
   ```bash
   npm run build
   ```

## 📖 Sådan bruger du den

1. **Importér:** Start på Dashboardet og hent din elevliste (Excel/CSV).
2. **Klargør:** Gå til Elevlisten, marker hvem der er tilstede, og hvem der har køkkentjans denne weekend.
3. **Fordel:** Gå til Madtjanser eller Rengøring og ryst telefonen for at fordele opgaverne retfærdigt blandt de tilstedeværende elever.
4. **Gennemfør:** Brug Kompas-ikonet (Runder) til din gangrunde. Tjek værelserne og markér når du er færdig.
5. **Print:** Gå til Print-fanen for at generere alle nødvendige lister til opslagstavlen og lærerværelset.

---
Udviklet til fri afbenyttelse på danske efterskoler. Bidrag og feedback er altid velkomment!