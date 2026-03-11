// src/services/alarm-evaluator.ts
// Alarm Evaluation Engine — evaluates telemetry values against configured alarm thresholds

import { pool } from './postgres-service';

interface AlarmRow {
  id: number;
  name: string;
  measurement: string;
  comparison_operator: '<' | '>' | '=' | '<>';
  threshold_value: number;
  severity: string;
  group_name: string;
  current_state: string;
  last_value: number | null;
}

const QUERY_ALARMS = `
  SELECT a.id, a.name, a.measurement, a.comparison_operator, a.threshold_value,
         a.severity, g.name AS group_name, s.current_state, s.last_value
  FROM scada.alarms a
  JOIN scada.alarm_groups g ON g.id = a.group_id
  JOIN scada.alarm_state s ON s.alarm_id = a.id
  WHERE TRIM(a.dev_eui) = $1 AND a.is_enabled = true AND g.is_enabled = true
`;

function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>':  return value > threshold;
    case '<':  return value < threshold;
    case '=':  return value === threshold;
    case '<>': return value !== threshold;
    default:   return false;
  }
}

export async function evaluateAlarmsForDevice(
  devEUI: string,
  telemetryValues: Record<string, number | null>
): Promise<void> {
  if (!pool) return;

  const { rows: alarms } = await pool.query<AlarmRow>(QUERY_ALARMS, [devEUI.trim()]);

  if (alarms.length === 0) return;

  for (const alarm of alarms) {
    const value = telemetryValues[alarm.measurement];
    if (value === null || value === undefined) continue;

    const conditionMet = evaluateCondition(value, alarm.comparison_operator, alarm.threshold_value);
    const prevState = alarm.current_state;

    let newState: string | null = null;
    let reason = '';

    if (conditionMet && prevState === 'INACTIVE') {
      newState = 'ACTIVE_UNACK';
      reason = 'condition_met';
    } else if (!conditionMet && (prevState === 'ACTIVE_UNACK' || prevState === 'ACTIVE_ACK')) {
      newState = 'INACTIVE';
      reason = 'condition_cleared';
    }

    if (newState) {
      // State transition — update alarm_state + insert alarm_history
      const now = new Date();

      await pool.query(
        `UPDATE scada.alarm_state
         SET current_state = $1,
             last_value = $2,
             last_evaluated_at = $3,
             last_triggered_at = CASE WHEN $1 = 'ACTIVE_UNACK' THEN $3 ELSE last_triggered_at END,
             condition_met_since = CASE WHEN $1 = 'ACTIVE_UNACK' THEN $3 ELSE condition_met_since END,
             condition_cleared_since = CASE WHEN $1 = 'INACTIVE' THEN $3 ELSE condition_cleared_since END,
             acknowledged_by = CASE WHEN $1 = 'INACTIVE' THEN NULL ELSE acknowledged_by END,
             acknowledged_at = CASE WHEN $1 = 'INACTIVE' THEN NULL ELSE acknowledged_at END,
             ack_comment = CASE WHEN $1 = 'INACTIVE' THEN NULL ELSE ack_comment END
         WHERE alarm_id = $4`,
        [newState, value, now, alarm.id]
      );

      await pool.query(
        `INSERT INTO scada.alarm_history
           (alarm_id, previous_state, new_state, trigger_value, threshold_value, transition_reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [alarm.id, prevState, newState, value, alarm.threshold_value, reason]
      );

      const arrow = `${prevState} → ${newState}`;
      const icon = newState === 'ACTIVE_UNACK' ? '🚨' : '✅';
      console.log(
        `${icon} [ALARM] "${alarm.name}" ${arrow} ` +
        `(${alarm.measurement} = ${value}, threshold ${alarm.comparison_operator} ${alarm.threshold_value})`
      );
    } else {
      // No transition — just update last_value and last_evaluated_at
      await pool.query(
        `UPDATE scada.alarm_state
         SET last_value = $1, last_evaluated_at = $2
         WHERE alarm_id = $3`,
        [value, new Date(), alarm.id]
      );
    }
  }
}
