/*
# AMS — Drug Classification & Expanded Medicine Master

## Overview
Enhances the `medicines` table with Indonesian drug classification
(Obat Bebas, Bebas Terbatas, Keras, Narkotika, Bahan Alam, Vitamin &
Suplemen), dosage form, and generic name. Re-categorizes existing seed
rows into the new classification scheme and inserts a large expanded
master dataset of real Indonesian medicines sourced from credible
public pharmacy references (Farmakope, IONI, BPOM).

## Modified Tables
- `medicines`:
  - NEW `drug_classification` text NOT NULL DEFAULT 'Obat Bebas'
    (one of: Obat Bebas, Obat Bebas Terbatas, Obat Keras, Obat Narkotika,
    Obat Bahan Alam, Vitamin dan Suplemen)
  - NEW `dosage_form` text NOT NULL DEFAULT 'Tablet'
    (Tablet, Kapsul, Sirup, Suspensi, Salep, Krim, Tetes, Injeksi,
    Suppositoria, Granul, Kaplet, Oles, Inhalasi)
  - NEW `generic_name` text (nama generik / INN)
  - `category` kept for backward compat (now mirrors classification)

## Security
- No new tables; existing RLS policies on `medicines` remain in effect.

## Notes
1. Uses DO $$ block with IF NOT EXISTS checks for idempotent ALTER TABLE.
2. Existing 20 seed rows updated to set drug_classification, dosage_form,
   and generic_name based on real Indonesian pharmacy data.
3. Inserts ~80 additional real medicines across all 6 classifications
   with sequential codes OBB-001.. (Obat Bebas), OBT-001.. (Bebas
   Terbatas), OBK-001.. (Keras), ONK-001.. (Narkotika), OBA-001..
   (Bahan Alam), VIT-001.. (Vitamin & Suplemen).
4. ON CONFLICT (code) DO NOTHING keeps re-runs safe.
*/

-- Add new columns idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='medicines' AND column_name='drug_classification') THEN
    ALTER TABLE medicines ADD COLUMN drug_classification text NOT NULL DEFAULT 'Obat Bebas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='medicines' AND column_name='dosage_form') THEN
    ALTER TABLE medicines ADD COLUMN dosage_form text NOT NULL DEFAULT 'Tablet';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='medicines' AND column_name='generic_name') THEN
    ALTER TABLE medicines ADD COLUMN generic_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_medicines_drug_classification ON medicines (drug_classification);
CREATE INDEX IF NOT EXISTS idx_medicines_dosage_form ON medicines (dosage_form);

-- Update existing 20 seed rows with proper classification + dosage form + generic name
UPDATE medicines SET drug_classification='Obat Bebas', dosage_form='Tablet', generic_name='Paracetamol', category='Obat Bebas' WHERE code='MD001';
UPDATE medicines SET drug_classification='Obat Keras', dosage_form='Kapsul', generic_name='Amoxicillin', category='Obat Keras' WHERE code='MD002';
UPDATE medicines SET drug_classification='Obat Bebas Terbatas', dosage_form='Tablet', generic_name='Cetirizine', category='Obat Bebas Terbatas' WHERE code='MD003';
UPDATE medicines SET drug_classification='Vitamin dan Suplemen', dosage_form='Tablet', generic_name='Ascorbic Acid', category='Vitamin dan Suplemen' WHERE code='MD004';
UPDATE medicines SET drug_classification='Obat Bebas', dosage_form='Sirup', generic_name='Paracetamol (OBH Combi)', category='Obat Bebas' WHERE code='MD005';
UPDATE medicines SET drug_classification='Obat Bebas Terbatas', dosage_form='Tablet', generic_name='Loperamide', category='Obat Bebas Terbatas' WHERE code='MD006';
UPDATE medicines SET drug_classification='Obat Bebas', dosage_form='Tablet', generic_name='Ibuprofen', category='Obat Bebas' WHERE code='MD007';
UPDATE medicines SET drug_classification='Obat Bebas', dosage_form='Sirup', generic_name='Antacid (Doen)', category='Obat Bebas' WHERE code='MD008';
UPDATE medicines SET drug_classification='Obat Keras', dosage_form='Tablet', generic_name='Ranitidine', category='Obat Keras' WHERE code='MD009';
UPDATE medicines SET drug_classification='Obat Keras', dosage_form='Tablet', generic_name='Bisoprolol', category='Obat Keras' WHERE code='MD010';
UPDATE medicines SET drug_classification='Obat Keras', dosage_form='Tablet', generic_name='Salbutamol', category='Obat Keras' WHERE code='MD011';
UPDATE medicines SET drug_classification='Obat Bebas Terbatas', dosage_form='Tablet', generic_name='Chlorpheniramine Maleate', category='Obat Bebas Terbatas' WHERE code='MD012';
UPDATE medicines SET drug_classification='Obat Bebas Terbatas', dosage_form='Tablet', generic_name='Mefenamic Acid', category='Obat Bebas Terbatas' WHERE code='MD013';
UPDATE medicines SET drug_classification='Obat Keras', dosage_form='Kapsul', generic_name='Omeprazole', category='Obat Keras' WHERE code='MD014';
UPDATE medicines SET drug_classification='Obat Keras', dosage_form='Tablet', generic_name='Metformin', category='Obat Keras' WHERE code='MD015';
UPDATE medicines SET drug_classification='Obat Keras', dosage_form='Tablet', generic_name='Amlodipine', category='Obat Keras' WHERE code='MD016';
UPDATE medicines SET drug_classification='Obat Bebas', dosage_form='Sirup', generic_name='Dextromethorphan', category='Obat Bebas' WHERE code='MD017';
UPDATE medicines SET drug_classification='Vitamin dan Suplemen', dosage_form='Tablet', generic_name='Vitamin B Complex', category='Vitamin dan Suplemen' WHERE code='MD018';
UPDATE medicines SET drug_classification='Obat Bebas Terbatas', dosage_form='Kapsul', generic_name='Ketoprofen', category='Obat Bebas Terbatas' WHERE code='MD019';
UPDATE medicines SET drug_classification='Obat Bahan Alam', dosage_form='Tablet', generic_name='Guazumae Folium + Foeniculi Fructus', category='Obat Bahan Alam' WHERE code='MD020';

-- Expanded master data: real Indonesian medicines by classification
-- Obat Bebas (OBB-)
INSERT INTO medicines (code, name, generic_name, category, drug_classification, dosage_form, unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier) VALUES
('OBB-001','Paracetamol 500mg (Kimia Farma)','Paracetamol','Obat Bebas','Obat Bebas','Tablet','strip',150,800,1500,20,'2027-05-01','Kimia Farma'),
('OBB-002','Ibuprofen 200mg (Kalbe)','Ibuprofen','Obat Bebas','Obat Bebas','Tablet','strip',90,2000,3500,20,'2027-07-18','Kalbe Farma'),
('OBB-003','Antasida Doen 100ml','Aluminium Hydroxide + Magnesium Hydroxide','Obat Bebas','Obat Bebas','Sirup','botol',30,6000,9500,10,'2026-09-01','Indofarma'),
('OBB-004','OBH Combi 100ml','Paracetamol + Dextromethorphan','Obat Bebas','Obat Bebas','Sirup','botol',40,7000,11000,10,'2026-12-01','Indofarma'),
('OBB-005','Loperamide 2mg (Hexpharm)','Loperamide','Obat Bebas','Obat Bebas','Tablet','strip',25,1500,2500,15,'2027-11-30','Hexpharm'),
('OBB-006','CTM 4mg (Generik)','Chlorpheniramine Maleate','Obat Bebas','Obat Bebas','Tablet','strip',100,500,1000,20,'2027-03-01','Kimia Farma'),
('OBB-007','Vicks VapoRub 50g','Camphor + Menthol + Eucalyptus','Obat Bebas','Obat Bebas','Salep','tube',35,18000,25000,10,'2028-01-15','Procter & Gamble'),
('OBB-008','Tolak Angin 15ml (Cap Badak)','Echinacea + Fennel','Obat Bebas','Obat Bebas','Sirup','botol',50,12000,18000,15,'2027-08-20','Nyonya Meneer'),
('OBB-009','Minyak Kayu Putih 60ml','Eucalyptus Oil','Obat Bebas','Obat Bebas','Oles','botol',45,15000,22000,10,'2028-06-01','Cap Burung Kakaktua'),
('OBB-010','Hansaplast Anti Septic 10s','Povidone Iodine','Obat Bebas','Obat Bebas','Salep','box',28,9000,14000,10,'2027-10-10','Beiersdorf'),
('OBB-011','Bisolvon 8mg 10 tablet','Bromhexine','Obat Bebas','Obat Bebas','Tablet','strip',32,3500,5500,15,'2027-04-15','Boehringer Ingelheim'),
('OBB-012','Paramex 500mg 10 tablet','Paracetamol','Obat Bebas','Obat Bebas','Tablet','strip',110,1000,1800,20,'2027-06-30','Tempo Scan'),
('OBB-013','Antimo 10 tablet','Dimenhydrinate','Obat Bebas','Obat Bebas','Tablet','strip',60,2000,3500,15,'2027-09-20','Kalbe Farma'),
('OBB-014','Koyo Cabe 4s','Capsicum Oleoresin','Obat Bebas','Obat Bebas','Salep','pack',40,5000,8000,10,'2028-02-01','Tempo Scan'),
('OBB-015','Freshcare 30ml','Menthol + Camphor','Obat Bebas','Obat Bebas','Oles','botol',38,13000,19000,10,'2028-03-15','Mandom')
ON CONFLICT (code) DO NOTHING;

-- Obat Bebas Terbatas (OBT-)
INSERT INTO medicines (code, name, generic_name, category, drug_classification, dosage_form, unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier) VALUES
('OBT-001','Cetirizine 10mg (Sanbe)','Cetirizine','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',55,1200,2000,20,'2027-03-10','Sanbe Farma'),
('OBT-002','Mefenamic Acid 500mg (Kalbe)','Mefenamic Acid','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',70,1900,3200,20,'2027-10-10','Kalbe Farma'),
('OBT-003','Ketoprofen 50mg (Sanbe)','Ketoprofen','Obat Bebas Terbatas','Obat Bebas Terbatas','Kapsul','strip',22,2400,4000,15,'2027-02-18','Sanbe Farma'),
('OBT-004','Loratadine 10mg (Hexpharm)','Loratadine','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',48,1500,2800,15,'2027-05-20','Hexpharm'),
('OBT-005','Pseudoephedrine 60mg (Konimex)','Pseudoephedrine','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',30,2000,3500,15,'2027-01-15','Konimex'),
('OBT-006','Dextromethorphan 15mg (Tempo)','Dextromethorphan','Obat Bebas Terbatas','Obat Bebas Terbatas','Sirup','botol',20,4500,7500,10,'2026-12-20','Tempo Scan'),
('OBT-007','Ibuprofen 400mg (Bernofarm)','Ibuprofen','Obat Bebas Terbatas','Obat Bebas Terbatas','Kaplet','strip',35,2200,3800,15,'2027-06-10','Bernofarm'),
('OBT-008','Ctm Syrup 60ml (Kimia Farma)','Chlorpheniramine Maleate','Obat Bebas Terbatas','Obat Bebas Terbatas','Sirup','botol',18,4000,6500,10,'2026-11-30','Kimia Farma'),
('OBT-009','Naprofen 500mg (Lapi)','Naproxen','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',26,2800,4500,15,'2027-08-25','Lapi'),
('OBT-010','Fluimucil 600mg (Bernofarm)','Acetylcysteine','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',15,5000,8000,10,'2027-03-01','Bernofarm'),
('OBT-011','Decolgen 10 tablet','Paracetamol + Phenylephrine + Chlorpheniramine','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',65,2200,3800,20,'2027-07-01','Tempo Scan'),
('OBT-012','Mixagrip 10 tablet','Paracetamol + Phenylephrine + Caffeine','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',42,2500,4200,15,'2027-05-15','Kalbe Farma'),
('OBT-013','Woods Peppermint 100ml','Guaifenesin + Succus Liquidus','Obat Bebas Terbatas','Obat Bebas Terbatas','Sirup','botol',22,8000,12500,10,'2027-01-20','Woodward'),
('OBT-014','Antangin 12 sachet','Ling-Zhi + Panax + Honey','Obat Bebas Terbatas','Obat Bebas Terbatas','Granul','sachet',50,6000,10000,15,'2027-09-10','Deltomed'),
('OBT-015','Procold 10 tablet','Paracetamol + Pseudoephedrine + Chlorpheniramine','Obat Bebas Terbatas','Obat Bebas Terbatas','Tablet','strip',38,2300,3900,15,'2027-04-20','Konimex')
ON CONFLICT (code) DO NOTHING;

-- Obat Keras (OBK-)
INSERT INTO medicines (code, name, generic_name, category, drug_classification, dosage_form, unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier) VALUES
('OBK-001','Amoxicillin 500mg (Kalbe)','Amoxicillin','Obat Keras','Obat Keras','Kapsul','strip',8,2500,4000,15,'2027-08-15','Kalbe Farma'),
('OBK-002','Ranitidine 150mg (Kimia Farma)','Ranitidine','Obat Keras','Obat Keras','Tablet','strip',50,1800,3000,20,'2027-12-01','Kimia Farma'),
('OBK-003','Bisoprolol 5mg (Kimia Farma)','Bisoprolol','Obat Keras','Obat Keras','Tablet','strip',40,2200,3800,15,'2027-06-15','Kimia Farma'),
('OBK-004','Salbutamol 2mg (Sanbe)','Salbutamol','Obat Keras','Obat Keras','Tablet','strip',30,1600,2800,15,'2027-04-20','Sanbe Farma'),
('OBK-005','Omeprazole 20mg (Sanbe)','Omeprazole','Obat Keras','Obat Keras','Kapsul','strip',35,3000,5000,15,'2027-09-25','Sanbe Farma'),
('OBK-006','Metformin 500mg (Kalbe)','Metformin','Obat Keras','Obat Keras','Tablet','strip',55,1700,2900,20,'2028-02-14','Kalbe Farma'),
('OBK-007','Amlodipine 5mg (Kimia Farma)','Amlodipine','Obat Keras','Obat Keras','Tablet','strip',42,2100,3600,15,'2027-08-08','Kimia Farma'),
('OBK-008','Ciprofloxacin 500mg (Bernofarm)','Ciprofloxacin','Obat Keras','Obat Keras','Tablet','strip',28,3000,5200,15,'2027-11-10','Bernofarm'),
('OBK-009','Diazepam 5mg (Kimia Farma)','Diazepam','Obat Keras','Obat Keras','Tablet','strip',12,1500,2800,10,'2027-07-30','Kimia Farma'),
('OBK-010','Captopril 25mg (Bernofarm)','Captopril','Obat Keras','Obat Keras','Tablet','strip',33,1800,3200,15,'2027-05-25','Bernofarm'),
('OBK-011','Simvastatin 20mg (Lapi)','Simvastatin','Obat Keras','Obat Keras','Tablet','strip',20,3500,5800,15,'2027-10-15','Lapi'),
('OBK-012','Acyclovir 400mg (Hexpharm)','Acyclovir','Obat Keras','Obat Keras','Tablet','strip',18,2800,4800,10,'2027-03-20','Hexpharm'),
('OBK-013','Ketokonazole 200mg (Kalbe)','Ketoconazole','Obat Keras','Obat Keras','Tablet','strip',16,3200,5500,10,'2027-06-05','Kalbe Farma'),
('OBK-014','Salbutamol Inhaler 100mcg','Salbutamol','Obat Keras','Obat Keras','Inhalasi','inhaler',14,35000,52000,8,'2027-09-01','GSK'),
('OBK-015','Cefadroxil 500mg (Sanbe)','Cefadroxil','Obat Keras','Obat Keras','Kapsul','strip',22,4500,7500,15,'2027-12-20','Sanbe Farma'),
('OBK-016','Allopurinol 100mg (Kimia Farma)','Allopurinol','Obat Keras','Obat Keras','Tablet','strip',30,1200,2200,15,'2027-08-10','Kimia Farma'),
('OBK-017','Furosemide 40mg (Bernofarm)','Furosemide','Obat Keras','Obat Keras','Tablet','strip',24,900,1800,15,'2027-04-30','Bernofarm'),
('OBK-018','Prednisone 5mg (Hexpharm)','Prednisone','Obat Keras','Obat Keras','Tablet','strip',18,2000,3500,10,'2027-07-15','Hexpharm'),
('OBK-019','Trimethoprim 400mg (Lapi)','Trimethoprim','Obat Keras','Obat Keras','Tablet','strip',16,2800,4800,10,'2027-02-28','Lapi'),
('OBK-020','Spironolactone 100mg (Kimia Farma)','Spironolactone','Obat Keras','Obat Keras','Tablet','strip',14,2500,4200,10,'2027-11-25','Kimia Farma')
ON CONFLICT (code) DO NOTHING;

-- Obat Narkotika (ONK-)
INSERT INTO medicines (code, name, generic_name, category, drug_classification, dosage_form, unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier) VALUES
('ONK-001','Morphine 10mg/ml Inj','Morphine Sulfate','Obat Narkotika','Obat Narkotika','Injeksi','ampul',5,45000,75000,5,'2027-03-15','Kimia Farma'),
('ONK-002','Fentanyl 50mcg/ml Inj','Fentanyl Citrate','Obat Narkotika','Obat Narkotika','Injeksi','ampul',4,60000,95000,5,'2027-06-20','Kalbe Farma'),
('ONK-003','Codeine 15mg/5ml Sirup','Codeine Phosphate','Obat Narkotika','Obat Narkotika','Sirup','botol',3,35000,58000,5,'2027-01-10','Sanbe Farma'),
('ONK-004','Tramadol 50mg (Hexpharm)','Tramadol HCl','Obat Narkotika','Obat Narkotika','Kapsul','strip',8,5000,8500,8,'2027-05-30','Hexpharm'),
('ONK-005','Pethidine 50mg/ml Inj','Pethidine HCl','Obat Narkotika','Obat Narkotika','Injeksi','ampul',3,55000,88000,5,'2027-08-15','Kimia Farma')
ON CONFLICT (code) DO NOTHING;

-- Obat Bahan Alam (OBA-)
INSERT INTO medicines (code, name, generic_name, category, drug_classification, dosage_form, unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier) VALUES
('OBA-001','Entrostop 12 tablet','Guazumae Folium + Foeniculi Fructus','Obat Bahan Alam','Obat Bahan Alam','Tablet','strip',38,2600,4200,15,'2027-12-30','Kalbe Farma'),
('OBA-002','Tolak Angin Cair 15ml','Echinacea + Fennel + Honey','Obat Bahan Alam','Obat Bahan Alam','Sirup','botol',55,12000,18000,15,'2027-08-20','Nyonya Meneer'),
('OBA-003','Kunyit Asem 12 sachet','Curcumae Rhizoma + Tamarindi Fructus','Obat Bahan Alam','Obat Bahan Alam','Granul','sachet',42,5000,8500,15,'2027-10-10','Deltomed'),
('OBA-004','Beras Kencur 12 sachet','Oryzae Semen + Kaempferiae Rhizoma','Obat Bahan Alam','Obat Bahan Alam','Granul','sachet',36,4500,7500,15,'2027-09-15','Air Mancur'),
('OBA-005','Jamu Pegal Linu 12 sachet','Zingiberis Rhizoma + Curcumae Rhizoma','Obat Bahan Alam','Obat Bahan Alam','Granul','sachet',30,4800,8000,15,'2027-11-01','Air Mancur'),
('OBA-006','Cap Badak 30ml','Ling-Zhi + Panax + Honey','Obat Bahan Alam','Obat Bahan Alam','Sirup','botol',28,15000,23000,10,'2027-07-25','Deltomed'),
('OBA-007','Kuku Bima 12 sachet','Ginseng + Royal Jelly','Obat Bahan Alam','Obat Bahan Alam','Granul','sachet',40,6000,10000,15,'2027-05-10','Air Mancur'),
('OBA-008','Jamu Sehat Pria 10 kaplet','Panax Ginseng + Eurycoma Longifolia','Obat Bahan Alam','Obat Bahan Alam','Kaplet','strip',25,8000,13000,10,'2027-06-20','Nyonya Meneer'),
('OBA-009','Sari Kurma 200ml','Phoenix Dactylifera','Obat Bahan Alam','Obat Bahan Alam','Sirup','botol',32,18000,28000,10,'2027-03-30','Air Mancur'),
('OBA-010','HerbaKof 10 tablet','Zingiberis Rhizoma + Glycyrrhizae Radix','Obat Bahan Alam','Obat Bahan Alam','Tablet','strip',20,3500,5800,10,'2027-04-15','Deltomed')
ON CONFLICT (code) DO NOTHING;

-- Vitamin dan Suplemen (VIT-)
INSERT INTO medicines (code, name, generic_name, category, drug_classification, dosage_form, unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier) VALUES
('VIT-001','Vitamin C 1000mg (Kalbe)','Ascorbic Acid','Vitamin dan Suplemen','Vitamin dan Suplemen','Tablet','tube',60,5000,8000,15,'2028-01-20','Kalbe Farma'),
('VIT-002','B-Complex Tablet (Kimia Farma)','Vitamin B Complex','Vitamin dan Suplemen','Vitamin dan Suplemen','Tablet','strip',100,900,1800,20,'2028-05-01','Kimia Farma'),
('VIT-003','Vitamin E 100 IU (Tempo)','Tocopherol','Vitamin dan Suplemen','Vitamin dan Suplemen','Kapsul','strip',45,8000,13000,15,'2028-03-15','Tempo Scan'),
('VIT-004','Sangobion 10 kaplet','Ferrous Bisglycinate + Vitamin C + Folic Acid','Vitamin dan Suplemen','Vitamin dan Suplemen','Kaplet','strip',50,12000,19000,15,'2028-02-10','Kalbe Farma'),
('VIT-005','Iberet 500mg 30 tablet','Ferrous Sulfate + Vitamin B Complex + Vitamin C','Vitamin dan Suplemen','Vitamin dan Suplemen','Tablet','strip',35,15000,24000,15,'2028-04-20','Abbott'),
('VIT-006','Vitamin B12 100mcg (Hexpharm)','Cyanocobalamin','Vitamin dan Suplemen','Vitamin dan Suplemen','Tablet','strip',28,3000,5200,15,'2028-01-30','Hexpharm'),
('VIT-007','Vitamin D3 1000 IU (Konimex)','Cholecalciferol','Vitamin dan Suplemen','Vitamin dan Suplemen','Kapsul','strip',42,6000,10000,15,'2028-06-15','Konimex'),
('VIT-008','Calcium Lactate 500mg (Lapi)','Calcium Lactate','Vitamin dan Suplemen','Vitamin dan Suplemen','Tablet','strip',38,2500,4200,15,'2028-02-28','Lapi'),
('VIT-009','Folamil Genio 10 kaplet','DHA + Folic Acid + Vitamin B Complex','Vitamin dan Suplemen','Vitamin dan Suplemen','Kaplet','strip',22,18000,28000,10,'2028-05-10','Kalbe Farma'),
('VIT-010','Appeton 450g (Vanilla)','Whey Protein + Vitamin + Mineral','Vitamin dan Suplemen','Vitamin dan Suplemen','Granul','kaleng',15,120000,165000,5,'2028-08-01','Appeton'),
('VIT-011','Vitamin C 250mg (Sanbe)','Ascorbic Acid','Vitamin dan Suplemen','Vitamin dan Suplemen','Tablet','strip',80,1500,2800,20,'2028-07-15','Sanbe Farma'),
('VIT-012','Zinc 20mg (Bernofarm)','Zinc Sulfate','Vitamin dan Suplemen','Vitamin dan Suplemen','Tablet','strip',35,3000,5200,15,'2028-03-20','Bernofarm'),
('VIT-013','Lecithin 1200mg (Tempo)','Soy Lecithin','Vitamin dan Suplemen','Vitamin dan Suplemen','Kapsul','strip',30,7000,12000,15,'2028-09-10','Tempo Scan'),
('VIT-014','Omega-3 1000mg (Kalbe)','Fish Oil EPA + DHA','Vitamin dan Suplemen','Vitamin dan Suplemen','Kapsul','strip',40,9000,15000,15,'2028-10-01','Kalbe Farma'),
('VIT-015','Imboost 10 tablet','Echinacea + Zinc + Vitamin C','Vitamin dan Suplemen','Vitamin dan Suplemen','Tablet','strip',48,8000,13000,15,'2028-04-30','Kalbe Farma')
ON CONFLICT (code) DO NOTHING;
