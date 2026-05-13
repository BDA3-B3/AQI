from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

try:
    import geonamescache
except ImportError:
    geonamescache = None

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
BACKEND_DIR = Path(__file__).resolve().parent
MODEL_DIR = BACKEND_DIR / "models"
ARTIFACT_DIR = BACKEND_DIR / "artifacts"
FRONTEND_DIR = BASE_DIR / "frontend"

POLLUTANT_DISPLAY_TO_KEY = {
    "PM2.5": "pm25",
    "PM10": "pm10",
    "NO2": "no2",
    "SO2": "so2",
    "CO": "co",
    "O3": "o3",
    "NH3": "nh3",
}

POLLUTANT_KEY_TO_DISPLAY = {value: key for key, value in POLLUTANT_DISPLAY_TO_KEY.items()}


def _build_model_status(
    feature_name: str,
    source: str,
    fallback_used: bool,
    model_unavailable: bool,
    unavailable_reason: str | None = None,
    dependencies: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "feature_name": feature_name,
        "source": source,
        "fallback_used": fallback_used,
        "live_mode": not fallback_used,
        "model_unavailable": model_unavailable,
        "unavailable_reason": unavailable_reason,
        "dependencies": dependencies or {},
    }


def _sanitize_feature_names(candidate: Any, default_features: list[str]) -> list[str]:
    if not isinstance(candidate, list):
        return list(default_features)

    clean_candidate: list[str] = []
    allowed = set(default_features)
    for value in candidate:
        if isinstance(value, str) and value in allowed and value not in clean_candidate:
            clean_candidate.append(value)

    return clean_candidate if clean_candidate else list(default_features)


def _sanitize_series_numeric(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce").astype(float)
    return values.replace([np.inf, -np.inf], np.nan)


def _build_city_importance_from_weights(
    city_id: int,
    history_df: pd.DataFrame,
    cities_df: pd.DataFrame,
    pollutant_weights: dict[str, float],
    top_k: int = 5,
) -> dict[str, Any] | None:
    pollutant_pairs = [
        ("PM2.5", "pm25"),
        ("PM10", "pm10"),
        ("NO2", "no2"),
        ("SO2", "so2"),
        ("CO", "co"),
        ("O3", "o3"),
        ("NH3", "nh3"),
    ]

    city_df = history_df[history_df["city_id"] == city_id].copy()
    if city_df.empty:
        return None

    weighted_scores: list[tuple[str, float]] = []
    for display_name, key in pollutant_pairs:
        mean_value = _safe_float(pd.to_numeric(city_df[key], errors="coerce").mean())
        weight = _safe_float(pollutant_weights.get(display_name))
        if mean_value is None:
            mean_value = 0.0
        if weight is None:
            weight = 0.0
        score = max(0.0, float(weight) * float(mean_value))
        weighted_scores.append((display_name, score))

    total = sum(score for _, score in weighted_scores)
    if total <= 0:
        return None

    normalized = [
        (name, (score / total) * 100.0)
        for name, score in weighted_scores
    ]
    normalized = sorted(normalized, key=lambda x: (-x[1], x[0]))

    keep_count = max(3, min(5, top_k))
    top_items = normalized[:keep_count]
    remainder = normalized[keep_count:]

    feature_importance = [
        {"pollutant": pollutant, "importance": round(float(pct), 6)}
        for pollutant, pct in top_items
    ]
    others_value = sum(value for _, value in remainder)
    if others_value > 0:
        feature_importance.append(
            {"pollutant": "Others", "importance": round(float(others_value), 6)}
        )

    city_name_series = cities_df[cities_df["city_id"] == city_id]["city_name"]
    city_name = city_name_series.iloc[0] if not city_name_series.empty else f"City {city_id}"

    top_pollutants = [
        item["pollutant"]
        for item in feature_importance
        if item["pollutant"] != "Others"
    ]

    return {
        "model": "RandomForestRegressor",
        "objective": "AQI pollutant-level importance",
        "scope": "city",
        "city_id": city_id,
        "city_name": city_name,
        "top_pollutant": top_pollutants[0] if top_pollutants else None,
        "top_pollutants": top_pollutants,
        "feature_importance": feature_importance,
    }


def _extract_pollutant_weights(
    rf_model: Any,
    feature_importance_payload: dict[str, Any] | None,
) -> dict[str, float]:
    pollutants = ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3", "NH3"]
    weights: dict[str, float] = {}

    if rf_model is not None and hasattr(rf_model, "feature_importances_"):
        importances = list(rf_model.feature_importances_)
        if len(importances) == len(pollutants):
            for name, value in zip(pollutants, importances):
                val = _safe_float(value)
                if val is not None:
                    weights[name] = max(0.0, float(val))

    if weights:
        return weights

    if isinstance(feature_importance_payload, dict):
        for row in feature_importance_payload.get("feature_importance", []):
            if not isinstance(row, dict):
                continue
            pollutant = row.get("pollutant")
            value = _safe_float(row.get("importance"))
            if isinstance(pollutant, str) and value is not None and pollutant in pollutants:
                weights[pollutant] = max(0.0, float(value))

    return weights


def _predict_with_best_iteration(xgb_model: Any, model_input: pd.DataFrame) -> float | None:
    if xgb_model is None:
        return None
    try:
        best_iteration = getattr(xgb_model, "best_iteration", None)
        if isinstance(best_iteration, (int, np.integer)) and int(best_iteration) >= 0:
            # Use trees learned before early stopping cut-off when supported.
            pred_values = xgb_model.predict(model_input, iteration_range=(0, int(best_iteration) + 1))
        else:
            pred_values = xgb_model.predict(model_input)
        if len(pred_values) == 0:
            return None
        value = _safe_float(pred_values[0])
        return value
    except TypeError:
        pred_values = xgb_model.predict(model_input)
        if len(pred_values) == 0:
            return None
        return _safe_float(pred_values[0])
    except Exception:
        return None


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (np.floating, np.integer)):
        value = value.item()
    if isinstance(value, float) and np.isnan(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, (np.floating, np.integer)):
        value = value.item()
    if isinstance(value, float) and np.isnan(value):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _aqi_category(aqi_value: float | None) -> str:
    if aqi_value is None:
        return "Unknown"
    if aqi_value <= 50:
        return "Good"
    if aqi_value <= 100:
        return "Moderate"
    if aqi_value <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi_value <= 200:
        return "Unhealthy"
    if aqi_value <= 300:
        return "Very Unhealthy"
    return "Hazardous"


COUNTRY_CENTROIDS = {
    "United States": (39.8, -98.6),
    "UAE": (24.3, 54.4),
    "Nigeria": (9.1, 8.7),
    "Ghana": (7.95, -1.02),
    "Ethiopia": (9.15, 40.49),
    "Australia": (-25.3, 133.8),
    "India": (22.6, 79.0),
    "Egypt": (26.8, 30.8),
    "Algeria": (28.0, 1.7),
    "Jordan": (30.6, 36.2),
    "Netherlands": (52.1, 5.3),
    "Turkey": (39.1, 35.2),
    "Greece": (39.1, 22.9),
    "New Zealand": (-40.9, 174.9),
    "Iraq": (33.2, 43.7),
    "Thailand": (15.8, 101.0),
    "Spain": (40.4, -3.7),
    "China": (35.9, 104.2),
    "Lebanon": (33.9, 35.9),
    "Brazil": (-14.2, -51.9),
    "Germany": (51.2, 10.4),
    "United Kingdom": (54.5, -3.4),
    "Colombia": (4.57, -74.3),
    "Belgium": (50.5, 4.47),
    "Romania": (45.9, 24.9),
    "Hungary": (47.16, 19.5),
    "Argentina": (-38.4, -63.6),
    "South Korea": (36.5, 127.8),
    "Canada": (56.1, -106.3),
    "South Africa": (-30.6, 22.9),
    "Venezuela": (6.42, -66.6),
    "Morocco": (31.8, -7.1),
    "Bangladesh": (23.7, 90.4),
    "Sri Lanka": (7.87, 80.8),
    "Denmark": (56.2, 9.5),
    "Senegal": (14.5, -14.5),
    "Tanzania": (-6.37, 34.9),
    "Qatar": (25.3, 51.2),
    "Ireland": (53.1, -8.2),
    "Mexico": (23.6, -102.5),
    "Vietnam": (14.1, 108.3),
    "Cuba": (21.5, -79.4),
    "Finland": (61.9, 25.7),
    "Iran": (32.4, 53.7),
    "Pakistan": (30.4, 69.4),
    "Indonesia": (-0.8, 113.9),
    "Saudi Arabia": (23.9, 45.1),
    "Israel": (31.0, 35.0),
    "Uganda": (1.37, 32.3),
    "Taiwan": (23.7, 121.0),
    "Nepal": (28.4, 84.1),
    "Sudan": (12.9, 30.2),
    "DR Congo": (-2.9, 23.7),
    "Poland": (51.9, 19.1),
    "Malaysia": (4.21, 101.9),
    "Kuwait": (29.4, 47.5),
    "Peru": (-9.2, -75.0),
    "Portugal": (39.4, -8.2),
    "Angola": (-11.2, 17.8),
    "France": (46.2, 2.2),
    "Bahrain": (26.1, 50.6),
    "Philippines": (12.9, 122.8),
    "Italy": (41.9, 12.6),
    "Kenya": (0.02, 37.9),
    "Oman": (21.5, 55.9),
    "Japan": (36.2, 138.2),
    "Norway": (60.5, 8.5),
    "Panama": (8.5, -80.8),
    "Cambodia": (12.6, 104.9),
    "Czech Republic": (49.8, 15.5),
    "Ecuador": (-1.8, -78.2),
    "Costa Rica": (9.7, -84.2),
    "Chile": (-35.7, -71.5),
    "Singapore": (1.35, 103.8),
    "Sweden": (60.1, 18.6),
    "Tunisia": (33.9, 9.6),
    "Mongolia": (46.9, 103.8),
    "Austria": (47.5, 14.6),
    "Myanmar": (21.9, 95.9),
    "Switzerland": (46.8, 8.2),
}


def _pseudo_coordinates(city_id: int, country_id: int | None, country_name: str | None) -> tuple[float, float]:
    # Dataset has no latitude/longitude. Anchor to country centroid then jitter cities around it.
    if country_name and country_name in COUNTRY_CENTROIDS:
        center_lat, center_lng = COUNTRY_CENTROIDS[country_name]
    else:
        country_part = country_id or 0
        country_seed = (country_part * 2654435761) & 0xFFFFFFFF
        center_lat = -52.0 + ((country_seed % 100000) / 100000.0) * 104.0
        center_lng = -168.0 + (((country_seed // 100000) % 100000) / 100000.0) * 336.0

    angle_deg = (city_id * 137.50776405) % 360.0
    angle_rad = np.deg2rad(angle_deg)
    radius = 0.18 + (city_id % 29) * 0.05

    lat = center_lat + radius * float(np.sin(angle_rad))
    lng = center_lng + (radius * 1.35) * float(np.cos(angle_rad))

    lat = float(np.clip(lat, -70.0, 70.0))
    lng = float(np.clip(lng, -180.0, 180.0))
    return round(lat, 4), round(lng, 4)


COUNTRY_CODE_ALIASES = {
    "uae": "AE",
    "dr congo": "CD",
    "south korea": "KR",
    "north korea": "KP",
    "czech republic": "CZ",
}


def _normalize_place_name(value: Any) -> str:
    if value is None:
        return ""
    normalized = str(value).strip().lower()
    normalized = normalized.replace("&", " and ")
    normalized = re.sub(r"\([^)]*\)", " ", normalized)
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _city_name_candidates(city_name: Any) -> list[str]:
    raw = str(city_name or "").strip()
    if not raw:
        return []

    candidates: list[str] = []
    seen: set[str] = set()

    def add_candidate(value: str) -> None:
        key = _normalize_place_name(value)
        if key and key not in seen:
            seen.add(key)
            candidates.append(key)

    add_candidate(raw)
    if "," in raw:
        add_candidate(raw.split(",", 1)[0])
    add_candidate(raw.replace("-", " "))
    return candidates


def _build_geonames_index() -> tuple[dict[tuple[str, str], list[tuple[float, float, int]]], dict[str, str]]:
    if geonamescache is None:
        return {}, {}

    cache = geonamescache.GeonamesCache()
    countries = cache.get_countries()
    country_code_by_name: dict[str, str] = {}
    for code, row in countries.items():
        country_code_by_name[_normalize_place_name(row.get("name"))] = code

    for alias, code in COUNTRY_CODE_ALIASES.items():
        country_code_by_name.setdefault(alias, code)

    index: dict[tuple[str, str], list[tuple[float, float, int]]] = {}
    cities = cache.get_cities()
    for row in cities.values():
        code = row.get("countrycode")
        name = row.get("name")
        lat = _safe_float(row.get("latitude"))
        lng = _safe_float(row.get("longitude"))
        if not code or not name or lat is None or lng is None:
            continue
        population = _safe_int(row.get("population")) or 0

        key = (code, _normalize_place_name(name))
        index.setdefault(key, []).append((lat, lng, population))

    for key, values in index.items():
        values.sort(key=lambda item: item[2], reverse=True)
        index[key] = values

    return index, country_code_by_name


def _resolve_city_coordinates(
    city_name: Any,
    country_name: Any,
    geonames_index: dict[tuple[str, str], list[tuple[float, float, int]]],
    country_code_by_name: dict[str, str],
) -> tuple[float, float] | None:
    if not geonames_index:
        return None

    country_key = _normalize_place_name(country_name)
    country_code = country_code_by_name.get(country_key)
    if not country_code:
        return None

    for candidate in _city_name_candidates(city_name):
        matches = geonames_index.get((country_code, candidate))
        if matches:
            lat, lng, _ = matches[0]
            return round(float(lat), 4), round(float(lng), 4)

    return None


def _month_name(month_number: int) -> str:
    names = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
    if 1 <= month_number <= 12:
        return names[month_number - 1]
    return "Unknown"


def _load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as fp:
        return json.load(fp)


def _load_joblib(path: Path) -> Any:
    if not path.exists():
        return None
    return joblib.load(path)


def _read_csv_robust(path: Path) -> pd.DataFrame:
    for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin1"):
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    return pd.read_csv(path, encoding_errors="replace")


def _prepare_dataframes() -> dict[str, pd.DataFrame]:
    aqi_df = pd.read_csv(DATA_DIR / "aqi_data.csv").rename(columns={"S02": "SO2"})
    weather_df = pd.read_csv(DATA_DIR / "weather.csv")
    date_df = pd.read_csv(DATA_DIR / "date_dimension.csv")
    demographics_df = pd.read_csv(DATA_DIR / "demographics.csv")
    cities_df = _read_csv_robust(DATA_DIR / "cities.csv")
    countries_df = pd.read_csv(DATA_DIR / "countries.csv")

    aqi_df = aqi_df.rename(
        columns={
            "AQI": "aqi",
            "PM2.5": "pm25",
            "PM10": "pm10",
            "NO2": "no2",
            "SO2": "so2",
            "CO": "co",
            "O3": "o3",
            "NH3": "nh3",
            "AQI Category": "aqi_category",
        }
    )

    weather_df = weather_df.rename(
        columns={
            "Temperature": "temperature",
            "Humidity": "humidity",
            "Wind Speed": "wind_speed",
            "Rainfall": "rainfall",
            "Visibility": "visibility",
        }
    )

    demographics_df = demographics_df.rename(
        columns={
            "Population": "population",
            "Population Density": "population_density",
            "Urbanization %": "urbanization_pct",
            "Vehicle Count": "vehicle_count",
            "Industrial Area %": "industrial_area_pct",
        }
    )

    cities_df = cities_df.rename(columns={"State": "state"})

    numeric_aqi_cols = ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3", "nh3"]
    for col in numeric_aqi_cols:
        aqi_df[col] = pd.to_numeric(aqi_df[col], errors="coerce")

    numeric_weather_cols = ["temperature", "humidity", "wind_speed", "rainfall", "visibility"]
    for col in numeric_weather_cols:
        weather_df[col] = pd.to_numeric(weather_df[col], errors="coerce")

    for col in [
        "population",
        "population_density",
        "urbanization_pct",
        "vehicle_count",
        "industrial_area_pct",
    ]:
        demographics_df[col] = pd.to_numeric(demographics_df[col], errors="coerce")

    date_df["year"] = pd.to_numeric(date_df["year"], errors="coerce")
    date_df["month_number"] = pd.to_numeric(date_df["month_number"], errors="coerce")

    history_df = (
        aqi_df.merge(weather_df, on=["city_id", "date_key"], how="left")
        .merge(date_df[["date_key", "year", "month", "month_number"]], on="date_key", how="left")
        .merge(cities_df[["city_id", "city_name", "country_id", "state"]], on="city_id", how="left")
        .merge(countries_df[["country_id", "country_name"]], on="country_id", how="left")
    )

    history_df = history_df.sort_values(["city_id", "year", "month_number"]).reset_index(drop=True)

    correlation_df = history_df.merge(
        demographics_df,
        on=["city_id", "year"],
        how="left",
    )

    return {
        "aqi": aqi_df,
        "weather": weather_df,
        "date": date_df,
        "demographics": demographics_df,
        "cities": cities_df,
        "countries": countries_df,
        "history": history_df,
        "correlation": correlation_df,
    }


def _build_feature_importance_payload(rf_model: Any) -> dict[str, Any] | None:
    if rf_model is None or not hasattr(rf_model, "feature_importances_"):
        return None

    pollutants = ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3", "NH3"]
    importances = rf_model.feature_importances_
    pairs = sorted(zip(pollutants, importances), key=lambda x: x[1], reverse=True)
    return {
        "model": "RandomForestRegressor",
        "objective": "AQI pollutant-level importance",
        "top_pollutant": pairs[0][0],
        "feature_importance": [
            {"pollutant": pollutant, "importance": round(float(importance), 8)}
            for pollutant, importance in pairs
        ],
    }


def _compute_city_feature_importance(
    city_id: int,
    history_df: pd.DataFrame,
    cities_df: pd.DataFrame,
    pollutant_weights: dict[str, float],
) -> dict[str, Any] | None:
    return _build_city_importance_from_weights(
        city_id,
        history_df,
        cities_df,
        pollutant_weights,
        top_k=5,
    )


def _resolve_city_id(cities_df: pd.DataFrame, city_id: int | None, city_name: str | None) -> int | None:
    if city_id is not None:
        return city_id

    if not city_name:
        return None

    city_matches = cities_df[cities_df["city_name"].str.lower() == city_name.lower()]
    if city_matches.empty:
        return None
    return int(city_matches.iloc[0]["city_id"])


def _compute_city_correlation(
    city_id: int,
    top_pollutants_display: list[str],
    correlation_df: pd.DataFrame,
    cities_df: pd.DataFrame,
) -> dict[str, Any]:
    factor_cols = [
        "temperature",
        "humidity",
        "wind_speed",
        "rainfall",
        "visibility",
        "population",
        "population_density",
        "urbanization_pct",
        "vehicle_count",
        "industrial_area_pct",
    ]

    city_df = correlation_df[correlation_df["city_id"] == city_id].copy()
    base_empty = {
        "city_id": city_id,
        "selected_pollutant": top_pollutants_display[0] if top_pollutants_display else "PM2.5",
        "positive_influence": [],
        "negative_influence": [],
        "comparison_trends": [],
        "pollutant_insights": [],
    }

    if city_df.empty:
        return base_empty

    for col in factor_cols:
        city_df[col] = _sanitize_series_numeric(city_df[col])

    pollutant_insights: list[dict[str, Any]] = []
    for pollutant_display in top_pollutants_display[:5]:
        pollutant_key = POLLUTANT_DISPLAY_TO_KEY.get(pollutant_display)
        if not pollutant_key or pollutant_key not in city_df.columns:
            continue

        matrix = city_df[[pollutant_key] + factor_cols].copy()
        matrix[pollutant_key] = _sanitize_series_numeric(matrix[pollutant_key])

        if matrix[pollutant_key].notna().sum() < 8:
            continue

        corr = matrix.corr(numeric_only=True)[pollutant_key].drop(labels=[pollutant_key]).dropna()
        if corr.empty:
            continue

        sorted_abs = corr.reindex(corr.abs().sort_values(ascending=False).index).head(5)
        factors = [
            {
                "factor": factor,
                "correlation": round(float(value), 6),
                "abs_correlation": round(abs(float(value)), 6),
                "direction": "positive" if float(value) >= 0 else "negative",
            }
            for factor, value in sorted_abs.items()
        ]
        pollutant_insights.append(
            {
                "pollutant": pollutant_display,
                "top_factors": factors,
            }
        )

    if not pollutant_insights:
        return base_empty

    primary = pollutant_insights[0]
    positive = [x for x in primary["top_factors"] if x["correlation"] > 0]
    negative = [x for x in primary["top_factors"] if x["correlation"] < 0]

    top_compare_factors = [x["factor"] for x in primary["top_factors"][:2]]
    pollutant_key = POLLUTANT_DISPLAY_TO_KEY.get(primary["pollutant"], "pm25")
    trend_cols = ["year", "month", "month_number", pollutant_key] + top_compare_factors
    available_trend_cols = [col for col in trend_cols if col in city_df.columns]
    trend_df = city_df[available_trend_cols].dropna(subset=[pollutant_key]).copy()

    comparison_trends = []
    for _, row in trend_df.iterrows():
        comparison_trends.append(
            {
                "year": _safe_int(row.get("year")),
                "month": row.get("month"),
                "month_number": _safe_int(row.get("month_number")),
                "pollutant": _safe_float(row.get(pollutant_key)),
                "factors": {
                    factor: _safe_float(row.get(factor)) for factor in top_compare_factors
                },
            }
        )

    city_name_series = cities_df[cities_df["city_id"] == city_id]["city_name"]
    city_name = city_name_series.iloc[0] if not city_name_series.empty else f"City {city_id}"

    return {
        "city_id": city_id,
        "city_name": city_name,
        "selected_pollutant": primary["pollutant"],
        "positive_influence": [
            {"factor": row["factor"], "correlation": row["correlation"]}
            for row in positive
        ],
        "negative_influence": [
            {"factor": row["factor"], "correlation": row["correlation"]}
            for row in negative
        ],
        "comparison_trends": comparison_trends,
        "pollutant_insights": pollutant_insights,
    }


def _forecast_city(
    city_id: int,
    horizon: int,
    history_df: pd.DataFrame,
    city_encoder: Any,
    xgb_model: Any,
    feature_names: list[str],
) -> list[dict[str, Any]]:
    if xgb_model is None or city_encoder is None:
        return []
    if not feature_names:
        return []

    city_history = history_df[history_df["city_id"] == city_id].copy()
    city_history = city_history.sort_values(["year", "month_number"]).dropna(subset=["aqi"])
    if city_history.empty:
        return []

    city_name = city_history.iloc[-1]["city_name"]
    if not hasattr(city_encoder, "classes_"):
        return []

    encoder_classes = set(city_encoder.classes_)
    if city_name not in encoder_classes:
        return []

    city_encoded = int(city_encoder.transform([city_name])[0])

    prev_aqi_1 = _safe_float(city_history.iloc[-1]["aqi"])
    prev_aqi_2 = (
        _safe_float(city_history.iloc[-2]["aqi"]) if len(city_history) > 1 else prev_aqi_1
    )

    if prev_aqi_1 is None or prev_aqi_2 is None:
        return []

    current_year = _safe_int(city_history.iloc[-1]["year"]) or 2025
    current_month = _safe_int(city_history.iloc[-1]["month_number"]) or 12
    if current_month < 1 or current_month > 12:
        current_month = 12

    weather_cols = ["temperature", "humidity", "wind_speed", "rainfall", "visibility"]
    city_weather_lookup = history_df.groupby(["city_id", "month_number"])[weather_cols].mean()

    fallback_weather = {
        "temperature": _safe_float(city_history.iloc[-1]["temperature"]) or 20.0,
        "humidity": _safe_float(city_history.iloc[-1]["humidity"]) or 50.0,
        "wind_speed": _safe_float(city_history.iloc[-1]["wind_speed"]) or 10.0,
        "rainfall": _safe_float(city_history.iloc[-1]["rainfall"]) or 0.0,
        "visibility": _safe_float(city_history.iloc[-1]["visibility"]) or 10000.0,
    }

    forecasts: list[dict[str, Any]] = []
    for _ in range(horizon):
        next_month = 1 if current_month == 12 else current_month + 1
        next_year = current_year + 1 if current_month == 12 else current_year

        weather_key = (city_id, next_month)
        if weather_key in city_weather_lookup.index:
            month_weather = city_weather_lookup.loc[weather_key]
            weather_values = {
                "temperature": _safe_float(month_weather["temperature"]) or fallback_weather["temperature"],
                "humidity": _safe_float(month_weather["humidity"]) or fallback_weather["humidity"],
                "wind_speed": _safe_float(month_weather["wind_speed"]) or fallback_weather["wind_speed"],
                "rainfall": _safe_float(month_weather["rainfall"]) or fallback_weather["rainfall"],
                "visibility": _safe_float(month_weather["visibility"]) or fallback_weather["visibility"],
            }
        else:
            weather_values = fallback_weather

        model_row = {
            "month_number": next_month,
            "year": next_year,
            "city_encoded": city_encoded,
            "aqi_lag_1": prev_aqi_1,
            "aqi_lag_2": prev_aqi_2,
            "temperature": weather_values["temperature"],
            "humidity": weather_values["humidity"],
            "wind_speed": weather_values["wind_speed"],
            "rainfall": weather_values["rainfall"],
            "visibility": weather_values["visibility"],
        }

        model_input = pd.DataFrame([model_row])
        missing_features = [name for name in feature_names if name not in model_input.columns]
        if missing_features:
            return []
        model_input = model_input[feature_names]
        model_input = model_input.apply(pd.to_numeric, errors="coerce")
        model_input = model_input.replace([np.inf, -np.inf], np.nan)
        if model_input.isna().any(axis=None):
            return []

        pred_value = _predict_with_best_iteration(xgb_model, model_input)
        if pred_value is None:
            return []
        pred = float(pred_value)
        pred = max(0.0, min(500.0, pred))

        forecasts.append(
            {
                "city_id": city_id,
                "city_name": city_name,
                "year": next_year,
                "month_number": next_month,
                "month": _month_name(next_month),
                "predicted_aqi": round(pred, 3),
                "predicted_category": _aqi_category(pred),
            }
        )

        prev_aqi_2 = prev_aqi_1
        prev_aqi_1 = pred
        current_year = next_year
        current_month = next_month

    return forecasts


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    dataframes = _prepare_dataframes()

    rf_model = _load_joblib(MODEL_DIR / "random_forest.pkl")
    xgb_model = _load_joblib(MODEL_DIR / "xgboost.pkl")
    city_encoder = _load_joblib(MODEL_DIR / "city_label_encoder.pkl")

    feature_importance_payload = _load_json(ARTIFACT_DIR / "feature_importance.json")
    if feature_importance_payload is None:
        feature_importance_payload = _build_feature_importance_payload(rf_model)
    pollutant_weights = _extract_pollutant_weights(rf_model, feature_importance_payload)

    pollutant_correlations_payload = _load_json(ARTIFACT_DIR / "pollutant_correlations.json")
    precomputed_predictions = None
    precomputed_path = ARTIFACT_DIR / "future_aqi_predictions.csv"
    if precomputed_path.exists():
        precomputed_predictions = pd.read_csv(precomputed_path)

    xgb_metadata = _load_json(ARTIFACT_DIR / "xgboost_metadata.json")
    default_feature_names = [
        "month_number",
        "year",
        "city_encoded",
        "aqi_lag_1",
        "aqi_lag_2",
        "temperature",
        "humidity",
        "wind_speed",
        "rainfall",
        "visibility",
    ]
    feature_names = _sanitize_feature_names(
        xgb_metadata.get("features", default_feature_names)
        if isinstance(xgb_metadata, dict)
        else default_feature_names,
        default_feature_names,
    )

    geonames_index, country_code_by_name = _build_geonames_index()

    @app.get("/")
    def home() -> Any:
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.get("/assets/<path:asset_path>")
    def assets(asset_path: str) -> Any:
        return send_from_directory(FRONTEND_DIR / "assets", asset_path)

    @app.get("/api/health")
    def health() -> Any:
        return jsonify(
            {
                "status": "ok",
                "models": {
                    "random_forest_loaded": rf_model is not None,
                    "xgboost_loaded": xgb_model is not None,
                    "city_encoder_loaded": city_encoder is not None,
                },
                "artifacts": {
                    "feature_importance": feature_importance_payload is not None,
                    "pollutant_correlations": pollutant_correlations_payload is not None,
                    "future_predictions": precomputed_predictions is not None,
                },
            }
        )

    @app.get("/api/cities")
    @app.get("/cities")
    def get_cities() -> Any:
        q = (request.args.get("q") or "").strip().lower()
        limit = request.args.get("limit", default=300, type=int)
        limit = max(1, min(3000, limit))

        cities_df = dataframes["cities"].merge(
            dataframes["countries"][['country_id', 'country_name']],
            on="country_id",
            how="left",
        )

        latest = (
            dataframes["history"]
            .sort_values(["city_id", "year", "month_number"])
            .groupby("city_id")
            .tail(1)[["city_id", "aqi", "aqi_category", "year"]]
        )
        cities_df = cities_df.merge(latest, on="city_id", how="left")

        if q:
            cities_df = cities_df[
                cities_df["city_name"].str.lower().str.contains(q, na=False)
                | cities_df["country_name"].str.lower().str.contains(q, na=False)
                | cities_df["state"].str.lower().str.contains(q, na=False)
            ]

        rows: list[dict[str, Any]] = []
        for _, row in cities_df.head(limit).iterrows():
            city_id = int(row["city_id"])
            resolved = _resolve_city_coordinates(
                row.get("city_name"),
                row.get("country_name"),
                geonames_index,
                country_code_by_name,
            )
            if resolved is not None:
                lat, lng = resolved
                estimated = False
            else:
                lat, lng = _pseudo_coordinates(
                    city_id,
                    _safe_int(row.get("country_id")),
                    row.get("country_name"),
                )
                estimated = True

            latest_aqi = _safe_float(row.get("aqi"))
            rows.append(
                {
                    "city_id": city_id,
                    "city_name": row.get("city_name"),
                    "country_name": row.get("country_name"),
                    "state": row.get("state"),
                    "latest_aqi": latest_aqi,
                    "latest_category": row.get("aqi_category") or _aqi_category(latest_aqi),
                    "data_available_till": _safe_int(row.get("year")) or 2025,
                    "lat": lat,
                    "lng": lng,
                    "coordinates_estimated": estimated,
                }
            )

        return jsonify({"count": len(rows), "cities": rows})

    @app.get("/api/get_city_data")
    @app.get("/get_city_data")
    def get_city_data() -> Any:
        city_id = request.args.get("city_id", type=int)
        city_name = request.args.get("city_name", type=str)

        resolved_city_id = _resolve_city_id(dataframes["cities"], city_id, city_name)
        if resolved_city_id is None:
            return jsonify({"error": "city_id or valid city_name is required."}), 400

        city_info_df = dataframes["cities"].merge(
            dataframes["countries"], on="country_id", how="left"
        )
        city_info = city_info_df[city_info_df["city_id"] == resolved_city_id]
        if city_info.empty:
            return jsonify({"error": "City not found."}), 404

        city_history = dataframes["history"][
            dataframes["history"]["city_id"] == resolved_city_id
        ].copy()
        city_history = city_history.sort_values(["year", "month_number"])

        if city_history.empty:
            return jsonify({"error": "No AQI history found for this city."}), 404

        historical_payload: list[dict[str, Any]] = []
        for _, row in city_history.iterrows():
            aqi_value = _safe_float(row.get("aqi"))
            historical_payload.append(
                {
                    "date_key": row.get("date_key"),
                    "year": _safe_int(row.get("year")),
                    "month": row.get("month"),
                    "month_number": _safe_int(row.get("month_number")),
                    "aqi": aqi_value,
                    "aqi_category": row.get("aqi_category") or _aqi_category(aqi_value),
                    "pollutants": {
                        "pm25": _safe_float(row.get("pm25")),
                        "pm10": _safe_float(row.get("pm10")),
                        "no2": _safe_float(row.get("no2")),
                        "so2": _safe_float(row.get("so2")),
                        "co": _safe_float(row.get("co")),
                        "o3": _safe_float(row.get("o3")),
                        "nh3": _safe_float(row.get("nh3")),
                    },
                    "weather": {
                        "temperature": _safe_float(row.get("temperature")),
                        "humidity": _safe_float(row.get("humidity")),
                        "wind_speed": _safe_float(row.get("wind_speed")),
                        "rainfall": _safe_float(row.get("rainfall")),
                        "visibility": _safe_float(row.get("visibility")),
                    },
                }
            )

        city_demographics = dataframes["demographics"][
            dataframes["demographics"]["city_id"] == resolved_city_id
        ].sort_values(["year"])

        demographics_payload = []
        for _, row in city_demographics.iterrows():
            demographics_payload.append(
                {
                    "year": _safe_int(row.get("year")),
                    "population": _safe_float(row.get("population")),
                    "population_density": _safe_float(row.get("population_density")),
                    "urbanization_pct": _safe_float(row.get("urbanization_pct")),
                    "vehicle_count": _safe_float(row.get("vehicle_count")),
                    "industrial_area_pct": _safe_float(row.get("industrial_area_pct")),
                }
            )

        latest_row = city_history.iloc[-1]
        latest_aqi = _safe_float(latest_row.get("aqi"))

        return jsonify(
            {
                "city": {
                    "city_id": resolved_city_id,
                    "city_name": city_info.iloc[0].get("city_name"),
                    "country_name": city_info.iloc[0].get("country_name"),
                    "state": city_info.iloc[0].get("state"),
                },
                "meta": {
                    "data_available_till": _safe_int(city_history["year"].max()) or 2025,
                    "record_count": len(historical_payload),
                },
                "latest_aqi": latest_aqi,
                "latest_category": latest_row.get("aqi_category") or _aqi_category(latest_aqi),
                "historical": historical_payload,
                "demographics": demographics_payload,
            }
        )

    @app.get("/api/get_feature_importance")
    @app.get("/get_feature_importance")
    def get_feature_importance() -> Any:
        city_id = request.args.get("city_id", type=int)
        city_name = request.args.get("city_name", type=str)

        resolved_city_id = _resolve_city_id(dataframes["cities"], city_id, city_name)
        if resolved_city_id is not None:
            city_payload = _compute_city_feature_importance(
                resolved_city_id,
                dataframes["history"],
                dataframes["cities"],
                pollutant_weights,
            )
            if city_payload is not None:
                city_payload["model_status"] = _build_model_status(
                    "random_forest",
                    "live_computed",
                    False,
                    False,
                )
                return jsonify(city_payload)

        if feature_importance_payload is None:
            return (
                jsonify(
                    {
                        "error": "Feature importance artifact/model not found.",
                        "hint": "Run notebooks/01_random_forest_pollutant_importance.ipynb to generate artifacts.",
                        "model_status": _build_model_status(
                            "random_forest",
                            "unavailable",
                            True,
                            True,
                            "City-level Random Forest model and global artifact are unavailable.",
                            {
                                "random_forest_model_loaded": rf_model is not None,
                                "feature_importance_artifact_loaded": feature_importance_payload is not None,
                            },
                        ),
                    }
                ),
                503,
            )

        payload = dict(feature_importance_payload)
        payload["scope"] = "global"
        fallback_reason = None
        if resolved_city_id is not None:
            payload["city_id"] = resolved_city_id
            fallback_reason = "Insufficient city-wise data for stable training; returned global importance."
            payload["fallback_reason"] = fallback_reason

        payload["model_status"] = _build_model_status(
            "random_forest",
            "fallback_global",
            True,
            True,
            fallback_reason or "Serving global feature importance artifact.",
            {
                "random_forest_model_loaded": rf_model is not None,
                "feature_importance_artifact_loaded": feature_importance_payload is not None,
            },
        )
        return jsonify(payload)

    @app.get("/api/get_pollutant_correlation")
    @app.get("/get_pollutant_correlation")
    def get_pollutant_correlation() -> Any:
        city_id = request.args.get("city_id", type=int)
        city_name = request.args.get("city_name", type=str)
        resolved_city_id = _resolve_city_id(dataframes["cities"], city_id, city_name)

        if resolved_city_id is None:
            return jsonify({"error": "city_id or valid city_name is required."}), 400

        top_pollutants = ["PM2.5"]
        city_importance = _compute_city_feature_importance(
            resolved_city_id,
            dataframes["history"],
            dataframes["cities"],
            pollutant_weights,
        )
        if isinstance(city_importance, dict) and isinstance(city_importance.get("top_pollutants"), list):
            top_pollutants = [
                p for p in city_importance["top_pollutants"]
                if isinstance(p, str) and p in POLLUTANT_DISPLAY_TO_KEY
            ]
        elif isinstance(feature_importance_payload, dict):
            default_top = feature_importance_payload.get("top_pollutant", "PM2.5")
            if isinstance(default_top, str):
                top_pollutants = [default_top]

        computed = _compute_city_correlation(
            resolved_city_id,
            top_pollutants,
            dataframes["correlation"],
            dataframes["cities"],
        )
        computed["model_status"] = _build_model_status(
            "correlation",
            "live_computed",
            False,
            False,
        )
        return jsonify(computed)

    @app.get("/api/predict_aqi")
    @app.get("/predict_aqi")
    def predict_aqi() -> Any:
        city_id = request.args.get("city_id", type=int)
        city_name = request.args.get("city_name", type=str)
        horizon = request.args.get("horizon", default=12, type=int)
        horizon = max(1, min(24, horizon))

        resolved_city_id = _resolve_city_id(dataframes["cities"], city_id, city_name)
        if resolved_city_id is None:
            return jsonify({"error": "city_id or valid city_name is required."}), 400

        dependencies = {
            "xgboost_model_loaded": xgb_model is not None,
            "city_encoder_loaded": city_encoder is not None,
            "precomputed_predictions_loaded": precomputed_predictions is not None,
        }

        if xgb_model is not None and city_encoder is not None:
            predictions = _forecast_city(
                resolved_city_id,
                horizon,
                dataframes["history"],
                city_encoder,
                xgb_model,
                feature_names,
            )
            if predictions:
                alerts = [
                    p for p in predictions if p["predicted_aqi"] is not None and p["predicted_aqi"] >= 150
                ]
                return jsonify(
                    {
                        "city_id": resolved_city_id,
                        "horizon": horizon,
                        "predictions": predictions,
                        "alerts": alerts,
                        "source": "live_model",
                        "model_unavailable": False,
                        "model_status": _build_model_status(
                            "xgboost",
                            "live_model",
                            False,
                            False,
                            dependencies=dependencies,
                        ),
                    }
                )

        missing_parts: list[str] = []
        if xgb_model is None:
            missing_parts.append("xgboost model file is missing")
        if city_encoder is None:
            missing_parts.append("city label encoder is missing")
        unavailable_reason = (
            "; ".join(missing_parts)
            if missing_parts
            else "Live model could not generate forecast for selected city."
        )

        if precomputed_predictions is not None:
            city_precomp = precomputed_predictions[
                precomputed_predictions["city_id"] == resolved_city_id
            ].head(horizon)

            if not city_precomp.empty:
                predictions = []
                for _, row in city_precomp.iterrows():
                    value = _safe_float(row.get("predicted_aqi"))
                    predictions.append(
                        {
                            "city_id": _safe_int(row.get("city_id")),
                            "city_name": row.get("city_name"),
                            "year": _safe_int(row.get("year")),
                            "month_number": _safe_int(row.get("month_number")),
                            "month": _month_name(_safe_int(row.get("month_number")) or 1),
                            "predicted_aqi": value,
                            "predicted_category": _aqi_category(value),
                        }
                    )

                alerts = [
                    p for p in predictions if p["predicted_aqi"] is not None and p["predicted_aqi"] >= 150
                ]
                return jsonify(
                    {
                        "city_id": resolved_city_id,
                        "horizon": horizon,
                        "predictions": predictions,
                        "alerts": alerts,
                        "source": "precomputed",
                        "model_unavailable": True,
                        "warning": "Model is currently unavailable; using notebook precomputed forecast values.",
                        "model_status": _build_model_status(
                            "xgboost",
                            "precomputed",
                            True,
                            True,
                            unavailable_reason,
                            dependencies,
                        ),
                    }
                )

        return (
            jsonify(
                {
                    "error": "Prediction model or artifacts are missing.",
                    "hint": "Run notebooks/02_xgboost_aqi_forecasting.ipynb to generate model and forecast artifacts.",
                    "model_status": _build_model_status(
                        "xgboost",
                        "unavailable",
                        True,
                        True,
                        unavailable_reason,
                        dependencies,
                    ),
                }
            ),
            503,
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
