# Executive Health Score Methodology

## Components and default weights

| Component                     | Default weight | Source                                                    |
| ----------------------------- | -------------: | --------------------------------------------------------- |
| Governance                    |            20% | `governance_score` metric                                 |
| Strategic execution           |            20% | `strategic_plan_progress` metric                          |
| Operational execution         |            20% | `operational_plan_progress` metric                        |
| Financial health              |            15% | Distance of `budget_execution_rate` from 100%             |
| Risk health                   |            15% | Inverse normalized average residual risk score            |
| Knowledge/document compliance |            10% | Active visible documents divided by all visible documents |

Weights must each be between 0 and 100 and total exactly 100. An actor with `dashboard.configure` can save personal weights. The institutional default remains 20/20/20/15/15/10.

## Calculation

Each available component is clamped to 0–100. Its contribution is:

`component score × component weight ÷ 100`

Missing components receive no assumed value. The displayed score is normalized over the sum of **available** weights:

`sum of available contributions ÷ sum of available weights × 100`

The response and UI always display data coverage and name every missing component. A high score with low coverage must not be interpreted as complete institutional health.

Financial health is `100 - absolute(100 - execution rate)`, bounded to 0–100. Risk health maps average residual score 1–25 inversely to 100–0.

## Rating

|    Score | Arabic rating |
| -------: | ------------- |
|   90–100 | ممتاز         |
| 80–89.99 | جيد جدًا      |
| 70–79.99 | جيد           |
| 60–69.99 | يحتاج تحسين   |
| Below 60 | حرج           |

If no component is available, the score and rating are `null`, coverage is 0%, and the explanation says it cannot be calculated.

## Governance

- Save snapshots only after reviewing input freshness.
- Do not compare snapshots whose coverage materially differs without noting that difference.
- Changing weights is audited and does not rewrite historical snapshots.
- Metric owners remain accountable for sources, dates, and notes.
- The score is an executive aid, not a substitute for statutory, financial, or governance review.
