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

Fuer die RoundRobin-Baum-Varianten in [src/roundRobinTreeRandomNumber.ts](src/roundRobinTreeRandomNumber.ts), [src/roundRobinTreeRandomNumberByLevels.ts](src/roundRobinTreeRandomNumberByLevels.ts) und [src/roundRobinTreeRandomNumberByLevelsWithCache.ts](src/roundRobinTreeRandomNumberByLevelsWithCache.ts) gibt es eine eigene Vergleichssimulation in [src/roundRobinQualitySimulation.ts](src/roundRobinQualitySimulation.ts).

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
- Die gecachte Levels-Variante mischt genau diese lokale Struktur zusaetzlich auf, ohne den Baum selbst zu ersetzen.

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

### Gecachte Levels-Variante

Die neue Variante in [src/roundRobinTreeRandomNumberByLevelsWithCache.ts](src/roundRobinTreeRandomNumberByLevelsWithCache.ts) setzt auf jeder Ebene einen `numberCache` ein. Dadurch bleibt die baumartige Struktur erhalten, aber die direkte Verkettung kompletter Blatt-Portionen wird stark aufgebrochen.

Beispielergebnisse aus `npm run simulate:round-robin-quality`:

| n | xValues | cacheSize | levelsEntropyBits | cachedLevelsEntropyBits | uniformEntropyBits | levelsPrefixCoverage | cachedLevelsPrefixCoverage | uniformPrefixCoverage | levelsLeafAdjacency | cachedLevelsLeafAdjacency | uniformLevelsAdjacency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | 4, 3, 2 | 8 | 4.45 | 4.64 | 4.64 | 0.81 | 0.74 | 0.73 | 0.75 | 0.19 | 0.11 |
| 100 | 4, 3, 2 | 8 | 6.46 | 6.62 | 6.63 | 0.87 | 0.72 | 0.67 | 0.76 | 0.18 | 0.03 |
| 250 | 8, 4, 2 | 16 | 7.93 | 7.93 | 7.93 | 1.00 | 0.98 | 0.94 | 0.88 | 0.20 | 0.03 |

Interpretation:

- Die Blatt-Clusterung sinkt drastisch. Bei `n = 100` faellt sie von `0.76` auf `0.18`.
- Die Entropie der ersten Position steigt auf das Niveau der uniformen Referenz oder sehr nahe daran.
- Die Prefix-Coverage bleibt hoch, sinkt aber gegenueber der ungecacheten Levels-Variante etwas ab. Das ist der erwartbare Preis fuer die zusaetzliche Durchmischung.
- Die Inversionsrate bleibt weiterhin nahe `0.5`; auch mit Cache ist das also keine trennscharfe Kennzahl.

### Sweep ueber verschiedene Cache-Groessen

Um einen brauchbaren Kompromiss nicht nur fuer einen einzelnen Wert von `cacheSize`, sondern systematisch zu finden, gibt es jetzt eine eigene Sweep-Simulation in [src/roundRobinCacheSweepSimulation.ts](src/roundRobinCacheSweepSimulation.ts).

Die Idee ist:

- Fuer eine feste Baumstruktur werden mehrere `cacheSize`-Werte durchprobiert.
- Standardmaessig werden diese Werte jetzt automatisch als Zweierpotenzen erzeugt.
- Fuer jeden Wert werden dieselben Kennzahlen wie zuvor gemessen.
- Zusaetzlich wird ein Kompromiss-Score berechnet.

Die automatische Obergrenze ist eine pragmatische Heuristik:

$$
\min\left(n, 2^{\lceil \log_2(\max(x_0, \lceil \sqrt{n} \rceil)) \rceil}\right)
$$

Dabei ist `x_0` die Portionsgroesse der untersten Ebene. Die Idee dahinter:

- der Sweep soll gross genug sein, um ueber die Blattgroesse hinaus zu testen,
- aber nicht unnoetig weit laufen,
- und trotzdem nur logarithmisch viele Kandidaten erzeugen.

Fuer die aktuell gezeigten Beispiele ergibt das automatisch:

- bei `n = 100`, `xValues = [4, 3, 2]` die Kandidaten `1, 2, 4, 8, 16`
- bei `n = 250`, `xValues = [8, 4, 2]` die Kandidaten `1, 2, 4, 8, 16`

Der Kompromiss-Score basiert auf genau den beiden Zielen, die sich gegenseitig behindern:

- moeglichst viel Prefix-Coverage-Vorteil gegenueber uniform behalten
- moeglichst viel Blatt-Clusterung gegenueber der ungecacheten Levels-Variante abbauen

Formal wird dafuer gemessen:

- `prefixRetention`: wie viel des Prefix-Coverage-Vorteils der ungecacheten Levels-Variante gegenueber uniform erhalten bleibt
- `leafReduction`: wie viel des Blatt-Clusterungs-Ueberschusses der ungecacheten Levels-Variante gegenueber uniform abgebaut wird

Dann gilt:

$$
	ext{compromiseScore} = \frac{\text{prefixRetention} + \text{leafReduction}}{2}
$$

Ein hoeherer Wert bedeutet also einen besseren Kompromiss zwischen frueher globaler Streuung und schwacher lokaler Clusterung.

Aktuelle Beispiele aus `npm run simulate:round-robin-cache-sweep`:

| n | xValues | getestete cacheSize-Werte | empfohlener cacheSize |
| --- | --- | --- | --- |
| 100 | 4, 3, 2 | 1, 2, 4, 8, 16 | 4 |
| 250 | 8, 4, 2 | 1, 2, 4, 8, 16 | 16 |

Interpretation:

- Kleine Caches behalten mehr Prefix-Coverage, reduzieren die Blatt-Clusterung aber nur wenig.
- Sehr grosse Caches brechen die Blatt-Clusterung stark auf, verlieren aber einen Teil des Prefix-Coverage-Vorteils.
- Der beste Kompromiss liegt daher typischerweise in einem mittleren Bereich und nicht bei den Extremen.
- In den gezeigten Szenarien liegt dieser Kompromiss bei `cacheSize = 4` fuer `n = 100` und bei `cacheSize = 16` fuer `n = 250`.

Damit ergibt sich ein klares Bild:

- Global wirken die RoundRobin-Varianten auf den ersten Blick relativ gut.
- Lokal sind sie stark strukturiert.
- Wer moeglichst wenig unmittelbare Nachbarschaftsstruktur will, braucht weiterhin die uniforme Variante.
- Wer fruehe Streuung ueber den Zahlenraum schaetzt und die Blockstruktur akzeptiert, bekommt mit den RoundRobin-Varianten ein interessantes Mittelmodell.
- Die gecachte Levels-Variante ist ein sinnvoller Kompromiss: deutlich weniger lokale Blatt-Clusterung als die ungecachete Levels-Variante, aber weiterhin weniger Speicherbedarf als eine vollstaendig uniforme Permutation.
- Mit dem Sweep laesst sich dieser Kompromiss fuer konkrete Werte von `n`, `xValues` und `trials` gezielt abstimmen.

## Laufzeit und Speicherverbrauch in O-Notation

Im Folgenden bezeichne ich mit `N` die Gesamtzahl der auszugebenden Werte.

- Fuer den Cache-Ansatz aus [src/index.ts](src/index.ts) ist `N = x`.
- Fuer die RoundRobin-Varianten ist `N = n`.
- Ich nehme an, dass ein Aufruf der Zufallsquelle, ein Array-Zugriff und ein einfacher Tausch jeweils `O(1)` kosten.

Die wichtigste Unterscheidung ist dabei:

- Kosten pro einzelnem `next()`-Aufruf koennen punktuell groesser sein, wenn gerade ein Cache nachgefuellt oder eine neue Portion aufgebaut werden muss.
- Interessanter ist hier daher die amortisierte Kosten pro ausgegebenem Wert und die Gesamtkosten fuer die vollstaendige Folge.

### Uebersicht

| Variante | amortisierte Zeit pro Wert | Gesamtlaufzeit fuer alle `N` Werte | zusaetzlicher Speicher |
| --- | --- | --- | --- |
| Sequentielle Quelle `useNextSequentialNumber` | `O(1)` | `O(N)` | `O(1)` |
| Cache-Generator `useNextNonRepeatingRandomNumber(N, y)` | `O(1)` | `O(N)` | `O(min(N, y))` |
| Uniforme Variante `useNextUniformRandomNumber(N)` | `O(1)` nach Vorbereitung | `O(N)` | `O(N)` |
| RoundRobin-Baum mit festem `x` | `O(1)` amortisiert | `O(N)` fuer konstantes `x >= 2` | `O(x \log_x N)` |
| RoundRobin-Baum mit `xValues` | `O(1)` amortisiert im ueblichen Fall | `O\left(\sum_i m_i\right)` | `O\left(\sum_i \min(m_i, b_i)\right)` |
| Gecachter RoundRobin-Baum mit `xValues` und `cacheSize = c` | `O(1)` amortisiert im ueblichen Fall | `O\left(\sum_i m_i\right)` | `O\left(\sum_i (\min(m_i, b_i) + \min(m_i, c))\right)` |

Fuer die letzten beiden Zeilen gilt:

- `m_0 = N`
- `b_i = xValues[min(i, xValues.length - 1)]`
- `m_{i+1} = \lceil m_i / b_i \rceil`

`m_i` ist also die Problemgroesse auf Ebene `i`, und `b_i` ist die dort verwendete Portionsbreite.

### 1. Sequentielle Quelle in `src/index.ts`

`useNextSequentialNumber(x)` haelt nur einen einzigen Zaehler `nextNumber`.

Pro Aufruf passiert genau folgendes:

- Grenzpruefung
- Rueckgabe des aktuellen Werts
- Inkrement des Zaehlerstands

Jeder dieser Schritte ist konstant teuer. Daher gilt:

- pro Wert `O(1)`
- fuer alle `N` Werte zusammen `O(N)`
- Speicher `O(1)`

Das ist die triviale Baseline.

### 2. Cache-Ansatz in `src/index.ts`

Bei `useNextNonRepeatingRandomNumber(N, y)` werden sequentielle Werte in einen Cache der Groesse `y` eingespeist und daraus zufaellig entnommen.

Warum bleibt die Gesamtlaufzeit linear?

- Jeder Wert wird von der sequentiellen Quelle genau einmal erzeugt.
- Jeder Wert wird genau einmal in den Cache gelegt.
- Jeder Wert wird genau einmal aus dem Cache entnommen.
- Beim Entnehmen fallen nur konstante Array-Operationen an: Index bestimmen, lesen, eventuell ersetzen oder mit dem letzten Element tauschen und `pop()`.

Damit wird jeder der `N` Werte nur eine konstante Anzahl von Malen angefasst. Also:

- Gesamtlaufzeit `O(N)`
- amortisiert pro Wert `O(1)`

Der Speicherverbrauch ergibt sich direkt aus der Cache-Groesse:

- der Cache enthaelt nie mehr als `y` Werte
- insgesamt gibt es aber nur `N` Werte

Also ist der Peak-Speicher

$$
O(\min(N, y))
$$

und fuer den ueblichen Fall `y <= N` einfach `O(y)`.

Ein einzelner frueher `next()`-Aufruf kann zwar `O(min(N, y))` kosten, weil der Cache initial befuellt wird, aber ueber die komplette Folge gemittelt bleibt es `O(1)` pro Wert.

### 3. Uniforme Variante in `src/uniformRandomNumber.ts`

Hier wird zuerst ein Array mit allen `N` Zahlen aufgebaut und dann per Fisher-Yates gemischt.

Die Herleitung ist direkt:

- das Aufbauen des Arrays kostet `O(N)`
- Fisher-Yates durchlaeuft das Array einmal rueckwaerts und macht pro Position nur einen konstant teuren Swap, also ebenfalls `O(N)`
- die spaetere Ausgabe ist nur noch ein sequentielles Weiterlesen aus dem gemischten Array, also `O(1)` pro Wert

Damit gilt insgesamt:

- Gesamtlaufzeit `O(N)`
- Speicher `O(N)`

Die uniforme Variante ist also asymptotisch zeitlich nicht schlechter als der Cache-Ansatz, bezahlt die bessere Verteilungsqualitaet aber mit linearem Speicher.

### 4. RoundRobin-Baum mit festem `x`

Bei [src/roundRobinTreeRandomNumber.ts](src/roundRobinTreeRandomNumber.ts) wird das Problem rekursiv verkleinert.

Auf einer Ebene mit Problemgroesse `m` passiert Folgendes:

- Es werden `\lceil m / x \rceil` Portionen definiert.
- Ueber alle Portionen zusammen wird jedes der `m` Elemente genau einmal in genau eine Portion geschrieben.
- Jede Portion wird lokal gemischt.
- Danach werden die Portionen der Reihe nach ausgegeben.

Die gesamte Arbeit einer Ebene ist daher `O(m)`, nicht `O(m \cdot x)`, weil sich die Portionen nicht ueberlappen und zusammen genau `m` Elemente enthalten.

Damit ergibt sich fuer `x >= 2` die Rekurrenz

$$
T(m) = T(\lceil m / x \rceil) + O(m)
$$

und damit

$$
T(N) = O\left(N + \frac{N}{x} + \frac{N}{x^2} + \dots\right) = O(N)
$$

weil die Reihe geometrisch faellt.

Zum Speicher:

- jede Ebene haelt hoechstens eine aktuelle Portion
- diese Portion hat Groesse hoechstens `x`
- die Anzahl aktiver Ebenen ist `O(\log_x N)`

Also gilt fuer `x >= 2`:

$$
O(x \log_x N)
$$

Fuer konstantes `x` wird daraus `O(\log N)` zusaetzlicher Speicher.

Sonderfall `x = 1`:

- dann faellt die Implementierung auf die sequentielle Quelle zurueck
- Laufzeit also `O(N)`
- Speicher `O(1)`

### 5. RoundRobin-Baum mit `xValues`

Bei [src/roundRobinTreeRandomNumberByLevels.ts](src/roundRobinTreeRandomNumberByLevels.ts) kann jede Ebene eine andere Portionsbreite haben.

Wenn `b_i` die Portionsbreite der Ebene `i` ist und `m_i` die jeweilige Problemgroesse, dann kostet Ebene `i` wieder `O(m_i)`, aus genau demselben Grund wie oben: jedes Element dieser Ebene wird genau einmal in eine Portion gelegt, lokal gemischt und spaeter einmal ausgegeben.

Die Gesamtlaufzeit ist daher

$$
O\left(\sum_i m_i\right)
$$

Das ist die sauberste allgemeine Form.

Im typischen Fall, dass die Baumstruktur wirklich schrumpft, also ab irgendeinem Punkt immer `b_i >= 2` gilt, faellt `m_i` geometrisch und damit folgt wieder:

$$
O(N)
$$

Warum schreibe ich hier trotzdem die Summenform hin? Weil `xValues` auch `1` enthalten darf. Wenn mehrere fruehe Ebenen `b_i = 1` haben, schrumpft das Problem dort noch nicht, und jede solche Ebene kostet noch einmal `O(N)`. Die Summenform macht genau das sichtbar.

Der Speicherverbrauch ist die Summe der gleichzeitig gehaltenen Portionen:

$$
O\left(\sum_i \min(m_i, b_i)\right)
$$

Denn auf Ebene `i` ist die aktuelle Portion nie groesser als die lokale Portionsbreite `b_i`, aber natuerlich auch nie groesser als das Restproblem `m_i`.

Im haeufigen Fall fester, kleiner `xValues` mit echter Schrumpfung auf jeder Ebene ergibt sich daraus praktisch logarithmischer Speicherverbrauch in `N`.

### 6. Gecachter RoundRobin-Baum

Bei [src/roundRobinTreeRandomNumberByLevelsWithCache.ts](src/roundRobinTreeRandomNumberByLevelsWithCache.ts) kommt auf jeder Ebene noch ein `numberCache` mit Groesse `c` dazu.

Zeitlich aendert das asymptotisch weniger, als man zunaechst vermuten koennte:

- Die zugrunde liegende Ebenenquelle produziert weiterhin genau `m_i` Werte.
- Jeder dieser Werte wird auf Ebene `i` zusaetzlich genau einmal in den Cache eingelegt und genau einmal wieder entnommen.
- Diese Cache-Operationen sind jeweils konstant teuer.

Damit bleibt die Zeit pro Ebene `O(m_i)`, nur mit einer groesseren Konstanten. Insgesamt also wieder:

$$
O\left(\sum_i m_i\right)
$$

und im ueblichen schrumpfenden Fall wieder `O(N)`.

Beim Speicher kommt der Cache pro Ebene zusaetzlich zur aktuellen Portion hinzu. Daher:

$$
O\left(\sum_i (\min(m_i, b_i) + \min(m_i, c))\right)
$$

Im typischen Fall konstanter kleiner `xValues` und konstanter `cacheSize` bedeutet das weiterhin nur logarithmischen Speicher in `N`, aber mit einem groesseren konstanten Faktor als ohne Cache.

### Praktische Einordnung

Die asymptotischen Unterschiede sind kleiner als die qualitativen Unterschiede der Verteilungen:

- zeitlich liegen fast alle Generatoren fuer eine vollstaendige Folge bei `O(N)`
- der wesentliche Unterschied liegt vor allem im Speicher
- die uniforme Variante braucht `O(N)` Speicher
- der einfache Cache-Ansatz braucht nur `O(y)`
- die RoundRobin-Varianten liegen dazwischen und haengen von Ebenentiefe, Portionsbreiten und zusaetzlichem Cache ab

Fuer die Wahl der Methode bedeutet das praktisch:

- Wenn Speicher knapp ist, sind Cache- und RoundRobin-Verfahren attraktiv.
- Wenn eine wirklich uniforme Permutation benoetigt wird, ist der lineare Speicher der Fisher-Yates-Variante der Preis fuer die saubere Statistik.
- Wenn man eine Baumstruktur behalten, aber lokale Clusterung reduzieren will, ist die gecachte Levels-Variante asymptotisch weiterhin linear in der Zeit und meistens noch deutlich unter `O(N)` beim Speicher.

## Ausfuehrung

- Cache-Ansatz demonstrieren: `npm start`
- Uniforme Variante demonstrieren: `npm run start:uniform`
- Bias-Simulation ausfuehren: `npm run simulate:bias`
- RoundRobin-Qualitaet vergleichen: `npm run simulate:round-robin-quality`
- Cache-Size-Sweep fuer RoundRobin ausfuehren: `npm run simulate:round-robin-cache-sweep`