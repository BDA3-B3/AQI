# Air Quality Index (AQI) Dataset Documentation

## Overview
This dataset contains comprehensive information about Air Quality Index (AQI) measurements across multiple cities worldwide, along with related demographic, weather, and geographic information. The dataset is structured using a **Fact Constellation Schema (Galaxy Schema)** — featuring two fact tables (AQI Data and Weather) that share common dimension tables — for efficient data analysis.

> **Data Note**: This dataset is based on real-world air quality and weather information. However, a portion of the data (including some demographic figures and weather values) is **synthetic**, generated to supplement gaps and ensure consistent coverage across all cities and time periods.

## Dataset Structure

### Files Overview
- **AQI Data.csv** - Fact table containing air quality measurements
- **Weather.csv** - Fact table containing weather conditions
- **Cities.csv** - Dimension table for city information
- **Countries.csv** - Dimension table for country information
- **Date_Dimension.csv** - Dimension table for temporal information
- **Demographics.csv** - Dimension table for city demographics

---

## File Details and Column Descriptions

### 1. AQI Data.csv
**Description**: Central fact table containing air quality measurements for cities over time.

**Total Records**: ~350,043 rows

**Columns**:
- `city_id` (INTEGER) - Foreign key linking to Cities.csv
- `date_key` (STRING) - Foreign key linking to Date_Dimension.csv (format: YY-MM)
- `AQI` (INTEGER) - Air Quality Index value (0-500 scale)
- `PM2.5` (FLOAT) - Particulate Matter 2.5 micrometers concentration (μg/m³)
- `PM10` (FLOAT) - Particulate Matter 10 micrometers concentration (μg/m³)
- `NO2` (FLOAT) - Nitrogen Dioxide concentration (μg/m³)
- `SO2` (FLOAT) - Sulfur Dioxide concentration (μg/m³)
- `CO` (FLOAT) - Carbon Monoxide concentration (mg/m³)
- `O3` (FLOAT) - Ozone concentration (μg/m³)
- `NH3` (FLOAT) - Ammonia concentration (μg/m³)
- `AQI Category` (STRING) - Qualitative air quality category (e.g., Good, Moderate, Unhealthy)

**Relationships**:
- Many-to-one relationship with Cities.csv (via `city_id`)
- Many-to-one relationship with Date_Dimension.csv (via `date_key`)

---

### 2. Weather.csv
**Description**: Fact table containing weather conditions corresponding to AQI measurements.

**Total Records**: ~350,043 rows

**Columns**:
- `city_id` (INTEGER) - Foreign key linking to Cities.csv
- `date_key` (STRING) - Foreign key linking to Date_Dimension.csv (format: YY-MM)
- `Temperature` (FLOAT) - Temperature in Celsius (°C)
- `Humidity` (FLOAT) - Relative humidity percentage (%)
- `Wind Speed` (FLOAT) - Wind speed in km/h or m/s
- `Rainfall` (FLOAT) - Rainfall amount in mm
- `Visibility` (INTEGER) - Visibility distance in meters

**Relationships**:
- Many-to-one relationship with Cities.csv (via `city_id`)
- Many-to-one relationship with Date_Dimension.csv (via `date_key`)
- Shares the same grain as AQI Data.csv (city-date combinations)

---

### 3. Cities.csv
**Description**: Dimension table containing information about cities where measurements were taken.

**Total Records**: ~2,111 rows

**Columns**:
- `city_id` (INTEGER) - Primary key, unique identifier for each city
- `city_name` (STRING) - Name of the city
- `country_id` (INTEGER) - Foreign key linking to Countries.csv
- `State` (STRING) - State, province, or administrative region within the country

**Relationships**:
- One-to-many relationship with AQI Data.csv
- One-to-many relationship with Weather.csv
- One-to-many relationship with Demographics.csv
- Many-to-one relationship with Countries.csv (via `country_id`)

---

### 4. Countries.csv
**Description**: Dimension table containing country information.

**Total Records**: ~82 rows

**Columns**:
- `country_id` (INTEGER) - Primary key, unique identifier for each country
- `country_name` (STRING) - Name of the country

**Relationships**:
- One-to-many relationship with Cities.csv

---

### 5. Date_Dimension.csv
**Description**: Dimension table providing temporal context for measurements.

**Total Records**: ~254 rows

**Columns**:
- `date_key` (STRING) - Primary key in format YY-MM (e.g., "14-10" for October 2014)
- `year` (INTEGER) - Four-digit year (e.g., 2005, 2014)
- `month` (STRING) - Full month name (e.g., January, February)
- `month_number` (INTEGER) - Numeric representation of the month (1 = January, 12 = December)

**Relationships**:
- One-to-many relationship with AQI Data.csv
- One-to-many relationship with Weather.csv

---

### 6. Demographics.csv
**Description**: Dimension table containing demographic and urban characteristics of cities.

**Total Records**: ~29,736 rows

**Columns**:
- `city_id` (INTEGER) - Foreign key linking to Cities.csv
- `year` (INTEGER) - Year of demographic data
- `Population` (INTEGER) - Total population of the city
- `Population Density` (INTEGER) - Population per square kilometer
- `Urbanization %` (INTEGER) - Percentage of urbanization
- `Vehicle Count` (INTEGER) - Number of registered vehicles
- `Industrial Area %` (INTEGER) - Percentage of land used for industrial purposes

**Relationships**:
- Many-to-one relationship with Cities.csv (via `city_id`)
- Time-variant dimension (contains yearly snapshots per city)

---

## Data Model Relationships

### Entity Relationship Diagram

The dataset follows a **Fact Constellation Schema (Galaxy Schema)** — two fact tables (AQI Data and Weather) share multiple dimension tables (Cities, Countries, Date_Dimension, Demographics):

```
                    Demographics
                         │
                         │ (M:1)
                         │
    Countries (1)────(M) Cities (1)────(M) AQI Data (M)────(1) Date_Dimension
                         │                                          │
                         │                                          │
                         └──────────(M) Weather (M)────────────────┘
```

**Cardinality Legend**: (1) = One, (M) = Many

### Detailed Relationship Map

```
┌─────────────────┐
│  Demographics   │
│  * city_id      │────┐
│    year         │    │
│    Population   │    │ (Many-to-One)
└─────────────────┘    │
                       │
┌─────────────────┐    │      ┌─────────────────┐
│   Countries     │    │      │     Cities      │
│  * country_id   │────┼─────>│  * city_id      │
│    country_name │    │ (1:M)│    city_name    │
└─────────────────┘    └──────│  # country_id   │
                              │    State        │
                              └─────────────────┘
                                     │   │
                         ┌───────────┘   └───────────┐
                         │ (1:M)                 (1:M)│
                         ▼                             ▼
              ┌─────────────────┐          ┌─────────────────┐
              │    AQI Data     │          │     Weather     │
              │  # city_id      │          │  # city_id      │
              │  # date_key     │          │  # date_key     │
              │    AQI          │          │    Temperature  │
              │    PM2.5        │          │    Humidity     │
              │    ...          │          │    ...          │
              └─────────────────┘          └─────────────────┘
                       │ (M:1)                      │ (M:1)
                       └────────────┬───────────────┘
                                    ▼
                          ┌─────────────────┐
                          │ Date_Dimension  │
                          │  * date_key     │
                          │    year         │
                          │    month        │
                          └─────────────────┘
```

**Symbols**: `*` = Primary Key, `#` = Foreign Key

### Key Relationships Explained:

1. **Countries → Cities** (One-to-Many) `[1:*]`
   - One country can have multiple cities
   - A city belongs to exactly one country

2. **Cities → AQI Data** (One-to-Many) `[1:*]`
   - One city has multiple AQI measurements over time
   - Each AQI measurement belongs to exactly one city

3. **Cities → Weather** (One-to-Many) `[1:*]`
   - One city has multiple weather records over time
   - Each weather record belongs to exactly one city

4. **Demographics → Cities** (Many-to-One) `[*:1]`
   - Multiple demographic records (yearly snapshots) can exist for one city
   - Each demographic record belongs to exactly one city

5. **Date_Dimension → AQI Data** (One-to-Many) `[1:*]`
   - One date (month-year) has measurements for multiple cities
   - Each AQI measurement is recorded for exactly one date

6. **Date_Dimension → Weather** (One-to-Many) `[1:*]`
   - One date (month-year) has weather data for multiple cities
   - Each weather record is recorded for exactly one date

7. **AQI Data ↔ Weather** (Parallel Fact Tables, Same Grain)
   - Both tables share the same grain: city + date combination
   - Can be joined to analyze air quality with weather conditions

---

## Data Quality Notes

### Date Key Format
- Format: `YY-MM` (e.g., "14-10" represents October 2014)
- The year is represented in 2-digit format
- Dates span from 2005 to recent years

### AQI Categories
Common categories include:
- **Good** (0-50): Air quality is satisfactory
- **Moderate** (51-100): Acceptable air quality
- **Unhealthy for Sensitive Groups** (101-150)
- **Unhealthy** (151-200)
- **Very Unhealthy** (201-300)
- **Hazardous** (301-500)

### Missing Data
- Some cities may not have data for all time periods
- Demographics table contains yearly aggregates, not monthly

---

## Technical Specifications

- **Data Format**: CSV (Comma-Separated Values)
- **Date Range**: 2005 - 2025 (approximately)
- **Geographic Coverage**: 82 countries, 2,111 cities worldwide
- **Time Granularity**: Monthly measurements
- **Primary Fact Tables**: AQI Data, Weather
- **Dimension Tables**: Cities, Countries, Date_Dimension, Demographics

---

**Last Updated**: February 2026