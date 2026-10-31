"""Sahi Pick · ml/train.py
Trains two small models on Open Food Facts data and exports them as plain JS so the
static site can run them in the browser (no server, no TensorFlow.js).

  1. Health model : nutrients (+ category flags)  -> Nutri-Score points (regression) -> grade A-E
  2. NOVA model   : categories + additives + nutrients -> NOVA group 1-4 (classification)

Data: Open Food Facts, Swiss snapshot (Andrea1700/nutriscore-projekt, data/bronze/*.parquet).
Usage:  python ml/train.py path/to/off_ch.parquet
Outputs: js/model-data.js  and  ml/metrics.json
"""
import sys, json, numpy as np, pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score, f1_score, confusion_matrix

SEED = 42
src = sys.argv[1]
df = pd.read_parquet(src)
df['cats'] = df.categories_tags.apply(lambda a: list(a) if a is not None and len(a) else [])
catstr = df.cats.apply(lambda c: ' '.join(c))

NUT = ['energy_kcal', 'fat', 'saturated_fat', 'carbohydrates', 'sugars', 'proteins', 'salt', 'fiber']
FLAGS = {                      # coarse category flags (Nutri-Score treats these differently)
    'is_beverage': r'en:beverages',
    'is_cheese':   r'en:cheeses',
    'is_fat_oil':  r'en:fats|en:oils|en:butters',
    'is_dairy':    r'en:dairies|en:milks|en:yogurts',
}
for k, pat in FLAGS.items():
    df[k] = catstr.str.contains(pat).astype(float)

def nutrient_frame(d):
    X = pd.DataFrame(index=d.index)
    for c in NUT:
        X[c] = d[c].fillna(0.0)
    X['fiber_missing'] = d['fiber'].isna().astype(float)
    for k in FLAGS: X[k] = d[k]
    return X

metrics = {}
out = {'version': 1, 'source': 'Open Food Facts (Swiss snapshot)', 'trained_on': str(pd.Timestamp.today().date())}

def export_trees(est_list):
    """sklearn tree_ -> compact arrays [feature, threshold, left, right, value]"""
    trees = []
    for t in est_list:
        T = t.tree_
        trees.append({'f': T.feature.tolist(),
                      't': [round(float(x), 5) for x in T.threshold],
                      'l': T.children_left.tolist(), 'r': T.children_right.tolist(),
                      'v': [round(float(x[0][0]), 5) for x in T.value]})
    return trees

# ------------------------------------------------------------------ 1. health model
h = df[df.nutriscore_grade.isin(list('abcde')) & df.nutriscore_score.notna()].copy()
h = h.dropna(subset=['energy_kcal', 'fat', 'saturated_fat', 'sugars', 'proteins', 'salt'])
h['carbohydrates'] = h['carbohydrates'].fillna(h['sugars'])
Xh, yh = nutrient_frame(h), h.nutriscore_score.astype(float)
Xtr, Xte, ytr, yte = train_test_split(Xh, yh, test_size=0.2, random_state=SEED)
reg = GradientBoostingRegressor(n_estimators=120, max_depth=4, learning_rate=0.1, subsample=0.8, random_state=SEED)
reg.fit(Xtr, ytr)
pred = reg.predict(Xte)

def grade_from_points(p, bev):
    p = np.asarray(p)
    food = np.select([p <= -1, p <= 2, p <= 10, p <= 18], [0, 1, 2, 3], 4)
    drink = np.select([p <= 1, p <= 5, p <= 9], [1, 2, 3], 4)   # simplified: no A for drinks
    return np.where(bev == 1, drink, food)

true_grade = h.loc[Xte.index, 'nutriscore_grade'].map(dict(zip('abcde', range(5)))).values
pred_grade = grade_from_points(pred, Xte.is_beverage.values)
metrics['health'] = {
    'rows_train': int(len(Xtr)), 'rows_test': int(len(Xte)),
    'MAE_points': round(float(mean_absolute_error(yte, pred)), 2),
    'R2': round(float(r2_score(yte, pred)), 3),
    'grade_accuracy': round(float(accuracy_score(true_grade, pred_grade)), 3),
    'grade_within_1': round(float((np.abs(true_grade - pred_grade) <= 1).mean()), 3),
}
# Baseline for context: predicting the mean
metrics['health']['baseline_MAE_points'] = round(float(mean_absolute_error(yte, np.full_like(yte, ytr.mean()))), 2)
# Refit on everything for the shipped model
reg.fit(Xh, yh)
out['health'] = {
    'features': list(Xh.columns), 'init': round(float(reg.init_.constant_[0][0]), 5), 'lr': reg.learning_rate,
    'trees': export_trees([e[0] for e in reg.estimators_]),
    'fill': {c: 0.0 for c in Xh.columns},
    'importance': {c: round(float(i), 4) for c, i in zip(Xh.columns, reg.feature_importances_)},
}

# ------------------------------------------------------------------ 2. NOVA model
n = df[df.nova_group.notna()].copy()
n = n[n.cats.apply(len) > 0]
n['nova'] = n.nova_group.astype(int)
from collections import Counter
cnt = Counter(t for c in n.cats for t in set(c))
TOP = [t for t, k in cnt.most_common(250) if k >= 40]

def nova_frame(d):
    X = pd.DataFrame(index=d.index)
    for c in ['energy_kcal', 'fat', 'saturated_fat', 'sugars', 'proteins', 'salt', 'fiber']:
        X[c] = d[c].fillna(0.0)
    X['additives_n'] = d['additives_n'].fillna(0.0)
    X['additives_missing'] = d['additives_n'].isna().astype(float)
    X['nut_missing'] = d[['energy_kcal', 'fat', 'sugars']].isna().any(axis=1).astype(float)
    cs = d.cats.apply(set)
    tagcols = {('cat:' + t): cs.apply(lambda s: float(t in s)) for t in TOP}
    return pd.concat([X, pd.DataFrame(tagcols, index=d.index)], axis=1)

Xn, yn = nova_frame(n), n.nova
Xtr, Xte, ytr, yte = train_test_split(Xn, yn, test_size=0.2, random_state=SEED, stratify=yn)
clf = GradientBoostingClassifier(n_estimators=80, max_depth=3, learning_rate=0.15, subsample=0.8, random_state=SEED)
clf.fit(Xtr, ytr)
pn = clf.predict(Xte)
majority = yte.value_counts(normalize=True).max()
metrics['nova'] = {
    'rows_train': int(len(Xtr)), 'rows_test': int(len(Xte)), 'n_features': int(Xn.shape[1]),
    'accuracy': round(float(accuracy_score(yte, pn)), 3),
    'macro_F1': round(float(f1_score(yte, pn, average='macro')), 3),
    'majority_baseline_accuracy': round(float(majority), 3),
    'class_balance': {int(k): round(float(v), 3) for k, v in yn.value_counts(normalize=True).sort_index().items()},
    'confusion_matrix_rows_true_1to4': confusion_matrix(yte, pn).tolist(),
}
clf.fit(Xn, yn)
out['nova'] = {
    'features': list(Xn.columns), 'classes': [int(c) for c in clf.classes_],
    'init': [round(float(x), 5) for x in clf.init_.predict_proba(np.zeros((1, Xn.shape[1])))[0]] if False else None,
    'prior': [round(float(x), 6) for x in np.log(np.clip(clf.init_.class_prior_, 1e-9, 1))],
    'lr': clf.learning_rate,
    'trees': [export_trees(clf.estimators_[i]) for i in range(len(clf.estimators_))],  # [stage][class]
    'fill': {c: 0.0 for c in Xn.columns},
}
out['meta'] = {'top_categories': TOP}

# Parity fixture: lets tests/ml-parity.js prove the JS port gives the same answers as scikit-learn
fx = []
hs = h.sample(120, random_state=1)
for i, r in hs.iterrows():
    fx.append({'kind': 'health', 'cats': r.cats, 'nut': {c: (None if pd.isna(r[c]) else float(r[c])) for c in NUT},
               'py': float(reg.predict(nutrient_frame(hs.loc[[i]]))[0])})
ns = n.sample(120, random_state=1)
for i, r in ns.iterrows():
    fx.append({'kind': 'nova', 'cats': r.cats, 'nut': {c: (None if pd.isna(r[c]) else float(r[c])) for c in NUT},
               'additives_n': None if pd.isna(r.additives_n) else float(r.additives_n),
               'py': clf.predict_proba(nova_frame(ns.loc[[i]]))[0].tolist()})
import os; os.makedirs('../tests', exist_ok=True)
json.dump(fx, open('../tests/parity_fixture.json', 'w'))

with open('metrics.json', 'w') as f: json.dump(metrics, f, indent=2)
with open('../js/model-data.js', 'w') as f:
    f.write('/* Generated by ml/train.py — do not edit by hand. */\nwindow.SP_MODELS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print(json.dumps(metrics, indent=2))
