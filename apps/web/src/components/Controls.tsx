import {
  USE_CASE_LABELS,
  USE_CASES,
  listConsumerPlans,
  listModels,
  type EffortLevel,
  type ModelSpec,
  type PlatformId,
  type UseCase,
} from '@promptgenius/core';

const EFFORT_LABELS: Record<EffortLevel, string> = {
  none: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
};

export function Controls(props: {
  advanced: boolean;
  platform: PlatformId;
  useCase: UseCase;
  onUseCase: (u: UseCase) => void;
  model: ModelSpec;
  onModel: (id: string) => void;
  effort: EffortLevel;
  onEffort: (e: EffortLevel) => void;
  planId: string;
  onPlan: (id: string) => void;
}) {
  const plans = listConsumerPlans(props.platform);
  return (
    <div className="controls">
      <label className="field">
        <span>Use case</span>
        <select value={props.useCase} onChange={(e) => props.onUseCase(e.target.value as UseCase)}>
          {USE_CASES.map((u) => (
            <option key={u} value={u}>
              {USE_CASE_LABELS[u]}
            </option>
          ))}
        </select>
      </label>

      {props.advanced ? (
        <>
          <label className="field">
            <span>Model</span>
            <select value={props.model.id} onChange={(e) => props.onModel(e.target.value)}>
              {listModels(props.platform).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Reasoning effort</span>
            <select
              value={props.effort}
              disabled={!props.model.reasoning}
              onChange={(e) => props.onEffort(e.target.value as EffortLevel)}
            >
              {(props.model.reasoning?.levels ?? ['none']).map((l) => (
                <option key={l} value={l}>
                  {EFFORT_LABELS[l]}
                  {props.model.reasoning?.default === l ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className="field">
          <span>Your plan</span>
          <select value={props.planId} onChange={(e) => props.onPlan(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.verified ? '' : ' (unverified)'}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
