/** Compact constructor for seed lessons. */
export const lesson = (title, estimatedMinutes, summary, objectives, prerequisites = []) => ({
  title,
  estimatedMinutes,
  summary,
  objectives,
  prerequisites,
});
