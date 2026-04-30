# Analyse

## Ausgangsfrage

Die Aussage

> Die Qualitaet der von `useNextNonRepeatingRandomNumber(x, y)` gelieferten Zufallszahlen nimmt bei gleichbleibendem `y` und wachsendem `x` stetig ab.

ist im Kern richtig, aber zu grob formuliert.

Praeziser ist folgende Aussage:

- Fuer `x <= y` ist der Ansatz in [src/index.ts](src/index.ts) sogar exakt uniform, weil alle Werte `0` bis `x - 1` sofort im Cache liegen und danach nur noch zufaellig ohne Zuruecklegen entnommen werden.
- Fuer festes `y` und wachsendes `x > y` nimmt die Qualitaet dann deutlich ab.
- Das Wort `stetig` passt mathematisch nicht ganz, weil `x` nur ganzzahlige Werte annimmt und es fuer `x <= y` zunaechst ein Plateau ohne Qualitaetsverlust gibt.

## Der Cache-Ansatz in src/index.ts

Die Implementierung in [src/index.ts](src/index.ts) arbeitet so:

1. Beim ersten Zugriff wird der Cache mit `min(x, y)` Werten befuellt.
2. Solange noch neue Werte verfuegbar sind, wird bei jeder Ziehung ein zufaelliger Cache-Eintrag ausgegeben und direkt durch den naechsten noch nicht verwendeten Wert ersetzt.
3. Wenn keine neuen Werte mehr verfuegbar sind, wird der Cache nur noch zufaellig geleert.

Solange `x > y`, wird also nicht aus allen noch verfuegbaren Zahlen gezogen, sondern nur aus einem beweglichen Fenster der Groesse `y`.

### Warum dadurch Bias entsteht

Schon die erste ausgegebene Zahl zeigt das Problem:

- Beim ersten Zugriff liegen nur die Werte `0` bis `min(x, y) - 1` im Cache.
- Fuer `x > y` kann die erste Zahl also nur einer von `y` Werten sein, obwohl eigentlich `x` Werte moeglich waeren.
- Der Anteil der moeglichen ersten Werte ist damit nur

$$
\frac{y}{x}
$$

und dieser Anteil geht bei festem `y` und wachsendem `x` gegen `0`.

Auch spaeter bleiben Einschraenkungen bestehen. Eine Zahl `n >= y` kann nicht beliebig frueh erscheinen, weil sie erst dann in den Cache gelangen kann, wenn vorher genug fruehere Werte bereits gezogen wurden. In 1-basierter Positionierung kann `n` fruehestens an Position

$$
\max(1, n - y + 2)
$$

auftauchen.

Damit sind viele Permutationen grundsaetzlich unmoeglich.

### Anzahl der erreichbaren Permutationen

Fuer `x > y` lassen sich hoechstens

$$
y^{x-y} \cdot y!
$$

verschiedene Ausgabereihenfolgen erzeugen:

- In den ersten `x - y` Schritten gibt es jeweils hoechstens `y` moegliche Cache-Positionen.
- Danach verbleiben `y` Werte im Cache, die noch in beliebiger Reihenfolge ausgegeben werden koennen.

Eine echte uniforme Permutation haette dagegen

$$
x!
$$

moegliche Ausgabefolgen.

Das Verhaeltnis

$$
\frac{y^{x-y} \cdot y!}{x!}
$$

geht bei festem `y` und wachsendem `x` gegen `0`. Das ist ein starkes Indiz dafuer, dass die globale Verteilungsqualitaet mit wachsendem `x / y` schlechter wird.

## Der neue uniforme Ansatz in uniformRandomNumber.ts

In [src/uniformRandomNumber.ts](src/uniformRandomNumber.ts) liegt nun eine Referenzimplementierung, die wirklich eine uniforme Permutation erzeugt.

Die Idee ist einfach:

1. Es wird ein Array mit allen Zahlen `0` bis `x - 1` aufgebaut.
2. Dieses Array wird mit Fisher-Yates gemischt.
3. Danach werden die Werte nacheinander ausgegeben.

Wenn die zugrunde liegende Zufallsquelle uniform ist, ist jede der `x!` Permutationen gleich wahrscheinlich. Das ist genau die Eigenschaft, die dem Cache-Ansatz fuer `x > y` fehlt.

### Vorteile

- Statistisch saubere, uniforme Permutation.
- Keine Einschraenkung auf ein Cache-Fenster.
- Jede Zahl kann an jeder Position auftreten.

### Kosten

- Speicherbedarf `O(x)` statt `O(y)`.
- Die gesamte Permutation wird vorab aufgebaut und gemischt.

Damit ist [src/uniformRandomNumber.ts](src/uniformRandomNumber.ts) die bessere Wahl, wenn Verteilungsqualitaet wichtiger ist als ein kleines Speicherbudget.

## Die Simulation in cacheBiasSimulation.ts

In [src/cacheBiasSimulation.ts](src/cacheBiasSimulation.ts) gibt es eine kleine, reproduzierbare Simulation, die den Cache-Ansatz aus [src/index.ts](src/index.ts) direkt mit der uniformen Variante aus [src/uniformRandomNumber.ts](src/uniformRandomNumber.ts) vergleicht.

Die Simulation verwendet:

- einen seedbaren Pseudozufallszahlengenerator fuer reproduzierbare Ergebnisse,
- mehrere Szenarien mit festem `y = 4` und wachsendem `x`,
- `5000` Durchlaeufe pro Szenario.

### Was gemessen wird

Die Simulation betrachtet bewusst nur die erste ausgegebene Zahl. Das ist keine vollstaendige Charakterisierung der gesamten Verteilung, aber bereits ein sehr starkes Signal:

- Wenn schon die erste Position deutlich verzerrt ist, kann die gesamte Permutation nicht uniform sein.
- Fuer den Cache-Ansatz ist die theoretische Obergrenze fuer die Anzahl moeglicher erster Werte genau `min(x, y)`.
- Fuer die uniforme Variante koennen dagegen alle `x` Werte an erster Stelle auftreten.

Zusatzlich wird die Entropie der ersten Position in Bit berechnet.

## Beispielergebnisse aus der aktuellen Simulation

Der Lauf ueber `npm run simulate:bias` liefert aktuell:

| x | y | trials | cacheFirstValues | uniformFirstValues | cacheCoverage | uniformCoverage | cacheEntropyBits | uniformEntropyBits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 4 | 5000 | 4/10 | 10/10 | 0.40 | 1.00 | 2.00 | 3.32 |
| 25 | 4 | 5000 | 4/25 | 25/25 | 0.16 | 1.00 | 2.00 | 4.64 |
| 100 | 4 | 5000 | 4/100 | 100/100 | 0.04 | 1.00 | 2.00 | 6.63 |

### Interpretation

- Beim Cache-Ansatz bleibt die Anzahl moeglicher erster Werte bei festem `y = 4` konstant bei `4`, egal wie gross `x` wird.
- Die Coverage der ersten Position faellt daher von `0.40` ueber `0.16` auf `0.04`.
- Die Entropie der ersten Position bleibt beim Cache-Ansatz bei etwa

$$
\log_2(4) = 2
$$

Bit, weil es effektiv nur vier moegliche erste Werte gibt.
- Die uniforme Variante erreicht fuer die erste Position dagegen alle `x` Werte und eine Entropie nahe

$$
\log_2(x)
$$

also `3.32`, `4.64` und `6.63` Bit fuer `x = 10`, `25` und `100`.

Die Simulation bestaetigt damit die qualitative Analyse sehr klar.

## Praktisches Fazit

- Wenn `x <= y`, ist der Cache-Ansatz aus [src/index.ts](src/index.ts) bereits vollstaendig in Ordnung und sogar uniform.
- Wenn `x > y` und `y` fest bleibt, nimmt die Zufallsqualitaet mit wachsendem `x` deutlich ab.
- Wenn eine echte uniforme Permutation benoetigt wird, ist [src/uniformRandomNumber.ts](src/uniformRandomNumber.ts) der richtige Ansatz.
- Wenn nur wenig Speicher verbraucht werden soll und eine bewusst eingeschraenkte Durchmischung akzeptabel ist, kann der Cache-Ansatz weiterhin sinnvoll sein.

## RoundRobin-Varianten im Vergleich zur uniformen Referenz

Fuer die beiden RoundRobin-Baum-Varianten in [src/roundRobinTreeRandomNumber.ts](src/roundRobinTreeRandomNumber.ts) und [src/roundRobinTreeRandomNumberByLevels.ts](src/roundRobinTreeRandomNumberByLevels.ts) gibt es eine eigene Vergleichssimulation in [src/roundRobinQualitySimulation.ts](src/roundRobinQualitySimulation.ts).

Die Simulation betrachtet vier verschiedene Signale:

- Entropie der ersten Position
- Abweichung der Inversionsrate von `0.5`
- Prefix-Coverage ueber Buckets des Gesamtbereichs
- Blatt-Clusterung, also wie oft benachbarte Ausgaben aus demselben Blatt-Block stammen

### Warum mehrere Kennzahlen noetig sind

Die RoundRobin-Varianten lassen sich nicht mit nur einer einfachen Kennzahl sinnvoll charakterisieren.

- Die erste Position ist fast uniform.
- Die globale Inversionsrate ist ebenfalls fast identisch zu einer uniformen Permutation.
- Trotzdem gibt es eine sehr starke lokale Struktur, weil komplette Blatt-Portionen zusammenhaengend ausgegeben werden.
- Gleichzeitig kann die Prefix-Coverage sogar besser sein als bei einer uniformen Permutation, weil ein Blatt Werte aus weit auseinanderliegenden Bereichen enthalten kann.

### Beispielergebnisse aus `npm run simulate:round-robin-quality`

| n | fixedX | xValues | fixedEntropyBits | levelsEntropyBits | uniformEntropyBits | fixedInversionDelta | levelsInversionDelta | uniformInversionDelta | fixedPrefixCoverage | levelsPrefixCoverage | uniformPrefixCoverage | fixedLeafAdjacency | uniformFixedAdjacency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | 4 | 4, 3, 2 | 4.61 | 4.45 | 4.64 | 0.000 | 0.000 | 0.000 | 0.83 | 0.81 | 0.73 | 0.75 | 0.11 |
| 100 | 4 | 4, 3, 2 | 6.61 | 6.46 | 6.63 | 0.000 | 0.000 | 0.001 | 0.80 | 0.87 | 0.67 | 0.76 | 0.03 |
| 250 | 8 | 8, 4, 2 | 7.93 | 7.93 | 7.93 | 0.000 | 0.000 | 0.000 | 1.00 | 1.00 | 0.94 | 0.88 | 0.03 |

### Interpretation der neuen Kennzahlen

- Die erste Position ist bei beiden RoundRobin-Varianten leicht weniger entropisch als bei der uniformen Referenz, aber der Unterschied ist klein.
- Die Inversionsrate ist bei allen drei Verfahren praktisch `0.5`. Diese Kennzahl allein erkennt den RoundRobin-Bias also kaum.
- Die Prefix-Coverage der ersten `k` Werte ist bei den RoundRobin-Varianten in den gezeigten Szenarien sogar besser als bei der uniformen Referenz. Das liegt daran, dass ein Blatt Werte aus weit auseinanderliegenden Bereichen des Zahlenraums enthalten kann.
- Die Blatt-Clusterung trennt die Verfahren sehr deutlich. Bei `n = 100` liegt sie bei etwa `0.76` fuer beide RoundRobin-Varianten, aber nur bei etwa `0.03` fuer eine uniforme Permutation.

Damit ergibt sich ein klares Bild:

- Global wirken die RoundRobin-Varianten auf den ersten Blick relativ gut.
- Lokal sind sie stark strukturiert.
- Wer moeglichst wenig unmittelbare Nachbarschaftsstruktur will, braucht weiterhin die uniforme Variante.
- Wer fruehe Streuung ueber den Zahlenraum schaetzt und die Blockstruktur akzeptiert, bekommt mit den RoundRobin-Varianten ein interessantes Mittelmodell.

## Ausfuehrung

- Cache-Ansatz demonstrieren: `npm start`
- Uniforme Variante demonstrieren: `npm run start:uniform`
- Bias-Simulation ausfuehren: `npm run simulate:bias`
- RoundRobin-Qualitaet vergleichen: `npm run simulate:round-robin-quality`