# KPI Methodology

## Definition quality

Every KPI should have a unique code, unambiguous Arabic title, objective, formula, baseline, target, unit, frequency, owner, data source, and measurement evidence where available. The owner approves each measurement's source and date.

## Automatic status

The API calculates progress between baseline and target:

`(current - baseline) ÷ (target - baseline) × 100`

|          Progress | Status        |
| ----------------: | ------------- |
|    No measurement | `NOT_STARTED` |
|  At or above 100% | `COMPLETED`   |
| 80% to below 100% | `ON_TRACK`    |
|  60% to below 80% | `AT_RISK`     |
|         Below 60% | `OFF_TRACK`   |

If baseline equals target, a current value meeting the target is complete; otherwise it is off track. This release assumes progress improves toward the target. A future direction/formula strategy may be added for inverse or non-linear KPIs without changing stored measurements.

## Measurement controls

- Use the measurement endpoint; do not directly edit current values.
- Record the effective measurement date, source document when relevant, and a concise note.
- Corrections must remain auditable; do not delete historical data in production.
- Percentage inputs and objective/initiative progress are constrained to 0–100.
- Dashboard trends contain actual measurements only and never fill missing periods.

## Review cadence

Review at the KPI's stored frequency. Investigate stale measurements, at-risk/off-track status, and conflicting sources. Link corrective work to an operational initiative or risk treatment as appropriate.
