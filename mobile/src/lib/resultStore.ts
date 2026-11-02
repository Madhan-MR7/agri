import type { RecommendResult, StoredRecommendation } from './types';

/**
 * Hands a recommendation to the /result screen. Results contain nested SHAP arrays,
 * which are awkward to pass as URL params, so we keep the selected one in memory.
 */
let selected: RecommendResult | StoredRecommendation | null = null;

export const setSelectedResult = (r: RecommendResult | StoredRecommendation) => {
  selected = r;
};
export const getSelectedResult = () => selected;
