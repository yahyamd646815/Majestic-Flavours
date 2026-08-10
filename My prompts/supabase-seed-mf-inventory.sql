-- ============================================================
-- Majestic Flavours — real inventory seed
-- Source: Mf_everyday_inventory (5).pdf, provided by Yahya's dad
-- 13 categories, 144 items. Every item starts at quantity 0 —
-- deliberately, so the first real inventory count happens through
-- an actual submitted report, not a guessed starting number (this
-- is the same principle behind the separate pre-launch cleanup task)
--
-- Two things this script had to guess, because the source PDF is a
-- blank checklist template with no unit or threshold data at all:
--   1. Unit is assigned per CATEGORY (e.g. all Meat items -> Kg),
--      not researched per item. Review and correct individual items
--      via the Inventory screen's edit form after this runs.
--   2. min_threshold is 0 for everything — a safe "never falsely
--      alert" default, not a real threshold. Set real thresholds
--      per item the same way, whenever convenient.
--
-- One spelling fix: the source PDF has "Grocerries" (a typo, unlike
-- the correctly-spelled "Rice"/"Dairy" elsewhere in the same doc) —
-- corrected to "Groceries" here. Every other item name is verbatim.
--
-- Idempotent: units and categories are only inserted if a row with
-- that exact label/name doesn't already exist, so this is safe to
-- run even if some of these already exist in your live database.
-- Items are NOT deduped this way (items have no natural unique key)
-- — only run the item-insert section once.
-- ============================================================

-- ---------- 1. Units (idempotent) ----------
insert into units (id, label)
  select 'unit-kg', 'Kg'
  where not exists (select 1 from units where label = 'Kg');
insert into units (id, label)
  select 'unit-ltr', 'Ltr'
  where not exists (select 1 from units where label = 'Ltr');
insert into units (id, label)
  select 'unit-pcs', 'Pcs'
  where not exists (select 1 from units where label = 'Pcs');

-- ---------- 2. Categories (idempotent) ----------
insert into categories (id, name)
  select 'category-meat-poultry-sea-food', 'Meat, Poultry & Sea food'
  where not exists (select 1 from categories where name = 'Meat, Poultry & Sea food');
insert into categories (id, name)
  select 'category-vegetables', 'Vegetables'
  where not exists (select 1 from categories where name = 'Vegetables');
insert into categories (id, name)
  select 'category-lentils', 'Lentils'
  where not exists (select 1 from categories where name = 'Lentils');
insert into categories (id, name)
  select 'category-rice', 'Rice'
  where not exists (select 1 from categories where name = 'Rice');
insert into categories (id, name)
  select 'category-dairy', 'Dairy'
  where not exists (select 1 from categories where name = 'Dairy');
insert into categories (id, name)
  select 'category-groceries', 'Groceries'
  where not exists (select 1 from categories where name = 'Groceries');
insert into categories (id, name)
  select 'category-ready-made', 'Ready Made'
  where not exists (select 1 from categories where name = 'Ready Made');
insert into categories (id, name)
  select 'category-sweets', 'Sweets'
  where not exists (select 1 from categories where name = 'Sweets');
insert into categories (id, name)
  select 'category-biscuits', 'Biscuits'
  where not exists (select 1 from categories where name = 'Biscuits');
insert into categories (id, name)
  select 'category-ppe', 'PPE'
  where not exists (select 1 from categories where name = 'PPE');
insert into categories (id, name)
  select 'category-stationary-supplies', 'Stationary Supplies'
  where not exists (select 1 from categories where name = 'Stationary Supplies');
insert into categories (id, name)
  select 'category-cleaning', 'Cleaning'
  where not exists (select 1 from categories where name = 'Cleaning');
insert into categories (id, name)
  select 'category-disposables', 'Disposables'
  where not exists (select 1 from categories where name = 'Disposables');

-- ---------- 3. Items (run once — no dedup) ----------
-- category_id / unit_id resolved by name/label via subquery, not hardcoded —
-- so this still works even if the idempotent inserts above matched an
-- existing row with a different id than the one generated here.

-- Meat, Poultry & Sea food (11 items, unit: Kg)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mutton-small-pcs',
  'Mutton Small Pcs',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mutton-big-pcs',
  'Mutton Big Pcs',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mutton-bone-marrow',
  'Mutton Bone Marrow',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mutton-paya',
  'Mutton Paya',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-beef-small-pcs',
  'Beef Small Pcs',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-beef-big-pcs',
  'Beef Big Pcs',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-beef-bone-marrow',
  'Beef Bone Marrow',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-chicken-900gm',
  'Chicken 900Gm',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-chicken-1000gm',
  'Chicken 1000Gm',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-chicken-1100gm',
  'Chicken 1100Gm',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-chicken-1200gm',
  'Chicken 1200gm',
  (select id from categories where name = 'Meat, Poultry & Sea food'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);

-- Vegetables (19 items, unit: Kg)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mix-sabzi-frozen',
  'Mix Sabzi (Frozen)',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mutter-frozen',
  'Mutter (Frozen)',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-spinach-palak',
  'Spinach/Palak',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-potato-aloo',
  'Potato/Aloo',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-onions',
  'Onions',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tomato',
  'Tomato',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-carrot',
  'Carrot',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-cucumber',
  'Cucumber',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-cauli-flower',
  'Cauli Flower',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-cabbage',
  'Cabbage',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-lemon',
  'Lemon',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-kaddu',
  'Kaddu',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-ginger',
  'Ginger',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-garlic',
  'Garlic',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-kari-patta',
  'Kari Patta',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-pudinah-mint',
  'Pudinah/Mint',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-hari-mirch-green-chilli',
  'Hari Mirch/Green chilli',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-corriander-kuthmeer',
  'Corriander/Kuthmeer',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-corn',
  'Corn',
  (select id from categories where name = 'Vegetables'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);

-- Lentils (5 items, unit: Kg)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-white-chana',
  'White Chana',
  (select id from categories where name = 'Lentils'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-daal-chana',
  'Daal Chana',
  (select id from categories where name = 'Lentils'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mash',
  'Mash',
  (select id from categories where name = 'Lentils'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-chana-powder-basen',
  'Chana Powder/Basen',
  (select id from categories where name = 'Lentils'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-lobiah',
  'Lobiah',
  (select id from categories where name = 'Lentils'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);

-- Rice (2 items, unit: Kg)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-basmati-kernal',
  'Basmati Kernal',
  (select id from categories where name = 'Rice'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-sella',
  'Sella',
  (select id from categories where name = 'Rice'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);

-- Dairy (6 items, unit: Ltr)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-milk',
  'Milk',
  (select id from categories where name = 'Dairy'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-dahi',
  'Dahi',
  (select id from categories where name = 'Dairy'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-luna-milk',
  'Luna Milk',
  (select id from categories where name = 'Dairy'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-butter',
  'Butter',
  (select id from categories where name = 'Dairy'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-cooking-cream',
  'Cooking Cream',
  (select id from categories where name = 'Dairy'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-eggs',
  'Eggs',
  (select id from categories where name = 'Dairy'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);

-- Groceries (33 items, unit: Kg)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-sugar',
  'Sugar',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-patti-whole',
  'Patti Whole',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-patti-tea-bag',
  'Patti Tea Bag',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-oil',
  'Oil',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-ghee',
  'Ghee',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-salt',
  'Salt',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-chinease-salt',
  'Chinease Salt',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-maggi-stocks',
  'Maggi Stocks',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-red-chilli-powder',
  'Red cHilli Powder',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-crushed-chilli',
  'Crushed Chilli',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-black-pepper',
  'Black Pepper',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-white-pepper',
  'White Pepper',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-biryani-masala',
  'Biryani Masala',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-korma-masala',
  'Korma Masala',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-paya-masala',
  'Paya Masala',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-kasturi-methi',
  'Kasturi Methi',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-haldi',
  'Haldi',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-coriander-whole',
  'Coriander Whole',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-white-zerra',
  'White Zerra',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tez-patta',
  'Tez Patta',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-sabza-ilaichi-cardoman',
  'Sabza Ilaichi/Cardoman',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-black-cardoman',
  'Black Cardoman',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-dalchini-cinomaon',
  'Dalchini/Cinomaon',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-long',
  'Long',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-badiyane-khatai',
  'Badiyane Khatai',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-foof-color-red-green-yellow',
  'Foof Color(Red,Green ,Yellow)',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-jaifal',
  'Jaifal',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-curry-powder',
  'Curry Powder',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-ketchep',
  'Ketchep',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-chiili-garlic-paste-red',
  'Chiili Garlic Paste (Red)',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-chiili-garlic-paste-green',
  'Chiili Garlic Paste (Green)',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-small-table-red-chilli-garlic',
  'Small Table Red Chilli Garlic',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-samosa-patty',
  'Samosa Patty',
  (select id from categories where name = 'Groceries'),
  0,
  (select id from units where label = 'Kg'),
  0,
  '{}'
);

-- Ready Made (16 items, unit: Pcs)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-water-gallon',
  'Water Gallon',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-water-btls-1-sr',
  'Water Btls -1 Sr',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-water-btls-2-sr',
  'Water Btls -2 Sr',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-kinza-cola',
  'Kinza Cola',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-kinza-citrus',
  'Kinza Citrus',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-kinza-lemon',
  'Kinza Lemon',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-kinza-diet-cola',
  'Kinza Diet Cola',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-kinza-diet-lemon',
  'Kinza Diet Lemon',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-pepsi',
  'Pepsi',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mirinda-citrus',
  'Mirinda Citrus',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mirinda-orange',
  'Mirinda Orange',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-7up',
  '7Up',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-pepsi-med',
  'Pepsi Med',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mirinda-citrus-med',
  'Mirinda Citrus Med',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-mirinda-orange-med',
  'Mirinda Orange Med',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-7up-med',
  '7Up Med',
  (select id from categories where name = 'Ready Made'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);

-- Sweets (6 items, unit: Pcs)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-gulab-jamun',
  'Gulab Jamun',
  (select id from categories where name = 'Sweets'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-rasmalai',
  'Rasmalai',
  (select id from categories where name = 'Sweets'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-jelebi',
  'Jelebi',
  (select id from categories where name = 'Sweets'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-cake',
  'Cake',
  (select id from categories where name = 'Sweets'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-qubani-ka-metha',
  'Qubani ka Metha',
  (select id from categories where name = 'Sweets'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-vanila-ice-cream',
  'Vanila Ice Cream',
  (select id from categories where name = 'Sweets'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);

-- Biscuits (3 items, unit: Pcs)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-fine',
  'Fine',
  (select id from categories where name = 'Biscuits'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-osmania',
  'Osmania',
  (select id from categories where name = 'Biscuits'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-zeera',
  'Zeera',
  (select id from categories where name = 'Biscuits'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);

-- PPE (3 items, unit: Pcs)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-face-mask',
  'Face Mask',
  (select id from categories where name = 'PPE'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-hair-cover',
  'Hair Cover',
  (select id from categories where name = 'PPE'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-gloves',
  'Gloves',
  (select id from categories where name = 'PPE'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);

-- Stationary Supplies (6 items, unit: Pcs)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-expiry-roll',
  'Expiry Roll',
  (select id from categories where name = 'Stationary Supplies'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-shabaka-roll',
  'Shabaka Roll',
  (select id from categories where name = 'Stationary Supplies'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-invoice-booklet',
  'Invoice Booklet',
  (select id from categories where name = 'Stationary Supplies'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-pen',
  'Pen',
  (select id from categories where name = 'Stationary Supplies'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-marker',
  'Marker',
  (select id from categories where name = 'Stationary Supplies'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-stapler-pin',
  'Stapler Pin',
  (select id from categories where name = 'Stationary Supplies'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);

-- Cleaning (6 items, unit: Ltr)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-fairy-utensils-wash',
  'Fairy Utensils Wash',
  (select id from categories where name = 'Cleaning'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-floor-wash',
  'Floor Wash',
  (select id from categories where name = 'Cleaning'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-clothes-wash-powder',
  'Clothes Wash Powder',
  (select id from categories where name = 'Cleaning'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-hand-wash',
  'Hand Wash',
  (select id from categories where name = 'Cleaning'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-bleach',
  'Bleach',
  (select id from categories where name = 'Cleaning'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-glass-cleaner',
  'Glass Cleaner',
  (select id from categories where name = 'Cleaning'),
  0,
  (select id from units where label = 'Ltr'),
  0,
  '{}'
);

-- Disposables (28 items, unit: Pcs)
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tea-cups',
  'Tea Cups',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tea-cups-small-attach',
  'Tea Cups small -Attach',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tea-wooden-stir',
  'Tea Wooden stir',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tea-cups-cap',
  'Tea Cups Cap',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-water-cups',
  'Water Cups',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-rice-disposables-samll',
  'Rice Disposables Samll',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-rice-disposables-med',
  'Rice Disposables Med',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-rice-dispsbl-med-pulau',
  'Rice Dispsbl Med Pulau',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-rice-disposables-large',
  'Rice Disposables Large',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-curry-disposables-single',
  'Curry Disposables Single',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-curry-disposables-full',
  'Curry Disposables Full',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-curry-disposables-large',
  'Curry Disposables Large',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-raita-parcel-container',
  'Raita Parcel Container',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-samosa-parcels',
  'Samosa Parcels',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-salad-kees',
  'Salad Kees',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-clear-sweets-container',
  'Clear Sweets Container',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-wrapping-plastic',
  'Wrapping Plastic',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-aluminiums-wrap',
  'Aluminiums Wrap',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tissues-paper-tables',
  'Tissues Paper Tables',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tissues-paper-kitchen',
  'Tissues Paper Kitchen',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-tissues-paper-wash-basin',
  'Tissues Paper Wash basin',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-sufra',
  'Sufra',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-spoon',
  'Spoon',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-balidiya-kees-60-kg',
  'Balidiya Kees 60 Kg',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-balidiya-kees-50-kg',
  'Balidiya kees 50 Kg',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-small-blue-kees',
  'Small Blue Kees',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-med-blue-kees',
  'Med Blue Kees',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
insert into inventory_items (id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids)
values (
  'item-large-yellow-kees',
  'Large Yellow Kees',
  (select id from categories where name = 'Disposables'),
  0,
  (select id from units where label = 'Pcs'),
  0,
  '{}'
);
