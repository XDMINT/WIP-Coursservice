const DEFAULT_PASS_THRESHOLD_PERCENT = 50;
const DEFAULT_MAX_SCORE = 10;

const toPositiveNumber = (value, fallback) => {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const calculatePassed = (score, maxScore, passThresholdPercent) => {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return null;
  }

  return (score / maxScore) * 100 >= passThresholdPercent;
};

const evaluateSubmission = (input = {}) => {
  const submission = input.submission && typeof input.submission === 'object'
    ? input.submission
    : {};
  const maxScore = toPositiveNumber(input.maxScore ?? input.maxPoints, DEFAULT_MAX_SCORE);
  const passThresholdPercent = toPositiveNumber(
    input.passThresholdPercent ?? input.passThreshold,
    DEFAULT_PASS_THRESHOLD_PERCENT,
  );
  const shouldPass = submission.passed === false ? false : true;
  const score = shouldPass
    ? Math.max(0, Math.min(maxScore, Math.ceil((maxScore * Math.max(passThresholdPercent, 1)) / 100)))
    : Math.max(0, Math.floor((maxScore * Math.max(passThresholdPercent - 1, 0)) / 100));
  const passed = calculatePassed(score, maxScore, passThresholdPercent) ?? shouldPass;

  return {
    taskId: String(input.taskId ?? ''),
    score,
    maxScore,
    passed,
    feedback: passed
      ? 'Demo-Bewertung erfolgreich.'
      : 'Demo-Bewertung nicht erfolgreich.',
  };
};

module.exports = {
  DEFAULT_MAX_SCORE,
  DEFAULT_PASS_THRESHOLD_PERCENT,
  calculatePassed,
  evaluateSubmission,
};
