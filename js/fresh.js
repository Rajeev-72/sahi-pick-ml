/* Sahi Pick · fresh.js — loose / fresh foods that have no barcode.
   Typical values per 100 g, rounded. They are APPROXIMATE guides (raw unless stated).
   For exact Indian values see the IFCT 2017 tables (NIN Hyderabad). */
(() => {
  'use strict';
  // id, name, group, kcal, protein, fat, sat, carbs, sugar, fibre, sodium(mg), allergens
  const ROWS = [
    ['apple', 'Apple (seb)', 'fruit', 52, 0.3, 0.2, 0.0, 13.8, 10.4, 2.4, 1],
    ['banana', 'Banana (kela)', 'fruit', 89, 1.1, 0.3, 0.1, 22.8, 12.2, 2.6, 1],
    ['orange', 'Orange (santra)', 'fruit', 47, 0.9, 0.1, 0.0, 11.8, 9.4, 2.4, 0],
    ['mango', 'Mango (aam)', 'fruit', 60, 0.8, 0.4, 0.1, 15, 13.7, 1.6, 1],
    ['guava', 'Guava (amrood)', 'fruit', 68, 2.6, 1.0, 0.3, 14.3, 8.9, 5.4, 2],
    ['papaya', 'Papaya (papita)', 'fruit', 43, 0.5, 0.3, 0.1, 10.8, 7.8, 1.7, 8],
    ['grapes', 'Grapes (angoor)', 'fruit', 69, 0.7, 0.2, 0.1, 18.1, 15.5, 0.9, 2],
    ['watermelon', 'Watermelon (tarbooj)', 'fruit', 30, 0.6, 0.2, 0.0, 7.6, 6.2, 0.4, 1],
    ['pomegranate', 'Pomegranate (anar)', 'fruit', 83, 1.7, 1.2, 0.1, 18.7, 13.7, 4.0, 3],
    ['potato', 'Potato (aloo)', 'vegetable', 77, 2.0, 0.1, 0.0, 17, 0.8, 2.2, 6],
    ['onion', 'Onion (pyaaz)', 'vegetable', 40, 1.1, 0.1, 0.0, 9.3, 4.2, 1.7, 4],
    ['tomato', 'Tomato (tamatar)', 'vegetable', 18, 0.9, 0.2, 0.0, 3.9, 2.6, 1.2, 5],
    ['carrot', 'Carrot (gajar)', 'vegetable', 41, 0.9, 0.2, 0.0, 9.6, 4.7, 2.8, 69],
    ['spinach', 'Spinach (palak)', 'vegetable', 23, 2.9, 0.4, 0.1, 3.6, 0.4, 2.2, 79],
    ['cauliflower', 'Cauliflower (gobi)', 'vegetable', 25, 1.9, 0.3, 0.1, 5.0, 1.9, 2.0, 30],
    ['cucumber', 'Cucumber (kheera)', 'vegetable', 15, 0.7, 0.1, 0.0, 3.6, 1.7, 0.5, 2],
    ['okra', 'Okra (bhindi)', 'vegetable', 33, 1.9, 0.2, 0.0, 7.5, 1.5, 3.2, 7],
    ['brinjal', 'Brinjal (baingan)', 'vegetable', 25, 1.0, 0.2, 0.0, 5.9, 3.5, 3.0, 2],
    ['peas', 'Green peas (matar)', 'vegetable', 81, 5.4, 0.4, 0.1, 14.5, 5.7, 5.1, 5],
    ['rice', 'Cooked white rice (chawal)', 'staple', 130, 2.7, 0.3, 0.1, 28, 0.1, 0.4, 1],
    ['chana', 'Boiled chickpeas (chana)', 'staple', 164, 8.9, 2.6, 0.3, 27.4, 4.8, 7.6, 7],
    ['moong', 'Boiled moong dal', 'staple', 105, 7.0, 0.4, 0.1, 19, 2.0, 7.6, 2],
    ['egg', 'Boiled egg (anda)', 'protein', 155, 13, 11, 3.3, 1.1, 1.1, 0, 124, ['en:eggs']],
    ['chicken', 'Chicken breast, cooked', 'protein', 165, 31, 3.6, 1.0, 0, 0, 0, 74],
    ['paneer', 'Paneer (fresh)', 'dairy', 290, 18, 22, 14, 3.5, 2.5, 0, 20, ['en:milk']],
    ['curd', 'Plain curd (dahi)', 'dairy', 61, 3.5, 3.3, 2.1, 4.7, 4.7, 0, 46, ['en:milk']],
    ['milk', 'Whole milk (doodh)', 'dairy', 61, 3.2, 3.3, 1.9, 4.8, 5.1, 0, 43, ['en:milk']],
    ['almonds', 'Almonds (badam)', 'nuts', 579, 21, 50, 3.8, 22, 4.4, 12.5, 1, ['en:nuts']],
    ['peanuts', 'Peanuts (moongfali)', 'nuts', 567, 26, 49, 6.8, 16, 4.7, 8.5, 18, ['en:peanuts']],
    ['coconutwater', 'Coconut water (nariyal pani)', 'drink', 19, 0.7, 0.2, 0.2, 3.7, 2.6, 1.1, 105],
  ];

  SP.FRESH_LIST = ROWS.map(([id, name, group, kcal, protein, fat, sat, carbs, sugar, fibre, sodiumMg, allergens]) => ({
    code: 'fresh-' + id,
    fresh: true,
    approx: true,
    product_name: name,
    brands: 'Typical value · approximate',
    quantity: '',
    group,
    categories_tags: ['en:fresh-foods', 'en:fresh-' + group],
    allergens_tags: allergens || [],
    traces_tags: [],
    ingredients_text: name,
    countries_tags: ['en:india'],
    nutriments: {
      'energy-kcal_100g': kcal, proteins_100g: protein, fat_100g: fat, 'saturated-fat_100g': sat,
      carbohydrates_100g: carbs, sugars_100g: sugar, fiber_100g: fibre, sodium_100g: sodiumMg / 1000,
    },
  }));

  SP.isFresh = (code) => String(code).startsWith('fresh-');
  SP.getFresh = (code) => SP.FRESH_LIST.find((p) => p.code === String(code)) || null;
  SP.searchFresh = (q) => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return SP.FRESH_LIST.filter((p) => words.every((w) => p.product_name.toLowerCase().includes(w)));
  };
})();
