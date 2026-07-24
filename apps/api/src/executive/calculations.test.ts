import { describe, expect, it } from 'vitest';
import {
  calculateBudgetVariance,
  calculateExecutiveHealth,
  calculateInitiativeProgress,
  calculateInitiativeStatus,
  calculateKpiStatus,
  calculateMetricAssessment,
  calculateRiskScore,
  riskHeatBand,
} from './calculations.js';

const weights = {
  governance: 20,
  strategic: 20,
  operational: 20,
  financial: 15,
  risk: 15,
  knowledge: 10,
};

describe('Enterprise 23 calculations', () => {
  it('calculates KPI status without fabricating a missing measurement', () => {
    expect(calculateKpiStatus(null, 100, 0)).toBe('NOT_STARTED');
    expect(calculateKpiStatus(85, 100, 0)).toBe('ON_TRACK');
    expect(calculateKpiStatus(100, 100, 0)).toBe('COMPLETED');
  });

  it('calculates initiative progress and schedule status', () => {
    expect(calculateInitiativeProgress([{ progress: 50 }, { progress: 100 }])).toBe(75);
    expect(calculateInitiativeStatus(50, new Date('2025-01-01'), new Date('2025-02-01'))).toBe(
      'DELAYED',
    );
  });

  it('calculates budget variance', () => {
    expect(calculateBudgetVariance(1000, 1250)).toEqual({
      amount: -250,
      percentage: -25,
      overBudget: true,
    });
  });

  it('calculates metric variance and automatic threshold status', () => {
    expect(calculateMetricAssessment(null, 90, 75, 60)).toEqual({
      status: 'missing',
      variance: null,
    });
    expect(calculateMetricAssessment(55, 90, 75, 60)).toEqual({
      status: 'critical',
      variance: -35,
    });
    expect(calculateMetricAssessment(3, 0, 2, 5, false).status).toBe('warning');
  });

  it('calculates risk score and heat band', () => {
    expect(calculateRiskScore('LIKELY', 'SEVERE')).toBe(20);
    expect(riskHeatBand(20)).toBe('critical');
    expect(riskHeatBand(8)).toBe('medium');
  });

  it('calculates a fully covered health score and rating', () => {
    const health = calculateExecutiveHealth(
      {
        governance: 90,
        strategic: 80,
        operational: 70,
        financial: 100,
        risk: 60,
        knowledge: 90,
      },
      weights,
    );
    expect(health.coverage).toBe(100);
    expect(health.score).toBe(81);
    expect(health.rating).toBe('جيد جدًا');
  });

  it('identifies missing health data and does not replace it with zero', () => {
    const health = calculateExecutiveHealth(
      {
        governance: 80,
        strategic: null,
        operational: null,
        financial: null,
        risk: null,
        knowledge: null,
      },
      weights,
    );
    expect(health.score).toBe(80);
    expect(health.coverage).toBe(20);
    expect(health.missingData).toHaveLength(5);
    expect(health.explanation).toContain('دون افتراض');
  });
});
