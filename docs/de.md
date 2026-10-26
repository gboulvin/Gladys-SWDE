# SWDE-Wasserverbrauch

Diese externe Integration veröffentlicht in Gladys den **Zählerstand**, den **Verbrauch im Zeitraum** und das **Tagesmittel** eines Wasserzählers der SWDE (Société wallonne des eaux). Jeder Wert wird im Gladys-Verlauf gespeichert, in einem eigenen Dashboard-Widget angezeigt und kann Ihre Szenen auslösen: eine neue Ablesung oder ein Tagesverbrauch über Ihrer Alarmschwelle (Leck, offener Wasserhahn).

> Das offizielle SWDE-Kundenportal zeigt den Verbrauchsverlauf nach der Anmeldung, die SWDE dokumentiert aber keine öffentliche Automatisierungs-API. Diese Integration erhält daher nie ein SWDE-Passwort und steuert nicht das Webportal. [1]

| Gladys-Wert        | Einheit | Bedeutung                                                      |
| ------------------ | ------- | -------------------------------------------------------------- |
| Zählerstand        | m³      | Kumulierter Stand des Wasserzählers.                           |
| Verbrauch Zeitraum | m³      | Im Referenzzeitraum verbrauchtes Wasservolumen.                |
| Tagesmittel        | L/Tag   | Berechnet aus dem Verbrauch des Zeitraums und seiner Tagezahl. |

Gladys 5.3.0 oder neuer ist erforderlich.

## Installation und Erkennung des Zählers

Installieren Sie die Integration aus dem Gladys-Katalog und öffnen Sie den Reiter **Konfiguration**. Wählen Sie eine stabile lokale Kennung für den Zähler, z. B. die letzten Ziffern der Zählernummer, und einen lesbaren Namen. Geben Sie keine SWDE-Kundennummer ein: Die Integration benötigt sie nicht. Die Kennung ist Teil der Geräteidentität in Gladys: Eine spätere Änderung erzeugt ein neues Gerät.

Speichern Sie die Konfiguration, öffnen Sie den Reiter **Erkennung** und fügen Sie den vorgeschlagenen Zähler hinzu. Seine drei schreibgeschützten Sensoren stehen dann in den Dashboards und im Zustandsverlauf von Gladys zur Verfügung.

## Manuelle Ablesung für einen Privatkunden

Wählen Sie **Manuelle Zählerablesung**, wenn Sie den Zähler direkt ablesen oder das SWDE-Kundenportal nutzen. Geben Sie den Zählerstand in m³, den Verbrauch Ihres Referenzzeitraums und dessen Anzahl Tage ein. Speichern Sie die Konfiguration nach jeder neuen Ablesung: Gladys veröffentlicht die Werte und berechnet das Tagesmittel neu.

Für Privatkunden ist dies die zuverlässigste Methode, da sie von keiner undokumentierten privaten Schnittstelle abhängt. Die SWDE bestätigt, dass der Verbrauchsverlauf im Kundenportal verfügbar ist. [1]

## Autorisierte JSON-Datenquelle

Wählen Sie **Autorisierter JSON-Endpunkt** nur, wenn Sie über eine ausdrücklich dokumentierte oder vertraglich vereinbarte Schnittstelle verfügen, etwa einen easyCONSO-Dienst, einen genehmigten SWDE-Export oder Ihr eigenes Gateway. Geben Sie die URL des Endpunkts und bei Bedarf ein Bearer-Token ein. Das Token wird in einem geschützten Gladys-Geheimfeld gespeichert und im Header `Authorization: Bearer …` gesendet.

Der Endpunkt muss eine `GET`-Anfrage mit einem JSON-Objekt beantworten, direkt oder in einer Eigenschaft `data`. Es muss `total_m3` und/oder `period_m3` enthalten; `period_days` ist optional, aber für das Tagesmittel nötig. Die CamelCase-Varianten (`totalM3`, `periodM3`, `periodDays`) sowie `index_m3` / `consumption_m3` werden ebenfalls akzeptiert.

```json
{
  "total_m3": 245.7,
  "period_m3": 9.0,
  "period_days": 30,
  "reading_at": "2026-08-22T09:00:00Z"
}
```

| Feld          | Pflicht                          | Prüfung                                     |
| ------------- | -------------------------------- | ------------------------------------------- |
| `total_m3`    | Nein, wenn `period_m3` vorhanden | Zahl größer oder gleich null.               |
| `period_m3`   | Nein, wenn `total_m3` vorhanden  | Zahl größer oder gleich null.               |
| `period_days` | Nein                             | Positive Zahl, für das Tagesmittel genutzt. |
| `reading_at`  | Nein                             | Informativer ISO-8601-Zeitstempel.          |

## Lokale oder Cloud-Verbindung

Die Integration deklariert beide Kanäle. Der Zähler zeigt in Gladys ein Abzeichen:

| Abzeichen            | Wann                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Lokal**            | Manuelle Ablesung oder ein Endpunkt in Ihrem Netz (private IP, `localhost`, `.local`, `.lan`). |
| **Cloud**            | Ein Endpunkt im Internet (easyCONSO, Drittanbieter…).                                          |
| **Nicht erreichbar** | Der letzte Abruf der Datenquelle ist fehlgeschlagen.                                           |

Der Kanal folgt der konfigurierten Quelle: Der von Gladys angezeigte Schalter „Lokale Verbindung bevorzugen“ hat bei einem einzelnen Wasserzähler keine Wahl zu treffen.

## Aktualisierungsintervall

Gladys fragt den Zähler jede Minute ab, die Integration liest die Quelle im konfigurierten Intervall (standardmäßig eine Stunde, 5 Minuten bis 24 Stunden). Unveränderte Werte werden nicht erneut veröffentlicht, außer alle 6 Stunden, damit der Zähler aktuell datiert bleibt.

## Dashboard-Widget

Fügen Sie das Widget **SWDE-Wasserverbrauch** einem Dashboard hinzu. Es zeigt:

- drei Live-Kacheln: Zählerstand, Verbrauch im Zeitraum, Tagesmittel (orange über der Alarmschwelle);
- ein Diagramm des Tagesmittels über den letzten Monat, die letzten 3 Monate (Standard) oder das letzte Jahr — Einstellung **Diagrammzeitraum** des Widgets;
- die Datenquelle, ihren Zustand, die Zeit des letzten Abrufs und den Alarmzustand;
- eine Schaltfläche **Aktualisieren**, die die Quelle sofort liest.

## Szenen

### Auslöser

| Auslöser                    | Wird ausgelöst, wenn                                                                                       | Variablen                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Neuer Wasserzählerstand** | Der Zählerstand hat sich seit dem letzten Abruf geändert (der erste Abruf nach einem Start ist die Basis). | `total_m3`, `delta_m3`, `period_m3`, `daily_average_liters` |
| **Hoher Wasserverbrauch**   | Das Tagesmittel übersteigt die **Tagesalarm-Schwelle** (einmal pro Überschreitung).                        | `daily_average_liters`, `threshold_liters`                  |

Beide Auslöser lassen sich nach Zähler filtern. Legen Sie die Schwelle im Abschnitt **Alarme und Aktualisierung** der Konfiguration fest; `0` deaktiviert den Alarm. Beispiel: Senden Sie sich die Nachricht „Wasser: {{triggerEvent.data.daily_average_liters}} L/Tag, mögliches Leck!“.

### Aktion

**Wasserzähler lesen** liest die Quelle sofort und gibt `total_m3`, `period_m3`, `daily_average_liters` und `above_threshold` (wahr/falsch) an die folgenden Aktionen der Szene weiter. Sie löst selbst nie einen Auslöser aus, eine Szene kann also keine Schleife bilden.

## Test und Fehlerbehebung

Verwenden Sie **Datenquelle testen**, bevor Sie den Zähler hinzufügen oder nachdem Sie einen Endpunkt geändert haben. Das Ergebnis bestätigt die erkannten Werte, ohne das Token preiszugeben. Prüfen Sie bei einem Fehler, ob Gladys den Endpunkt erreicht, ob das Token gültig ist und ob die Antwort dem obigen Schema entspricht. Der Konfigurationsbildschirm zeigt den Verbindungsstatus; prüfen Sie zuletzt die Protokolle der Integration (`LOG_LEVEL=debug` für mehr Details).

Die easyCONSO-Lösung der SWDE ist vom allgemeinen Kundenportal getrennt. Sie bietet automatische Zählerablesungen und Echtzeit-Verbrauchsüberwachung für intelligente Zähler im Rahmen eines eigenen Dienstes. [2]

## Quellen

[1] [SWDE — Voir mon historique de consommation](https://www.swde.be/fr/voir-mon-historique-de-consommation)

[2] [SWDE easyCONSO — Optimisez la gestion de vos consommations d’eau](https://swde.easyconso.be/)
