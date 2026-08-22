# SWDE Water Consumption

This external integration publishes the **meter index**, **period consumption**, and **daily average** for a water meter served by SWDE. Every indicator is kept in Gladys history, so it can be placed on a dashboard and plotted over time.

> The official SWDE customer portal provides consumption history after sign-in, but SWDE does not document a public automation API. This integration never receives an SWDE password and never drives the web portal. [1]

| Gladys indicator   | Unit  | Meaning                                                    |
| ------------------ | ----- | ---------------------------------------------------------- |
| Meter index        | m³    | Cumulative reading from the water meter.                   |
| Period consumption | m³    | Water volume consumed during the reference period.         |
| Daily average      | L/day | Calculated from period consumption and its number of days. |

## Installation and meter discovery

Install the integration from the Gladys catalog and open its **Configuration** tab. Choose a stable local identifier for the meter, such as the final digits of its serial number, and give it a readable name. Do not enter a SWDE customer number: the integration does not need it.

Save the configuration, open the integration **Discovery** tab, and add the proposed meter. Its three read-only sensors will then be available in Gladys dashboards and state history.

## Manual readings for a household account

Choose **Manual meter readings** when you read the meter directly or consult the SWDE customer portal. Enter the cumulative index in m³, the consumption for your reference period, and the number of days in that period. Save the configuration after each new reading: Gladys publishes the values and recalculates the daily average.

For a household account, this is the most dependable method because it does not depend on an undocumented private interface. SWDE confirms that consumption history is available through the customer portal. [1]

## Authorised JSON data source

Choose **Authorised JSON endpoint** only if you have an explicit, documented or contracted interface, such as an easyCONSO service, an approved SWDE export, or your own data gateway. Enter the HTTPS endpoint and, if required, a bearer token. The token is stored in a protected Gladys secret field and is sent in the `Authorization: Bearer …` header.

The endpoint must answer a `GET` request with a JSON object, either directly or wrapped in a `data` property. It must include `total_m3` and/or `period_m3`; `period_days` is optional but needed for the daily-average calculation. Camel-case alternatives are accepted as well.

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

The default refresh interval is one hour. Choose a moderate interval: water-consumption readings rarely need minute-by-minute polling, while Gladys keeps a state history. The integration also avoids republishing an unchanged value during its current session.

## Testing and troubleshooting

Use **Test the data source** before adding the meter or after changing an endpoint. The result confirms the recognized values without exposing a token. On failure, check that Gladys can reach the endpoint, the token is valid, and the response follows the schema above. Finally, consult the integration logs; set `LOG_LEVEL=debug` for more detail.

SWDE’s easyCONSO solution is separate from the general customer portal. It promotes automatic index readings and real-time consumption monitoring for smart meters under a specific service arrangement. [2]

## References

[1] [SWDE — View my consumption history](https://www.swde.be/fr/voir-mon-historique-de-consommation)

[2] [SWDE easyCONSO — Optimise water-consumption management](https://swde.easyconso.be/)
