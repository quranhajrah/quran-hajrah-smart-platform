# Institutional Risk Methodology

## Scales

Likelihood and impact each use a five-level scale:

| Value | Likelihood     | Impact        |
| ----: | -------------- | ------------- |
|     1 | Rare           | Insignificant |
|     2 | Unlikely       | Minor         |
|     3 | Possible       | Moderate      |
|     4 | Likely         | Major         |
|     5 | Almost certain | Severe        |

Risk score is `likelihood × impact`, producing 1–25. The API calculates both inherent and residual scores; clients cannot submit either score directly.

## Heat bands

| Score | Band     |
| ----: | -------- |
|   1–5 | Low      |
|  6–11 | Medium   |
| 12–19 | High     |
| 20–25 | Critical |

The operational critical-risk list uses residual score 15 or above to provide a deliberately conservative executive escalation threshold. The heat grid still displays the complete 5×5 distribution.

## Required practice

1. Describe the risk, cause, consequence, category, and owner.
2. Assess inherent likelihood and impact before controls.
3. Record existing controls.
4. Assess residual likelihood and impact after controls.
5. Add a dated treatment with owner and measurable progress where required.
6. Link only authorized evidence documents.
7. Review on the stored review date and close only with approved evidence.

Overdue treatments, critical residual risks, and linked initiative status feed structured alert generation. All mutations and alert actions are audited.
