# Schools Mapping System by ASiM

A Leaflet-based school mapping system for DEA Khushab. The app loads school data from `schools.csv`, displays schools on an interactive map, and provides search, filters, counts, marker legend, coordinate copy, and Google Maps links.

## Project Files

- `index.html` - page structure and script/style references.
- `styles.css` - visual design, layout, responsive mobile rules, map legend, and filter panel styling.
- `app.js` - map setup, CSV loading, filtering, search, markers, legend, stats, and UI behavior.
- `schools.csv` - source school data.
- `schools-data.js` - generated fallback copy of the CSV for direct file opening.
- `update-data.js` - validates `schools.csv` and regenerates `schools-data.js`.
- `update-data.bat` - Windows helper for running the update script.

## Data Format

`schools.csv` should use these columns:

```csv
tehsil,markaz,name,gender,level,category,lat,lng
```

The update script validates required fields, tehsil/category names, duplicate rows, duplicate school identities, and latitude/longitude values.

## Update School Data

After editing `schools.csv`, run:

```bash
npm run update-data
```

This checks the CSV and regenerates `schools-data.js`.

## Run Locally

The app can be opened directly with `index.html`, using `schools-data.js` as a fallback. For normal browser behavior with `schools.csv`, run a local server from this folder.

Using Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Features

- Interactive Leaflet map.
- Search by school name.
- Filters for tehsil, markaz, gender, level, and category.
- Auto-updating totals and filter counts.
- Mobile collapsible filter panel.
- Mobile collapsible legend.
- Marker colors by tehsil or markaz.
- Marker shapes for SED, Middle, and PSRP schools.
- Coordinate copy and Google Maps links.

## Maintenance Notes

- Keep `schools.csv` as the source of truth.
- Run `npm run update-data` after CSV changes.
- Keep `index.html` mostly structural; put design changes in `styles.css` and behavior changes in `app.js`.