export type Contribution = {
  feature: string;
  label: string;
  value: number | string;
  shap: number;
};

export type Candidate = {
  crop: string;
  probability: number;
  base_value?: number;
  contributions?: Contribution[];
};

/** Response of POST /api/crop/recommend */
export type RecommendResult = {
  id: number;
  created_at: string;
  recommended_crop: string;
  confidence: number;
  candidates: Candidate[];
  explanation: string;
  ignored_inputs: string[];
};

/** A stored recommendation as returned by the dashboard / history endpoints */
export type StoredRecommendation = {
  id: number;
  recommended_crop: string;
  confidence: number;
  top_crops: { crop: string; probability: number }[];
  inputs: Record<string, number | string>;
  shap_values: Contribution[];
  explanation: string;
  created_at: string;
};

export type Dashboard = {
  farmer: { phone: string; name?: string; language?: string; location?: string };
  stats: { recommendations: number; disease_detections: number; chats: number; avg_confidence: number | null };
  latest: StoredRecommendation | null;
  recent_recommendations: StoredRecommendation[];
  crop_distribution: { crop: string; count: number }[];
  soil_trend: { date: string; N: number; P: number; K: number; ph: number; soil_moisture: number }[];
  feature_impact: { feature: string; label: string; impact: number }[];
  global_importance: { feature: string; label: string; importance: number }[];
  recent_disease_reports: { predicted_disease: string; healthy: boolean; created_at: string; crop: string }[];
  model: { metrics: { accuracy: number; f1_macro: number }; data_source: string; trained_at: string } | null;
};

/** One leaf found by the YOLO detector; box is [x1, y1, x2, y2] normalised to 0–1. */
export type Detection = {
  label: string;
  confidence: number;
  healthy: boolean;
  box: [number, number, number, number];
};

export type DiseaseResult = {
  predicted_disease: string;
  confidence: number;
  healthy: boolean;
  detected: boolean;
  detections: Detection[];
  summary: { label: string; count: number; confidence: number; healthy: boolean }[];
  reply_text: string;
  citations: string[];
  source_type: string;
};
