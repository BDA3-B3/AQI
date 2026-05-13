# Air Quality Index (AQI) Analysis — Power BI Dashboard

## Project Overview

This project presents an end-to-end data analysis of global Air Quality Index (AQI) measurements across **2,111 cities** and **82 countries**, spanning the period **2005–2025**. The data was collected, cleaned, normalized, and modeled in a **Fact Constellation Schema (Galaxy Schema)**, then visualized through an interactive Power BI dashboard.

> **Data Note**: This dataset is based on real-world air quality and weather information. However, a portion of the data (including some demographic figures and weather values) is **synthetic**, generated to supplement gaps and ensure consistent coverage across all cities and time periods.

The dashboard enables exploration of air quality trends, pollutant breakdowns, weather correlations, and demographic impacts on pollution levels.

---

## Dashboard Features

- Monthly and yearly AQI trends per city and country
- Pollutant breakdown (PM2.5, PM10, NO2, SO2, CO, O3, NH3)
- AQI category distribution (Good → Hazardous)
- Weather condition correlations with air quality
- Demographic factors: population density, urbanization, vehicle count, industrial area
- Geographic filtering by country, city, and state
- Year hierarchy drill-down in Date_Dimension

---

## Data Sources

Raw data was sourced and consolidated into 6 CSV files before being imported into Power BI:

| File | Type | Description |
|------|------|-------------|
| `AQI Data.csv` | Fact Table | Monthly AQI and pollutant measurements per city |
| `Weather.csv` | Fact Table | Monthly weather conditions per city |
| `Cities.csv` | Dimension | City names and state/region info |
| `Countries.csv` | Dimension | Country reference data |
| `Date_Dimension.csv` | Dimension | Month-year time dimension |
| `Demographics.csv` | Dimension | Yearly city demographic snapshots |

---

## Data Pipeline & Cleaning Process

### Step 1 — Data Normalization
The original raw data was denormalized (city, country, and date information were embedded inside each row). The data was restructured into a normalized **Fact Constellation Schema** by:
- Extracting unique cities into a separate **Cities** table
- Extracting unique countries into a separate **Countries** table
- Creating a dedicated **Date_Dimension** table with a `date_key` (format: `YY-MM`), `year`, `month`, and `month_number` columns

This normalization reduced redundancy and established clear foreign key relationships between tables.

---

### Step 2 — Outlier Removal (IQR Method) (City-wise)
Outliers in the **AQI Data** table were identified and removed using the **Interquartile Range (IQR)** method:
- Calculated Q1 (25th percentile) and Q3 (75th percentile) for AQI values
- Computed IQR = Q3 − Q1
- Removed all rows where AQI < Q1 − 1.5×IQR or AQI > Q3 + 1.5×IQR
- This process was applied to ensure extreme outliers did not skew analysis results

---

### Step 3 — AQI Category Column
A new derived column `AQI Category` was added to the **AQI Data** table to classify each reading into a qualitative label based on standard AQI breakpoints:

| AQI Range | Category |
|-----------|----------|
| 0 – 50 | Good |
| 51 – 100 | Moderate |
| 101 – 150 | Unhealthy for Sensitive Groups |
| 151 – 200 | Unhealthy |
| 201 – 300 | Very Unhealthy |
| 301 – 500 | Hazardous |

---

### Step 4 — Duplicate Removal
Duplicate records were identified and removed across all tables. A record was considered a duplicate if it had the same combination of `city_id` and `date_key` (for fact tables), ensuring each city-month measurement appears exactly once.

---

### Step 5 — Sparse City Filtering
Cities with **fewer than 5 years** of AQI data were excluded from the dataset. This threshold ensures:
- Meaningful trend analysis over time
- Avoidance of cities with too little data to derive reliable insights
- Consistency across comparative analyses

---

### Step 6 — Primary Keys & Relationships
Primary keys were explicitly defined for dimension tables:
- `Cities.city_id` — Primary Key
- `Countries.country_id` — Primary Key
- `Date_Dimension.date_key` — Primary Key

Foreign key relationships were then defined in **Power BI Desktop** (Data Model view):

| Relationship | Cardinality | Join Columns |
|---|---|---|
| Countries → Cities | One-to-Many (1:*) | `country_id` |
| Cities → AQI Data | One-to-Many (1:*) | `city_id` |
| Cities → Weather | One-to-Many (1:*) | `city_id` |
| Cities → Demographics | One-to-Many (1:*) | `city_id` |
| Date_Dimension → AQI Data | One-to-Many (1:*) | `date_key` |
| Date_Dimension → Weather | One-to-Many (1:*) | `date_key` |

Cross-filter direction was set appropriately to allow slicers on dimension tables to filter both fact tables simultaneously.

---

## Data Model (Fact Constellation / Galaxy Schema)
![Database Schema](Screenshots/Schema.png)

---

## Calculated Measures (Power BI DAX)

The following measures were created in Power BI Desktop and are **not** stored in the source CSV files. They are computed at query time using DAX:

### AQI Data Measures
| Measure | Description |
|---------|-------------|
| `AQI Measure` | Aggregated AQI value |
| `CO Measure` | Carbon Monoxide aggregation |
| `NH3 Measure` | Ammonia aggregation |
| `NO2 Measure` | Nitrogen Dioxide aggregation |
| `O3 Measure` | Ozone aggregation |
| `PM10 Measure` | PM10 aggregation |
| `PM2.5 Measure` | PM2.5 aggregation |
| `SO2 Measure` | Sulfur Dioxide aggregation |

### Demographics Measures (To make the gauges interactive)
| Measure | Description |
|---------|-------------|
| `Max Population` | Maximum population across filtered cities |
| `Max Population Density` | Maximum population density across filtered cities |
| `Max Vehicle Count` | Maximum vehicle count across filtered cities |

---

## Full Column Reference

### AQI Data.csv (Fact Table — ~350,043 rows)
| Column | Type | Description |
|--------|------|-------------|
| `city_id` | INTEGER | Foreign key → Cities |
| `date_key` | STRING | Foreign key → Date_Dimension (format: YY-MM) |
| `AQI` | INTEGER | Overall Air Quality Index score |
| `PM2.5` | FLOAT | Particulate Matter ≤2.5µm (µg/m³) |
| `PM10` | FLOAT | Particulate Matter ≤10µm (µg/m³) |
| `NO2` | FLOAT | Nitrogen Dioxide (µg/m³) |
| `SO2` | FLOAT | Sulfur Dioxide (µg/m³) |
| `CO` | FLOAT | Carbon Monoxide (mg/m³) |
| `O3` | FLOAT | Ozone (µg/m³) |
| `NH3` | FLOAT | Ammonia (µg/m³) |
| `AQI Category` | STRING | Derived category label (Good / Moderate / Unhealthy / etc.) |

### Weather.csv (Fact Table — ~350,043 rows)
| Column | Type | Description |
|--------|------|-------------|
| `city_id` | INTEGER | Foreign key → Cities |
| `date_key` | STRING | Foreign key → Date_Dimension (format: YY-MM) |
| `Temperature` | FLOAT | Temperature in °C |
| `Humidity` | FLOAT | Relative humidity (%) |
| `Wind Speed` | FLOAT | Wind speed (km/h) |
| `Rainfall` | FLOAT | Rainfall in mm |
| `Visibility` | INTEGER | Visibility in meters |

### Cities.csv (Dimension — ~2,111 rows)
| Column | Type | Description |
|--------|------|-------------|
| `city_id` | INTEGER | **Primary Key** |
| `city_name` | STRING | Name of the city |
| `country_id` | INTEGER | Foreign key → Countries |
| `State` | STRING | State or administrative region |

### Countries.csv (Dimension — 82 rows)
| Column | Type | Description |
|--------|------|-------------|
| `country_id` | INTEGER | **Primary Key** |
| `country_name` | STRING | Name of the country |

### Date_Dimension.csv (Dimension — 254 rows)
| Column | Type | Description |
|--------|------|-------------|
| `date_key` | STRING | **Primary Key** (format: YY-MM) |
| `year` | INTEGER | Four-digit year (2005–2025) |
| `month` | STRING | Full month name |
| `month_number` | INTEGER | Month number (1–12) for sorting |

### Demographics.csv (Dimension — ~29,736 rows)
| Column | Type | Description |
|--------|------|-------------|
| `city_id` | INTEGER | Foreign key → Cities |
| `year` | INTEGER | Year of the demographic snapshot |
| `Population` | INTEGER | Total city population |
| `Population Density` | INTEGER | People per km² |
| `Urbanization %` | INTEGER | Urbanization percentage |
| `Vehicle Count` | INTEGER | Number of registered vehicles |
| `Industrial Area %` | INTEGER | Industrial land use percentage |

---

## Technical Specifications

- **Tool**: Microsoft Power BI Desktop
- **Data Format**: CSV (UTF-8)
- **Date Range**: 2005 – 2025 (monthly granularity)
- **Geographic Coverage**: 82 countries, 2,111 cities
- **Schema Type**: Fact Constellation (Galaxy Schema)
- **Fact Tables**: AQI Data, Weather
- **Dimension Tables**: Cities, Countries, Date_Dimension, Demographics

---

## Repository Structure

```
Complete Dataset/
├── AQI Data.csv          # Fact table — air quality measurements
├── Weather.csv           # Fact table — weather conditions
├── Cities.csv            # Dimension — city reference
├── Countries.csv         # Dimension — country reference
├── Date_Dimension.csv    # Dimension — time reference
├── Demographics.csv      # Dimension — city demographics
├── README.md             # CSV dataset technical documentation
└── PROJECT_README.md     # This file — full project documentation
```

---

**Last Updated**: February 2026  
**Author**: Husain Ghadiyali
