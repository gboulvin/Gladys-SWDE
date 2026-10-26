# SWDE Water Consumption

This external integration publishes the **meter index**, **period consumption** and **daily average** of a water meter served by SWDE (Société wallonne des eaux). Every indicator is kept in Gladys history, shown on a dedicated dashboard widget, and can start your scenes: a new reading, or a daily consumption above your alert threshold (leak, tap left open).

> The official SWDE customer portal provides consumption history after sign-in, but SWDE does not document a public automation API. This integration never receives an SWDE password and never drives the web portal. [1]

| Gladys indicator   | Unit  | Meaning                                                    |
| ------------------ | ----- | ---------------------------------------------------------- |
| Meter index        | m³    | Cumulative reading from the water meter.                   |
| Period consumption | m³    | Water volume consumed during the reference period.         |
| Daily average      | L/day | Calculated from period consumption and its number of days. |

Gladys 5.3.0 or later is required.

## Installation and meter discovery

Install the integration from the Gladys catalog and open its **Configuration** tab. Choose a stable local identifier for the meter, such as the final digits of its serial number, and give it a readable name. Do not enter an SWDE customer number: the integration does not need it. The identifier is part of the device identity in Gladys: changing it later creates a new device.

Save the configuration, open the integration **Discovery** tab, and add the proposed meter. Its three read-only sensors are then available in Gladys dashboards and state history.

## Manual readings for a household account

Choose **Manual meter readings** when you read the meter directly or consult the SWDE customer portal. Enter the cumulative index in m³, the consumption for your reference period, and the number of days in that period. Save the configuration after each new reading: Gladys publishes the values and recalculates the daily average.

For a household account, this is the most dependable method because it does not depend on an undocumented private interface. SWDE confirms that consumption history is available through the customer portal. [1]

## Authorised JSON data source

Choose **Authorised JSON endpoint** only if you have an explicit, documented or contracted interface, such as an easyCONSO service, an approved SWDE export, or your own data gateway. Enter the endpoint URL and, if required, a bearer token. The token is stored in a protected Gladys secret field and is sent in the `Authorization: Bearer …` header.

The endpoint must answer a `GET` request with a JSON object, either directly or wrapped in a `data` property. It must include `total_m3` and/or `period_m3`; `period_days` is optional but needed for the daily average. Camel-case alternatives (`totalM3`, `periodM3`, `periodDays`) and `index_m3` / `consumption_m3` are accepted as well.

```json
{
  "total_m3": 245.7,
  "period_m3": 9.0,
  "period_days": 30,
  "reading_at": "2026-08-22T09:00:00Z"
}
```

| Field         | Required                      | Validation                                   |
| ------------- | ----------------------------- | -------------------------------------------- |
| `total_m3`    | No, if `period_m3` is present | Number greater than or equal to zero.        |
| `period_m3`   | No, if `total_m3` is present  | Number greater than or equal to zero.        |
| `period_days` | No                            | Positive number; used for the daily average. |
| `reading_at`  | No                            | Informational ISO 8601 timestamp.            |

## Local or cloud connection

The integration declares both channels. The meter shows a badge in Gladys:

| Badge           | When                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Local**       | Manual readings, or an endpoint on your network (private IP, `localhost`, `.local`, `.lan`). |
| **Cloud**       | An endpoint on the Internet (easyCONSO, third-party service…).                               |
| **Unreachable** | The last read of the data source failed.                                                     |

The channel follows the configured source: the “Prefer the local connection” switch shown by Gladys has nothing to choose between for a single water meter.

## Refresh interval

Gladys polls the meter every minute and the integration reads the source at the configured interval (one hour by default, 5 minutes to 24 hours). Water readings rarely need minute-by-minute polling. Unchanged values are not republished, except every 6 hours so the meter stays recently dated.

## Dashboard widget

Add the **SWDE water consumption** widget to a dashboard. It shows:

- three live tiles: index, period consumption, daily average (orange above the alert threshold);
- a chart of the daily average over the last month, 3 months (default) or year — the **Chart period** setting of the widget;
- the data source, its state, the time of the last read and the alert state;
- a **Refresh** button that reads the source immediately.

## Scenes

### Triggers

| Trigger                     | Fires when                                                                                      | Variables                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **New water-meter reading** | The meter index changed since the previous read (the first read after a start is the baseline). | `total_m3`, `delta_m3`, `period_m3`, `daily_average_liters` |
| **High water consumption**  | The daily average goes above the **Daily alert threshold** (once per crossing).                 | `daily_average_liters`, `threshold_liters`                  |

Both triggers can be filtered on the meter. Set the threshold in the **Alerts and refresh** section of the configuration; `0` disables the alert. Example: send yourself a message “Water: {{triggerEvent.data.daily_average_liters}} L/day, possible leak!”.

### Action

**Read the water meter** reads the source immediately and returns `total_m3`, `period_m3`, `daily_average_liters` and `above_threshold` (true/false) to the following actions of the scene. It never fires a trigger itself, so a scene cannot loop.

## Testing and troubleshooting

Use **Test the data source** before adding the meter or after changing an endpoint. The result confirms the recognised values without exposing a token. On failure, check that Gladys can reach the endpoint, the token is valid, and the response follows the schema above. The Configuration screen shows the connection status; finally, consult the integration logs (`LOG_LEVEL=debug` for more detail).

SWDE’s easyCONSO solution is separate from the general customer portal. It promotes automatic index readings and real-time consumption monitoring for smart meters under a specific service arrangement. [2]

## References

[1] [SWDE — View my consumption history](https://www.swde.be/fr/voir-mon-historique-de-consommation)

[2] [SWDE easyCONSO — Optimise water-consumption management](https://swde.easyconso.be/)
