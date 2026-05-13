# AQI Analytics and Forecasting Platform

End-to-end AQI analysis project with a Flask backend, a vanilla JavaScript frontend dashboard, and three notebooks that generate the machine-learning artifacts used by the app.

## What This Repository Contains

- Historical AQI, weather, demographic, and date-dimension data.
- Three notebooks for pollutant importance, AQI forecasting, and pollutant correlation analysis.
- A Flask API that serves city data, feature importance, pollutant correlations, and AQI forecasts.
- A frontend dashboard for city search, map-based exploration, historical charts, and forecast views.
- Generated model and artifact files checked into the repository for convenience.

## Repository Structure

```
BDA_CP/
├── README.md
├── requirements.txt
├── artifacts/
│   ├── .gitkeep
│   ├── feature_importance.csv
│   ├── feature_importance.json
│   ├── future_aqi_predictions.csv
│   ├── pollutant_correlations.json
│   └── xgboost_metadata.json
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── artifacts/
│   │   └── .gitkeep
│   └── models/
│       └── .gitkeep
├── data/
│   ├── aqi_data.csv
│   ├── cities.csv
│   ├── countries.csv
│   ├── date_dimension.csv
│   ├── date_dimension.xlsx
│   ├── demographics.csv
│   └── weather.csv
├── docs/
│   ├── dataset_readme.md
│   ├── project_readme.md
│   ├── readme_legacy_copy.md
│   └── screenshots/
│       └── schema.png
├── frontend/
│   ├── index.html
│   └── assets/
│       ├── css/
│       │   └── styles.css
│       └── js/
│           └── main.js
├── models/
│   ├── .gitkeep
│   ├── city_label_encoder.pkl
│   ├── random_forest.pkl
│   └── xgboost.pkl
└── notebooks/
    ├── 01_random_forest_pollutant_importance.ipynb
    ├── 02_xgboost_aqi_forecasting.ipynb
    └── 03_city_pollutant_correlation.ipynb
```

Note: `env/`, `.git/`, and `__pycache__/` are local workspace/runtime folders and are not part of the documented project source tree.

## Project Layout

### Data

The source data lives in `data/` and is organized as a fact constellation / galaxy schema:

- `aqi_data.csv` is the main AQI fact table.
- `weather.csv` is the companion weather fact table.
- `cities.csv`, `countries.csv`, `date_dimension.csv`, and `demographics.csv` are the shared dimensions.
- `date_dimension.xlsx` is a helper spreadsheet copy of the date dimension.

### Models and Artifacts

The repository contains generated outputs in two places:

- Root-level `models/` and `artifacts/` contain the committed model and result files.
- `backend/models/` and `backend/artifacts/` exist as the backend's expected runtime directories and currently contain `.gitkeep` placeholders.

The backend loads files from `backend/models/` and `backend/artifacts/`, so if you retrain the notebooks you should copy the generated outputs there as well.

### Backend

`backend/app.py` is the Flask application. It serves the frontend, loads the dataset, and exposes the API endpoints used by the dashboard.

### Frontend

`frontend/index.html` loads the dashboard UI, with styles in `frontend/assets/css/styles.css` and browser logic in `frontend/assets/js/main.js`.

### Notebooks

The notebooks are intended to be run in order:

1. `notebooks/01_random_forest_pollutant_importance.ipynb`
2. `notebooks/02_xgboost_aqi_forecasting.ipynb`
3. `notebooks/03_city_pollutant_correlation.ipynb`

## Notebook Outputs

### 1. Random Forest pollutant importance

- Trains a `RandomForestRegressor` using pollutant features.
- Produces pollutant importance outputs for the dashboard.
- Expected outputs:
  - `models/random_forest.pkl`
  - `artifacts/feature_importance.json`
  - `artifacts/feature_importance.csv`

### 2. XGBoost AQI forecasting

- Trains an `XGBRegressor` for monthly AQI prediction.
- Uses city encoding, lag features, weather, and time features.
- Expected outputs:
  - `models/xgboost.pkl`
  - `models/city_label_encoder.pkl`
  - `artifacts/xgboost_metadata.json`
  - `artifacts/future_aqi_predictions.csv`

### 3. City pollutant correlation

- Reads the pollutant importance output.
- Computes city-level pollutant correlation summaries.
- Expected output:
  - `artifacts/pollutant_correlations.json`

## Backend API

The Flask backend exposes these routes, with `/api/...` aliases also supported:

- `GET /get_city_data`
- `GET /get_feature_importance`
- `GET /get_pollutant_correlation`
- `GET /predict_aqi`
- `GET /cities`

## Setup and Run

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Run the notebooks in order to refresh the generated outputs.

3. Start the backend:

```bash
python backend/app.py
```

4. Open the app in a browser at `http://127.0.0.1:5000/`.

## Example Requests

```bash
curl "http://127.0.0.1:5000/get_city_data?city_name=Delhi"
curl "http://127.0.0.1:5000/get_feature_importance"
curl "http://127.0.0.1:5000/get_pollutant_correlation?city_name=Delhi"
curl "http://127.0.0.1:5000/predict_aqi?city_name=Delhi&horizon=12"
```

## Data Notes

- The dataset does not include latitude and longitude, so the map uses deterministic estimated coordinates for city placement.
- Some demographic and weather values are synthetic, used to fill gaps and maintain consistent coverage.
- If model files or artifact files are missing, the backend returns a message explaining which notebook or output is required.

## Related Docs

- `docs/dataset_readme.md` contains the dataset schema and column reference.
- `docs/project_readme.md` contains the original project documentation.
- `docs/readme_legacy_copy.md` preserves an earlier version of the README content.
