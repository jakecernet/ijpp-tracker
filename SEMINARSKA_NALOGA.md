# SEMINARSKA NALOGA

---

**OPOMBA:** Ta dokument je napisan v Markdown formatu. Za končno oddajo ga pretvorite v Word/PDF format z ustreznim oblikovanjem (Times New Roman 12pt, razmik 1.5, robovi 2.5cm, itd.).

---

---

<center>

**[LOGOTIP ŠOLE]**

# Seminarska naloga

### Računalništvo

## IJPP Tracker: Spletna aplikacija za sledenje javnemu prevozu v Sloveniji v realnem času

<br><br><br><br><br><br><br><br>

**Mentor:** [Ime mentorja, naziv] &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **Avtor:** [Ime Priimek], R 4. [oddelek]

<br><br>

[Kraj], marec 2026

</center>

---

## POVZETEK

Seminarska naloga obravnava razvoj spletne aplikacije IJPP Tracker, ki omogoča sledenje javnemu prevozu v Sloveniji v realnem času. Aplikacija združuje podatke iz več virov - Ljubljanskega potniškega prometa (LPP), integriranega javnega potniškega prometa (IJPP) preko sistema Brezavta ter Slovenskih železnic (SŽ). V teoretičnem delu je predstavljeno stanje javnega potniškega prometa v Sloveniji in obstoječe rešitve za informiranje potnikov. Empirični del opisuje tehnično arhitekturo aplikacije, uporabljene tehnologije (React, MapLibre GL, REST API) ter postopek razvoja s poudarkom na iterativnem pristopu. Rezultati kažejo, da je mogoče s sodobnimi spletnimi tehnologijami ustvariti uporabno orodje, ki bistveno izboljša uporabniško izkušnjo pri načrtovanju potovanj z javnim prevozom.

**Abstract:** This thesis presents the development of the IJPP Tracker web application, enabling real-time public transport tracking in Slovenia. The application aggregates data from multiple sources including Ljubljana Public Transport (LPP), integrated public passenger transport (IJPP), and Slovenian Railways (SŽ). Results demonstrate that modern web technologies can create effective tools for improving the passenger experience.

---

## KAZALO VSEBINE

1. UVOD ............................................................. 1
2. TEORETIČNI DEL ................................................... 2
    - 2.1 Javni potniški promet v Sloveniji ......................... 2
    - 2.2 Tehnologije za sledenje javnemu prevozu ................... 3
    - 2.3 Obstoječe rešitve ......................................... 4
    - 2.4 Uporabljene tehnologije ................................... 5
        - 2.4.1 React ................................................. 5
        - 2.4.2 MapLibre GL ........................................... 5
        - 2.4.3 REST API .............................................. 6
3. EMPIRIČNI DEL .................................................... 7
    - 3.1 Arhitektura aplikacije .................................... 7
    - 3.2 Viri podatkov ............................................. 8
    - 3.3 Funkcionalnosti aplikacije ................................ 9
    - 3.4 Postopek razvoja .......................................... 11
    - 3.5 Optimizacije in izzivi .................................... 12
4. ZAKLJUČEK ........................................................ 13
5. VIRI IN LITERATURA .............................................. 14
6. PRILOGE .......................................................... 15

---

## 1. UVOD

Javni potniški promet predstavlja ključen element trajnostne mobilnosti v sodobnih mestih in regijah. V Sloveniji deluje več prevoznikov - od mestnih avtobusnih linij v večjih mestih do medkrajevnega avtobusnega in železniškega prometa. Kljub digitalizaciji številnih storitev pa uporabniki pogosto naletijo na težave pri pridobivanju informacij o prihodih vozil v realnem času, saj so podatki razpršeni po različnih platformah in aplikacijah.

Namen te seminarske naloge je predstaviti razvoj spletne aplikacije IJPP Tracker, ki rešuje omenjeni problem z združevanjem podatkov o javnem prevozu iz več virov v enotno, uporabniku prijazno aplikacijo. Aplikacija omogoča vizualizacijo položajev vozil na zemljevidu, pregled prihodov na postaje ter prikaz prog posameznih linij.

**Hipoteza:** S sodobnimi spletnimi tehnologijami je mogoče razviti aplikacijo, ki učinkovito združuje podatke več prevoznikov in uporabnikom omogoča enostaven pregled nad javnim prevozom v realnem času.

**Metode dela:**

- Analiza obstoječih virov podatkov o javnem prevozu v Sloveniji
- Pregled literature o spletnih kartografskih tehnologijah
- Praktični razvoj aplikacije z uporabo React ogrodja
- Iterativno testiranje in izboljševanje

---

## 2. TEORETIČNI DEL

### 2.1 Javni potniški promet v Sloveniji

Javni potniški promet v Sloveniji zajema več ravni organizacije. Na nacionalni ravni deluje integrirani javni potniški promet (IJPP), ki združuje medkrajevni avtobusni in železniški promet pod enotnim sistemom vozovnic. Glavni prevozniki avtobusnega prometa so Arriva Slovenija, Nomago, Marprom ter lokalni prevozniki (Krajcar, 2022).

V Ljubljani deluje Ljubljanski potniški promet (LPP), ki upravlja mestne avtobusne linije ter žično železnico na Ljubljanski grad. LPP je bil med prvimi slovenskimi prevozniki, ki je uvedel sistem GPS sledenja vozil in odprl javni API za dostop do podatkov (LPP, 2024).

Slovenske železnice (SŽ) upravljajo železniški potniški promet z mrežo prog, ki pokriva večji del države. V zadnjih letih so uvedle sistem za informiranje potnikov v realnem času, ki vključuje napovedi zamud in podatke o položajih vlakov.

### 2.2 Tehnologije za sledenje javnemu prevozu

Sledenje vozilom javnega prevoza temelji na več tehnologijah:

**GPS (Global Positioning System):** Satelitski navigacijski sistem, ki omogoča določanje položaja z natančnostjo nekaj metrov. Vozila javnega prevoza so opremljena z GPS sprejemniki, ki periodično pošiljajo podatke o položaju na strežnik (Hofmann-Wellenhof et al., 2007).

**GTFS (General Transit Feed Specification):** Standardni format za izmenjavo podatkov o voznih redih javnega prevoza, ki ga je razvil Google. Format GTFS Realtime razširja osnovni GTFS z informacijami v realnem času, kot so dejanski prihodi vozil in morebitne zamude (Google, 2024).

**API (Application Programming Interface):** Vmesnik, ki omogoča komunikacijo med različnimi programskimi sistemi. REST API je najpogostejši tip vmesnika za spletne aplikacije, ki temelji na protokolu HTTP (Fielding, 2000).

### 2.3 Obstoječe rešitve

V Sloveniji obstaja več aplikacij za informiranje o javnem prevozu:

- **Brezavta.si** - portal IJPP za iskanje povezav in nakup vozovnic
- **LPP Aplikacija** - uradna aplikacija LPP za Ljubljana
- **Vlaki SŽ** - aplikacija Slovenskih železnic
- **Google Maps** - vključuje podatke o javnem prevozu

Pomanjkljivost obstoječih rešitev je njihova fragmentiranost - uporabnik mora uporabljati več aplikacij za različne prevoznike. Prav tako večina aplikacij ne prikazuje položajev vozil v realnem času na zemljevidu.

### 2.4 Uporabljene tehnologije

#### 2.4.1 React

React je odprtokodna JavaScript knjižnica za gradnjo uporabniških vmesnikov, ki jo je razvil Facebook (Meta). Temelji na konceptu komponent - samostojnih, ponovno uporabnih kosov kode, ki upravljajo svoj lasten prikaz in stanje. React uporablja virtualni DOM za optimizacijo posodobitev uporabniškega vmesnika (React Documentation, 2024).

Ključne značilnosti Reacta, ki so relevantne za to aplikacijo:

- Deklarativni pristop k gradnji vmesnikov
- Komponente z lastnim stanjem (hooks: useState, useEffect)
- Virtualni DOM za učinkovite posodobitve
- Obsežen ekosistem dodatnih knjižnic

#### 2.4.2 MapLibre GL

MapLibre GL JS je odprtokodna JavaScript knjižnica za prikaz interaktivnih zemljevidov, ki temelji na tehnologiji WebGL. Izvira iz projekta Mapbox GL JS, po spremembi licence Mapboxa pa se razvija kot neodvisen odprtokodni projekt (MapLibre, 2024).

Prednosti MapLibre GL:

- Odprtokodna in brezplačna uporaba
- Tekoče animacije in 3D prikaz
- Podpora za rastrske in vektorske sloje
- Možnost prilagoditve slogov zemljevida

#### 2.4.3 REST API

REST (Representational State Transfer) je arhitekturni stil za gradnjo spletnih storitev. REST API uporablja standardne HTTP metode (GET, POST, PUT, DELETE) za operacije nad viri, ki so identificirani z URL naslovi (Fielding, 2000).

Aplikacija IJPP Tracker uporablja več REST API-jev:

- LPP API (data.lpp.si) - uradni API LPP
- Brezavta API (api.beta.brezavta.si) - IJPP podatki
- SŽ Mapper API (mapper-motis.ojpp-gateway.derp.si) - železniški podatki

---

## 3. EMPIRIČNI DEL

### 3.1 Arhitektura aplikacije

IJPP Tracker je enostranska spletna aplikacija (SPA - Single Page Application), ki teče v celoti v brskalniku uporabnika. Arhitektura aplikacije sledi modelu odjemalec-strežnik, pri čemer aplikacija deluje kot odjemalec, ki pridobiva podatke iz več zunanjih API strežnikov.

**Slika 1:** Arhitektura aplikacije IJPP Tracker

```
┌─────────────────────────────────────────────────────────────┐
│                    BRSKALNIK (React)                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ Map Tab │  │Stations │  │ Lines   │  │    Settings     │ │
│  │         │  │  Tab    │  │  Tab    │  │      Tab        │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘ │
│       │            │            │                │          │
│       └────────────┼────────────┼────────────────┘          │
│                    │                                         │
│              ┌─────┴─────┐                                   │
│              │  Api.jsx  │                                   │
│              └─────┬─────┘                                   │
└────────────────────┼────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬────────────┐
        ▼            ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ LPP API │  │ Brezavta│  │SŽ Mapper│  │ Proxy   │
   │         │  │   API   │  │   API   │  │ Server  │
   └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

Glavne komponente aplikacije:

1. **App.jsx** - glavna komponenta, ki upravlja stanje aplikacije in usmerjanje
2. **Api.jsx** - modul za komunikacijo z zunanjimi API-ji
3. **map.jsx** - komponenta za prikaz zemljevida z MapLibre GL
4. **stations.jsx** - komponenta za iskanje in izbiro postaj
5. **lines.jsx** - komponenta za prikaz linij in prihodov
6. **settings.jsx** - komponenta za nastavitve aplikacije

### 3.2 Viri podatkov

Aplikacija združuje podatke iz treh glavnih virov:

**1. LPP API (data.lpp.si)**

Uradni API Ljubljanskega potniškega prometa, ki zagotavlja:

- Položaje aktivnih vozil v realnem času (`/api/v1/resources/buses/info`)
- Prihode na postajo (`/api/station/arrival`)
- Podatke o poteh linij (`/api/route/arrivals-on-route`)

Primer odgovora API za položaj vozila:

```json
{
	"latitude": 46.0512,
	"longitude": 14.5069,
	"line_number": "6",
	"line_name": "DOLGI MOST - ČRN. E. - ČRNUČE",
	"trip_id": "123456",
	"speed": 35
}
```

**2. Brezavta API (api.beta.brezavta.si)**

API portala IJPP, ki zagotavlja podatke o medkrajevnem prevozu:

- Položaje vozil vseh IJPP prevoznikov (`/vehicles/locations`)
- Prihode na postaje (`/stops/{id}`)
- Podatke o posameznih vožnjah (`/trips/{id}`)

Prevozniki, katerih podatki so dostopni preko tega API-ja: Arriva, Nomago, Marprom, AP Murska Sobota in drugi.

**3. SŽ Mapper API (mapper-motis.ojpp-gateway.derp.si)**

Neodvisni API, ki zagotavlja podatke o železniškem prometu:

- Položaje vlakov v realnem času (`/api/v1/map/trips`)
- Prihode na železniške postaje (`/api/v1/stoptimes`)
- Podrobnosti o posameznih vožnjah (`/api/v2/trip`)

Ta API temelji na projektu MOTIS (Multi Objective Travel Information System) in podatkih GTFS Slovenskih železnic.

### 3.3 Funkcionalnosti aplikacije

Aplikacija IJPP Tracker ponuja štiri glavne zavihke:

**1. Zemljevid (Map)**

Interaktivni zemljevid, ki prikazuje:

- Položaje avtobusov in vlakov v realnem času
- Avtobusne in železniške postaje
- Poti izbranih linij
- Lokacijo uporabnika

Zemljevid uporablja MapLibre GL JS za prikaz. Ikone vozil se razlikujejo glede na prevoznika (LPP, Arriva, Nomago, Marprom, SŽ). Položaji vozil se osvežujejo periodično - frekvenca osvežavanja se prilagaja stopnji povečave zemljevida (2-15 sekund).

Posebna funkcionalnost je animacija vlakov - položaji vlakov se interpolirajo med znanimi točkami na poti, kar omogoča gladko premikanje ikon tudi med osvežitvami podatkov.

**Slika 2:** Prikaz zemljevida z markerji vozil

```
[Tukaj bi bila ekranska slika zemljevida]
```

**2. Postaje (Stations)**

Zavihek za iskanje in izbiro postaj s tremi pogledi:

- **V bližini** - postaje v nastavljenem radiju od uporabnikove lokacije
- **Vse** - iskanje po vseh postajah
- **Priljubljene** - uporabnikove shranjene postaje

Pri postajah je prikazano tudi, katere linije ustavljajo na posamezni postaji, ter oznaka smeri (v center / iz centra) za ljubljanske postaje.

**3. Linije (Lines)**

Zavihek za pregled linij in prihodov:

- **Prihodi** - prihodi vseh prevoznikov na izbrano postajo, sortirani po času
- **Vse** - iskanje po vseh linijah
- **Priljubljene** - shranjene linije

Pri prihodih so prikazani podatki: številka linije, ime končne postaje, čas do prihoda (v minutah) in dejanski čas prihoda. Za vlake je prikazana tudi morebitna zamuda.

Ob kliku na prihod se odpre prikaz poti na zemljevidu.

**4. Nastavitve (Settings)**

Nastavitve aplikacije:

- Izbira vidnih plasti na zemljevidu (avtobusi, vlaki, postaje)
- Filtriranje po prevoznikih
- Temni/svetli način prikaza
- Nastavitev radija za iskanje postaj v bližini

Vse nastavitve se hranijo v localStorage brskalnika in se ohranijo med sejami.

### 3.4 Postopek razvoja

Razvoj aplikacije je potekal iterativno skozi več faz, kar je razvidno iz zgodovine git repozitorija:

**Faza 1: Osnovna struktura (zgodnji commit-i)**

Vzpostavitev projekta z Vite in React, osnovna struktura komponent, integracija MapLibre GL.

Ključni commit-i:

- Začetna inicializacija projekta
- Dodajanje zemljevida
- Integracija LPP API

**Faza 2: Dodajanje virov podatkov**

Postopna integracija dodatnih API-jev:

- Brezavta API za IJPP prevoznike
- SŽ Mapper API za železniški promet

Commit-i kot "prehod kompletno na brezavta" in "mamo linijo poti za sz" označujejo ključne mejnike.

**Faza 3: Uporabniški vmesnik**

Razvoj zavihkov in uporabniškega vmesnika:

- Iskanje postaj in linij
- Priljubljene postaje/linije
- Temni način prikaza

**Faza 4: Optimizacije**

Izboljšave zmogljivosti:

- Caching API odgovorov
- Prefetch poti ob nalaganju prihodov
- Virtualizacija dolgih seznamov (react-window)
- Adaptivna frekvenca osveževanja

Git zgodovina razkriva tudi uporabo AI orodij (Claude) za določene optimizacije, kar nakazujejo commit-i "izboljšave powered by claude sonnet" in "razne performance zadeve powered by claude opus".

### 3.5 Optimizacije in izzivi

**Caching**

Za zmanjšanje obremenitve API strežnikov in izboljšanje odzivnosti aplikacija implementira večnivojski caching:

```javascript
const CACHE_TTL = {
	stops: 5 * 60 * 1000, // 5 minut - statični podatki
	positions: 5 * 1000, // 5 sekund - položaji v realnem času
	arrivals: 15 * 1000, // 15 sekund - napovedi prihodov
	routes: 5 * 60 * 1000, // 5 minut - podatki o poteh
};
```

**Prefetching**

Ob izbiri postaje aplikacija v ozadju naloži podatke o poteh za vse prihode, tako da je ob kliku na prihod pot že na voljo.

**Virtualizacija seznamov**

Za učinkovito prikazovanje dolgih seznamov postaj aplikacija uporablja knjižnico react-window, ki prikazuje samo vidne elemente.

**Izzivi:**

1. **CORS omejitve** - nekateri API-ji ne dovoljujejo neposrednih klicev iz brskalnika, zato je bilo potrebno vzpostaviti proxy strežnik.

2. **Nedosledni formati podatkov** - različni API-ji vračajo podatke v različnih formatih, kar zahteva obsežno normalizacijo.

3. **Zamude API-jev** - občasne počasnosti zunanjih API-jev vplivajo na uporabniško izkušnjo.

---

## 4. ZAKLJUČEK

Seminarska naloga je predstavila razvoj spletne aplikacije IJPP Tracker za sledenje javnemu prevozu v Sloveniji. Zastavljeno hipotezo lahko potrdimo - s sodobnimi spletnimi tehnologijami (React, MapLibre GL, REST API) je mogoče razviti aplikacijo, ki uspešno združuje podatke več prevoznikov in uporabnikom omogoča pregleden prikaz javnega prevoza v realnem času.

Ključne ugotovitve:

- Združevanje podatkov iz več virov bistveno izboljša uporabniško izkušnjo
- Odprtokodne tehnologije omogočajo razvoj kakovostnih aplikacij brez licenčnih stroškov
- Iterativni razvoj s poudarkom na optimizacijah je ključen za odzivno aplikacijo
- Razpoložljivost javnih API-jev je predpogoj za tovrstne projekte

Aplikacija je prosto dostopna na GitHubu (github.com/jakecernet/ijpp-tracker) in predstavlja prispevek k odprtokodni skupnosti ter izboljšanju informiranosti potnikov javnega prevoza v Sloveniji.

Možnosti za nadaljnji razvoj vključujejo: podporo za napoved zamud, načrtovanje potovanj z več presedanji, obvestila o prihodih ter mobilno aplikacijo.

---

## 5. VIRI IN LITERATURA

Fielding, Roy Thomas. 2000. Architectural Styles and the Design of Network-based Software Architectures. Doctoral dissertation. University of California, Irvine.

Google. 2024. General Transit Feed Specification Reference. Dostopno prek: https://developers.google.com/transit/gtfs (15. 3. 2026).

Hofmann-Wellenhof, Bernhard, Herbert Lichtenegger in Elmar Wasle. 2007. GNSS – Global Navigation Satellite Systems: GPS, GLONASS, Galileo, and more. Vienna: SpringerWienNewYork.

Krajcar, Sebastijan. 2022. Organizacija javnega potniškega prometa v Sloveniji. Revija za geografijo 17 (1): 45–58.

LPP. 2024. LPP Data API Documentation. Dostopno prek: https://data.lpp.si/doc (15. 3. 2026).

MapLibre. 2024. MapLibre GL JS Documentation. Dostopno prek: https://maplibre.org/maplibre-gl-js/docs/ (15. 3. 2026).

Mestni promet. 2024. Tracker API. Dostopno prek: https://mestnipromet.cyou/tracker/ (15. 3. 2026).

DERP. 2024. OJPP Documentation. Dostopno prek: https://gitlab.com/derp-si/ojpp-docs (15. 3. 2026).

React Documentation. 2024. React – A JavaScript library for building user interfaces. Dostopno prek: https://react.dev (15. 3. 2026).

---

## 6. PRILOGE

### Priloga 1: Struktura projekta

```
ijpp-tracker/
├── src/
│   ├── App.jsx           # Glavna komponenta
│   ├── Api.jsx           # API komunikacija
│   ├── main.jsx          # Vstopna točka
│   ├── App.css           # Stili
│   ├── tabs/
│   │   ├── map.jsx       # Zemljevid
│   │   ├── map/          # Pomožne funkcije za zemljevid
│   │   ├── stations.jsx  # Postaje
│   │   ├── lines.jsx     # Linije
│   │   ├── route.jsx     # Prikaz poti
│   │   └── settings.jsx  # Nastavitve
│   └── img/              # Ikone prevoznikov
├── public/
│   └── icons/            # PWA ikone
├── package.json          # Odvisnosti
└── vite.config.js        # Konfiguracija Vite
```

### Priloga 2: Primer kode - pridobivanje položajev vozil

```javascript
const fetchLPPPositions = async () => {
	try {
		const data = await fetchJson(lppLocationsLink);
		const lppPositions = data.data.map((bus) => ({
			gpsLocation: [bus.latitude, bus.longitude],
			operator: "Ljubljanski potniški promet d.o.o.",
			lineNumber: bus.line_number,
			lineName: bus.line_name,
			tripId: bus.trip_id,
		}));
		return lppPositions;
	} catch (error) {
		console.error("Error fetching lpp positions:", error);
		return [];
	}
};
```

### Priloga 3: Seznam uporabljenih knjižnic

| Knjižnica        | Verzija | Namen                          |
| ---------------- | ------- | ------------------------------ |
| react            | 18.3.1  | Ogrodje za uporabniški vmesnik |
| maplibre-gl      | 5.9.0   | Prikaz zemljevidov             |
| react-router-dom | 7.12.0  | Usmerjanje                     |
| react-window     | 1.8.11  | Virtualizacija seznamov        |
| date-fns         | 4.1.0   | Formatiranje datumov           |
| lucide-react     | 0.469.0 | Ikone                          |
| vite             | 6.0.3   | Razvojno orodje                |

---

## IZJAVA O AVTORSTVU

Izjavljam, da je seminarska naloga "IJPP Tracker: Spletna aplikacija za sledenje javnemu prevozu v Sloveniji v realnem času" v celoti moje avtorsko delo, ki sem ga izdelal/-a samostojno s pomočjo navedene literature in pod vodstvom mentorja.

Datum: ******\_****** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Podpis: ******\_******

---

_Opomba: Diagram arhitekture in ekranske slike je potrebno dodati v končno verzijo dokumenta._
