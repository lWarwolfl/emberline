function create(baseline: bigint) {
  let target = baseline;
  let celebrated = false;
  return {
    reset(best: bigint) {
      target = best;
      celebrated = false;
    },
    check(score: bigint) {
      if (celebrated || target <= 0n || score <= target) return false;
      celebrated = true;
      return true;
    },
  };
}
export = { create };
