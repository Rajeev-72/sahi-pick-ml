# Sahi Pick — pick the better one

India-first food label reader. Static site, no build step. Open `index.html`, or serve the folder
(camera scanning needs https or localhost).

## What it does
- **Compare** two products (or fresh foods) and get a clear "pick this one, because…" answer
- **Healthier swaps** on every product, searched in the same category, Indian products first
- **My profile**: goals (less sugar, more protein, …) and allergies; ratings and allergen alerts adapt
- **Basket**: add what you plan to buy, see total sugar, salt and energy for the trip
- **Fresh foods**: typical values for common fruit, vegetables, dal, dairy (no barcode needed; approximate)
- **Kitchen test** (`#/coverage`): paste 10 barcodes to see how well Open Food Facts covers your pantry
- **India scale**: Low/Medium/High from ICMR-NIN 2024 reference values (basis of FSSAI's front-of-pack proposal; not yet final law). UK scale available in the profile.

## Machine learning
Two small models run **in the browser** (no server, no ML library) and show up as the *Smart estimate* card on every packed-food page:

| Model | Input | Output | Held-out result |
|---|---|---|---|
| Health | calories, fat, sat fat, carbs, sugar, protein, salt, fibre + category flags | Nutri-Score points → grade A–E, plus the nutrients that drove it | MAE 1.2 points (mean-guess baseline 8.4), R² 0.97, 98.7% of grades within one step |
| NOVA | 250 category tags, additive count, nutrients | NOVA group 1–4 with probabilities | 84.4% accuracy, macro-F1 0.85 (majority baseline 57%) |

Both are gradient-boosted trees (scikit-learn), exported to `js/model-data.js` and evaluated by `js/ml.js`.
Train them yourself: `pip install -r ml/requirements.txt && python ml/train.py path/to/off_ch.parquet` (writes `js/model-data.js` and `ml/metrics.json`).
`node tests/ml-parity.js` proves the JavaScript gives the same predictions as scikit-learn.

**Honest limits:** trained on a Swiss Open Food Facts snapshot (~42k products with Nutri-Score, ~28k with NOVA), so Indian foods are out-of-distribution. There is no ingredients text in that data, so NOVA relies on category and additive count and is less sure for plain foods (the card says "leaning" below 75% confidence). The health model learns the Nutri-Score formula from data; it is not an independent measure of healthiness. The Sahi score stays rule-based on purpose.
Next step: retrain on Indian-tagged products and add an ingredients-text feature.

## Files
- `index.html` – shell (nav + footer)
- `js/utils.js` – helpers, icons · `js/store.js` – profile + basket (localStorage)
- `js/score.js` – rating engine, allergen check · `js/fresh.js` – fresh foods
- `js/api.js` – Open Food Facts (India-first search, alternatives)
- `js/router.js`, `js/pages.js`, `js/pages2.js`, `js/scan.js` – routes: `#/`, `#/search/:q`, `#/product/:code`, `#/compare/:a/:b`, `#/basket`, `#/profile`, `#/scan`, `#/barcode`, `#/coverage`, `#/about`
- `js/ml.js` – browser inference · `js/model-data.js` – generated model weights (do not edit) · `ml/train.py` – training + export · `ml/metrics.json` · `tests/ml-parity.js`
- `js/demo.js` – sample data for offline preview only (not loaded)

Ratings are general guidance, not medical advice. Always check the pack.
