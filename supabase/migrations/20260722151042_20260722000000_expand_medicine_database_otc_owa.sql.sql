-- Expand medicine database with OTC and OWA products
-- Source: Permenkes OWA lists + common OTC products sold in Indonesian pharmacies
-- Only inserting products NOT already in the database (checked against existing names)

INSERT INTO medicines (code, name, category, unit, stock, cost_price, sell_price, reorder_point, expiry_date, supplier, drug_classification, dosage_form, generic_name)
VALUES
-- OWA - Analgesik/Antipiretik
('OWA-001', 'Aspirin 500mg (Bayer)', 'Analgesik', 'tablet', 50, 350, 500, 15, '2027-06-30', 'Anugerah Pharmindo', 'Obat Bebas', 'Tablet', 'Aspirin'),
('OWA-002', 'Ibuprofen Sirup 100mg/5ml (Kalbe)', 'Analgesik', 'botol', 20, 8500, 11000, 8, '2027-03-15', 'Kalbe Farma', 'Obat Bebas', 'Sirup', 'Ibuprofen'),
('OWA-003', 'Asam Mefenamat 500mg Sirup (Kalbe)', 'Analgesik', 'botol', 15, 12000, 15000, 6, '2027-01-20', 'Kalbe Farma', 'Obat Wajib Apotek', 'Sirup', 'Mefenamic Acid'),
('OWA-004', 'Metampiron + Diazepam (Sanbe)', 'Analgesik', 'tablet', 30, 1200, 1800, 10, '2027-08-10', 'Sanbe Farma', 'Obat Wajib Apotek', 'Tablet', 'Metampiron'),
-- OWA - Antihistamin
('OWA-005', 'Mebhidrolin 50mg (Kalbe)', 'Antihistamin', 'tablet', 40, 800, 1200, 12, '2027-05-30', 'Kalbe Farma', 'Obat Wajib Apotek', 'Tablet', 'Mebhydrolin'),
('OWA-006', 'Dexchlorpheniramine Maleat 2mg (Hexpharm)', 'Antihistamin', 'tablet', 35, 500, 800, 10, '2027-04-15', 'Hexpharm', 'Obat Wajib Apotek', 'Tablet', 'Dexchlorpheniramine'),
-- OWA - Antiparasit
('OWA-007', 'Mebendazol 500mg (Bernofarm)', 'Antiparasit', 'tablet', 25, 1500, 2000, 8, '2027-07-20', 'Bernofarm', 'Obat Bebas', 'Tablet', 'Mebendazole'),
('OWA-008', 'Albendazol 400mg (Kalbe)', 'Antiparasit', 'tablet', 30, 1800, 2500, 10, '2027-09-10', 'Kalbe Farma', 'Obat Bebas', 'Tablet', 'Albendazole'),
-- OWA - Obat Kulit Topikal
('OWA-009', 'Nistatin Krim (Kalbe)', 'Dermatologi', 'tube', 25, 5000, 7000, 8, '2027-02-28', 'Kalbe Farma', 'Obat Wajib Apotek', 'Krim', 'Nystatin'),
('OWA-010', 'Desoksimetason Krim (Sanbe)', 'Dermatologi', 'tube', 20, 6000, 8500, 8, '2027-03-20', 'Sanbe Farma', 'Obat Wajib Apotek', 'Krim', 'Desoximetasone'),
('OWA-011', 'Betametason Krim (Bernofarm)', 'Dermatologi', 'tube', 20, 5500, 8000, 8, '2027-04-10', 'Bernofarm', 'Obat Wajib Apotek', 'Krim', 'Betamethasone'),
('OWA-012', 'Triamsinolon Krim (Hexpharm)', 'Dermatologi', 'tube', 15, 6500, 9000, 6, '2027-05-15', 'Hexpharm', 'Obat Wajib Apotek', 'Krim', 'Triamcinolone'),
('OWA-013', 'Hidrokortison Krim 1% (Kimia Farma)', 'Dermatologi', 'tube', 25, 4500, 6500, 8, '2027-06-20', 'Kimia Farma', 'Obat Wajib Apotek', 'Krim', 'Hydrocortisone'),
('OWA-014', 'Kloramfenikol Krim 2% (Sanbe)', 'Dermatologi', 'tube', 15, 4000, 6000, 6, '2027-03-30', 'Sanbe Farma', 'Obat Wajib Apotek', 'Krim', 'Chloramphenicol'),
('OWA-015', 'Gentamisin Krim (Bernofarm)', 'Dermatologi', 'tube', 20, 5000, 7500, 8, '2027-07-05', 'Bernofarm', 'Obat Wajib Apotek', 'Krim', 'Gentamicin'),
('OWA-016', 'Eritromisin Topikal (Kalbe)', 'Dermatologi', 'tube', 15, 7000, 9500, 6, '2027-08-15', 'Kalbe Farma', 'Obat Wajib Apotek', 'Krim', 'Erythromycin'),
-- OWA - Mukolitik
('OWA-017', 'Bromheksin 8mg (Sanbe)', 'Respirologi', 'tablet', 40, 1500, 2200, 12, '2027-04-25', 'Sanbe Farma', 'Obat Wajib Apotek', 'Tablet', 'Bromhexine'),
('OWA-018', 'Karbosistein 375mg (Bernofarm)', 'Respirologi', 'kapsul', 30, 2000, 2800, 10, '2027-05-10', 'Bernofarm', 'Obat Wajib Apotek', 'Kapsul', 'Carbocisteine'),
('OWA-019', 'Asetilsistein 600mg (Hexpharm)', 'Respirologi', 'tablet', 25, 3500, 5000, 8, '2027-06-15', 'Hexpharm', 'Obat Wajib Apotek', 'Tablet', 'Acetylcysteine'),
-- OWA - Antasida/Lambung
('OWA-020', 'Antasida Suspensi 200ml (Kimia Farma)', 'Gastroenterologi', 'botol', 20, 8000, 11000, 8, '2027-01-15', 'Kimia Farma', 'Obat Bebas', 'Suspensi', 'Antacida'),
('OWA-021', 'Sucralfate Suspensi 200ml (Sanbe)', 'Gastroenterologi', 'botol', 15, 15000, 20000, 6, '2027-03-10', 'Sanbe Farma', 'Obat Wajib Apotek', 'Suspensi', 'Sucralfate'),
-- OWA - Antiemetik
('OWA-022', 'Domperidone 10mg (Kalbe)', 'Gastroenterologi', 'tablet', 30, 2000, 3000, 10, '2027-07-20', 'Kalbe Farma', 'Obat Wajib Apotek', 'Tablet', 'Domperidone'),
-- OWA - Obat Mata
('OWA-023', 'Tetes Mata Chloramphenicol 0.5% (Bernofarm)', 'Oftalmologi', 'botol', 20, 6000, 8500, 8, '2027-02-20', 'Bernofarm', 'Obat Bebas', 'Tetes Mata', 'Chloramphenicol'),
('OWA-024', 'Tetes Mata Sodium Chlorida 0.9% (Kimia Farma)', 'Oftalmologi', 'botol', 25, 4000, 6000, 8, '2027-05-30', 'Kimia Farma', 'Obat Bebas', 'Tetes Mata', 'Sodium Chloride'),
-- OTC - Obat Bebas Populer
('OTC-001', 'Panadol Extra 10 kaplet (GSK)', 'Analgesik', 'kaplet', 50, 4500, 6000, 15, '2027-10-30', 'Anugerah Pharmindo', 'Obat Bebas', 'Kaplet', 'Paracetamol+Caffeine'),
('OTC-002', 'Hansaplast 20 strip (Beiersdorf)', 'Pertolongan Pertama', 'box', 30, 8000, 12000, 10, '2028-01-15', 'Anugerah Pharmindo', 'Obat Bebas', 'Plester', 'Plester'),
('OTC-003', 'Betadine 10% 30ml (Mundipharma)', 'Antiseptik', 'botol', 35, 12000, 16000, 12, '2027-09-20', 'Anugerah Pharmindo', 'Obat Bebas', 'Solusi', 'Povidone Iodine'),
('OTC-004', 'Betadine 10% 100ml (Mundipharma)', 'Antiseptik', 'botol', 20, 25000, 32000, 8, '2027-09-20', 'Anugerah Pharmindo', 'Obat Bebas', 'Solusi', 'Povidone Iodine'),
('OTC-005', 'Hansaplast Spray 50ml (Beiersdorf)', 'Pertolongan Pertama', 'botol', 20, 35000, 45000, 8, '2028-02-10', 'Anugerah Pharmindo', 'Obat Bebas', 'Spray', 'Plester Cair'),
('OTC-006', 'Kompres Instan Hot/Cold (Hansaplast)', 'Pertolongan Pertama', 'pcs', 25, 15000, 22000, 10, '2028-06-30', 'Anugerah Pharmindo', 'Obat Bebas', 'Kompres', 'Kompres'),
-- OTC - Vitamin & Suplemen
('OTC-007', 'Enervon C 10 tablet (Kalbe)', 'Vitamin', 'tablet', 40, 8000, 11000, 12, '2027-11-15', 'Kalbe Farma', 'Obat Bebas', 'Tablet', 'Vitamin C+B Complex'),
('OTC-008', 'Supradyn 10 tablet (Bayer)', 'Vitamin', 'tablet', 30, 12000, 16000, 10, '2027-08-20', 'Anugerah Pharmindo', 'Obat Bebas', 'Tablet', 'Multivitamin'),
('OTC-009', 'Bebelac FL 400g (Kalbe)', 'Vitamin', 'kaleng', 15, 55000, 70000, 6, '2027-04-30', 'Kalbe Farma', 'Obat Bebas', 'Bubuk', 'Formula Bayi'),
('OTC-010', 'Sangobion Plus 10 kaplet (Kalbe)', 'Vitamin', 'kaplet', 30, 11000, 15000, 10, '2027-07-10', 'Kalbe Farma', 'Obat Bebas', 'Kaplet', 'Iron+Folic Acid'),
('OTC-011', 'Neurobion 10 tablet (Merck)', 'Vitamin', 'tablet', 35, 18000, 24000, 12, '2027-10-10', 'Anugerah Pharmindo', 'Obat Bebas', 'Tablet', 'Vitamin B1+B6+B12'),
('OTC-012', 'Redoxon 10 tablet (Bayer)', 'Vitamin', 'tablet', 30, 14000, 19000, 10, '2027-09-15', 'Anugerah Pharmindo', 'Obat Bebas', 'Tablet', 'Vitamin C 1000mg'),
('OTC-013', 'Vitalong C 10 kapsul (Bintang Toedjoe)', 'Vitamin', 'kapsul', 25, 9000, 13000, 8, '2027-06-20', 'Parit Padang Global', 'Obat Bebas', 'Kapsul', 'Vitamin C+E'),
-- OTC - Batuk & Pilek
('OTC-014', 'Vicks Formula 44 100ml (Procter & Gamble)', 'Respirologi', 'botol', 25, 18000, 25000, 8, '2027-05-20', 'Anugerah Pharmindo', 'Obat Bebas', 'Sirup', 'Dextromethorphan'),
('OTC-015', 'Konidin 10 tablet (Kalbe)', 'Respirologi', 'tablet', 30, 3000, 4500, 10, '2027-08-30', 'Kalbe Farma', 'Obat Bebas', 'Tablet', 'CTM+Pseudoephedrine'),
('OTC-016', 'Siladex 60ml (Sanbe)', 'Respirologi', 'botol', 25, 7000, 10000, 8, '2027-04-10', 'Sanbe Farma', 'Obat Bebas', 'Sirup', 'Dextromethorphan'),
('OTC-017', 'Tuscal 60ml (Sanbe)', 'Respirologi', 'botol', 20, 9000, 13000, 8, '2027-03-15', 'Sanbe Farma', 'Obat Bebas', 'Sirup', 'Guaifenesin'),
-- OTC - Anti Mual/Muntah
('OTC-018', 'Antimo 4 tablet (Bintang Toedjoe)', 'Gastroenterologi', 'tablet', 40, 1500, 2500, 12, '2027-12-10', 'Parit Padang Global', 'Obat Bebas', 'Tablet', 'Dimenhydrinate'),
-- OTC - Jamu/Herbal
('OTC-019', 'Tolak Angin Anak 15ml (Bintang Toedjoe)', 'Herbal', 'sachet', 40, 3000, 4500, 12, '2027-11-30', 'Parit Padang Global', 'Obat Bebas', 'Cairan', 'Herbal'),
('OTC-020', 'Fitolac 10 kaplet (Bintang Toedjoe)', 'Herbal', 'kaplet', 25, 5000, 7500, 8, '2027-07-15', 'Parit Padang Global', 'Obat Bebas', 'Kaplet', 'Herbal'),
-- OTC - Perawatan Luka
('OTC-021', 'Minyak Ikan 30ml (Hexpharm)', 'Dermatologi', 'botol', 20, 5000, 7500, 8, '2027-05-25', 'Hexpharm', 'Obat Bebas', 'Cairan', 'Cod Liver Oil'),
('OTC-022', 'Zinc Oxide Krim (Kimia Farma)', 'Dermatologi', 'tube', 20, 4000, 6000, 8, '2027-06-10', 'Kimia Farma', 'Obat Bebas', 'Krim', 'Zinc Oxide'),
-- OTC - Alergi
('OTC-023', 'Allergin 4mg 10 tablet (Konimex)', 'Antihistamin', 'tablet', 35, 1500, 2500, 12, '2027-09-30', 'Anugerah Pharmindo', 'Obat Bebas', 'Tablet', 'Chlorpheniramine'),
('OTC-024', 'Hismin 10mg 10 tablet (Sanbe)', 'Antihistamin', 'tablet', 30, 2500, 3500, 10, '2027-08-20', 'Sanbe Farma', 'Obat Bebas', 'Tablet', 'Loratadine'),
-- OTC - Kulit Topikal OTC
('OTC-025', 'Miconazole Krim 2% (Kalbe)', 'Dermatologi', 'tube', 25, 6000, 8500, 8, '2027-04-20', 'Kalbe Farma', 'Obat Bebas', 'Krim', 'Miconazole'),
('OTC-026', 'Ketokonazol Krim 2% (Bernofarm)', 'Dermatologi', 'tube', 20, 7000, 10000, 8, '2027-05-30', 'Bernofarm', 'Obat Bebas', 'Krim', 'Ketoconazole'),
-- OTC - Oral Hygiene
('OTC-027', 'Enzim Mouthwash 120ml (Bernofarm)', 'Stomatologi', 'botol', 15, 18000, 25000, 6, '2027-10-15', 'Bernofarm', 'Obat Bebas', 'Obat Kumur', 'Enzim'),
-- OTC - Diare
('OTC-028', 'Smecta 3g 6 sachet (Beaufour Ipsen)', 'Gastroenterologi', 'sachet', 30, 25000, 32000, 10, '2027-07-30', 'Anugerah Pharmindo', 'Obat Bebas', 'Bubuk', 'Diosmectite'),
('OTC-029', 'Lacto-B 12 sachet (Inbio)', 'Gastroenterologi', 'sachet', 25, 18000, 25000, 8, '2027-06-15', 'Anugerah Pharmindo', 'Obat Bebas', 'Bubuk', 'Probiotic'),
-- OTC - Tenggorokan
('OTC-030', 'Strepsils Cool 8s (Reckitt Benckiser)', 'Respirologi', 'pcs', 40, 12000, 17000, 12, '2028-01-20', 'Anugerah Pharmindo', 'Obat Bebas', 'Tablet Isap', 'Amylmetacresol'),
('OTC-031', 'Woods Cough Syrup 100ml (Hoe Ikat)', 'Respirologi', 'botol', 25, 15000, 21000, 8, '2027-05-10', 'Parit Padang Global', 'Obat Bebas', 'Sirup', 'Herbal'),
-- OTC - Vitamin Anak
('OTC-032', 'Bebelac 3 400g Vanilla (Kalbe)', 'Vitamin', 'kaleng', 15, 60000, 78000, 6, '2027-03-20', 'Kalbe Farma', 'Obat Bebas', 'Bubuk', 'Formula Anak'),
('OTC-033', 'Sari Kurma Madu 200ml (Bintang Toedjoe)', 'Vitamin', 'botol', 20, 18000, 25000, 8, '2027-08-05', 'Parit Padang Global', 'Obat Bebas', 'Sirup', 'Kurma+Madu'),
-- OTC - Oles/Luar
('OTC-034', 'Minyak Telon 30ml (Nyonya Meneer)', 'Herbal', 'botol', 30, 8000, 12000, 10, '2028-03-15', 'Parit Padang Global', 'Obat Bebas', 'Cairan', 'Minyak Telon'),
('OTC-035', 'Baby Oil 100ml (Johnson)', 'Perawatan Bayi', 'botol', 20, 15000, 22000, 8, '2028-06-20', 'Anugerah Pharmindo', 'Obat Bebas', 'Cairan', 'Mineral Oil'),
-- OTC - Suplemen Dewasa
('OTC-036', 'Kapsul Bawang Putih 300mg (Tempo)', 'Suplemen', 'kapsul', 25, 6000, 9000, 8, '2027-09-10', 'Parit Padang Global', 'Obat Bebas', 'Kapsul', 'Garlic Oil'),
('OTC-037', 'Lecithin E 1000mg 12 kapsul (Tempo)', 'Suplemen', 'kapsul', 20, 12000, 17000, 8, '2027-10-30', 'Parit Padang Global', 'Obat Bebas', 'Kapsul', 'Lecithin+Vitamin E'),
('OTC-038', 'Kunyit Putih 12 kapsul (Bintang Toedjoe)', 'Suplemen', 'kapsul', 25, 5000, 7500, 8, '2027-07-25', 'Parit Padang Global', 'Obat Bebas', 'Kapsul', 'Curcuma'),
-- OTC - P3K
('OTC-039', 'Povidone Iodine Swab 10s (Kimia Farma)', 'Antiseptik', 'box', 20, 10000, 15000, 8, '2027-11-20', 'Kimia Farma', 'Obat Bebas', 'Swab', 'Povidone Iodine'),
('OTC-040', 'Alkohol 70% 100ml (Kimia Farma)', 'Antiseptik', 'botol', 30, 5000, 8000, 10, '2028-01-10', 'Kimia Farma', 'Obat Bebas', 'Cairan', 'Ethanol 70%')
ON CONFLICT (code) DO NOTHING;
