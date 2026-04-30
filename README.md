# non_repeating_random_v2

Ein kleines TypeScript-Repo fuer Experimente mit nicht wiederholenden Zahlengeneratoren. Der Fokus liegt nicht nur auf "liefert jede Zahl genau einmal", sondern auch auf der Frage, wie gut verschiedene Verfahren die Zahlenfolge durchmischen.

## Inhalt

Das Repo enthaelt mehrere Generator-Familien fuer Werte `0..n-1` bzw. `0..x-1` ohne Wiederholung:

- `src/index.ts`: Basisbausteine. Enthalten sind eine sequentielle Quelle (`useNextSequentialNumber`), ein generischer Cache (`useNumberCache`) und die zusammengesetzte Cache-Variante `useNextNonRepeatingRandomNumber(x, y)`.
- `src/uniformRandomNumber.ts`: uniforme Referenz auf Basis von Fisher-Yates. Diese Variante erzeugt eine echte uniforme Permutation, braucht dafuer aber Speicher `O(n)`.
- `src/roundRobinTreeRandomNumber.ts`: rekursiver RoundRobin-Baum mit festem `x` auf allen Ebenen.
- `src/roundRobinTreeRandomNumberByLevels.ts`: verallgemeinerter RoundRobin-Baum mit eigenen `x`-Werten pro Ebene.
- `src/roundRobinTreeRandomNumberByLevelsWithCache.ts`: Levels-Variante mit zusaetzlichem Cache auf jeder Ebene, um lokale Clusterung aufzubrechen.

Daneben gibt es mehrere Simulations- und Analyseprogramme:

- `src/cacheBiasSimulation.ts`: vergleicht die einfache Cache-Variante mit der uniformen Referenz.
- `src/roundRobinQualitySimulation.ts`: vergleicht feste RoundRobin-, Levels-, gecachte Levels- und uniforme Variante.
- `src/roundRobinCacheSweepSimulation.ts`: sweep ueber verschiedene `cacheSize`-Werte fuer die gecachte Levels-Variante und empfiehlt einen Kompromiss.

## Wichtige Beobachtungen

- Der einfache Cache-Ansatz ist fuer `x <= y` uniform, verliert aber fuer festes `y` und wachsendes `x` deutlich an Qualitaet.
- Die uniforme Referenz ist statistisch sauber, braucht aber den meisten Speicher.
- Die RoundRobin-Varianten zeigen oft gute globale Streuung, haben aber ohne Zusatzmassnahmen starke lokale Blatt-Clusterung.
- Die gecachte Levels-Variante reduziert diese lokale Struktur deutlich und bildet damit einen brauchbaren Mittelweg.

## Projektstruktur

- `src/`: Implementierungen und Simulationen
- `test/`: Vitest-Suite fuer alle Generatoren und Simulationen
- `Analysis.md`: laengere fachliche Auswertung der Verfahren, Kennzahlen und Simulationsergebnisse
- `Feedback.md`: persoenliche Rueckschau auf den Verlauf des Projekts

## Schnellstart

Voraussetzungen:

- Node.js
- npm

Installation und Standardchecks:

```bash
npm install
npm test
```

## NPM-Skripte

- `npm start`: Basis-Caching-Demo aus `src/index.ts`
- `npm run start:uniform`: uniforme Referenzdemo
- `npm run start:round-robin-tree`: RoundRobin-Baum mit festem `x`
- `npm run start:round-robin-tree-levels`: RoundRobin-Baum mit `xValues`
- `npm run start:round-robin-tree-levels-cached`: Levels-Variante mit Cache auf jeder Ebene
- `npm run simulate:bias`: Bias-Vergleich Cache vs. uniform
- `npm run simulate:round-robin-quality`: Qualitaetsvergleich der RoundRobin-Familie
- `npm run simulate:round-robin-cache-sweep`: automatische Suche nach einer brauchbaren `cacheSize`
- `npm test`: komplette Testsuite

## Tests

Die Tests pruefen insbesondere:

- Korrektheit der Generatoren und Erschoepfung ohne Wiederholung
- Eingabevalidierung und Fehlerfaelle
- deterministische Szenarien mit kontrollierter Zufallsquelle
- Qualitaetsmetriken und Sweep-Logik der Simulationen
- grosse Integritaetsfaelle fuer die RoundRobin-Generatoren

## Kurzfazit

Das Repo ist kein generisches Utility-Paket, sondern ein exploratives Arbeitsrepo. Es dokumentiert verschiedene Wege, nicht wiederholende Zahlenfolgen zu erzeugen, und macht ihre qualitativen Unterschiede ueber Tests, Demos und Simulationen sichtbar.