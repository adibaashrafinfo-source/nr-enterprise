-- =====================================================================
-- NR ENTERPRISE — MySQL seed data. Import AFTER NRE_mysql_schema.sql (phpMyAdmin > Import).
-- 3 categories, 19 product lines (1 default variant each), 20 client logos, 6 UNPUBLISHED certificates.
-- Safe to run once on a fresh database. Image paths point to files shipped with the frontend under /assets/.
-- =====================================================================
SET NAMES utf8mb4;


INSERT INTO doc_counters (doc_type,prefix,last_number,padding) VALUES ('invoice','INV-',0,4),('order','SO-',0,4),('challan','CH-',0,4),('receipt','RC-',0,4),('purchase','PO-',0,4),('voucher','SV-',0,4),('customer','CUS-',0,4),('supplier','SUP-',0,4);

INSERT INTO units (code,name,pcs_per_unit) VALUES ('pcs','Piece',1),('dozen','Dozen',12),('gross','Gross',144),('thousand','Thousand',1000),('roll','Roll',NULL),('cone','Cone',NULL),('kg','Kilogram',NULL),('yard','Yard',NULL),('metre','Metre',NULL);

INSERT INTO company_settings (id,company_name,tagline,address,phones,emails,whatsapp,logo_url,invoice_footer) VALUES (1,'NR Enterprise','All Kinds of Garments Accessories','House # 375/C, Chanpara, Uttarkhan, Dhaka-1230, Bangladesh','["+8801876584213", "+8801648886936"]','["nrenterprisebd2@gmail.com"]','+8801876584213','/assets/brand/nr-logo-full.png','Thank you for your business.');

INSERT INTO categories (slug,name,description,image_url,sort_order) VALUES ('labels','Labels','Fabric identification sewn into garments: woven, printed care and screen printed labels.','/assets/products/woven-labels/woven-labels-1.jpg',1);

INSERT INTO categories (slug,name,description,image_url,sort_order) VALUES ('tags-stickers-tracking','Tags, Stickers & Tracking','Paper and adhesive identification: hangtags, thermal and barcode stickers, RFID and variable-data labels.','/assets/products/offset-printed-tags/offset-printed-tags-1.jpg',2);

INSERT INTO categories (slug,name,description,image_url,sort_order) VALUES ('trims','Trims & Accessories','Physical garment components: sewing thread, elastic, twill tape, drawcords, cord stoppers and buttons.','/assets/products/sewing-thread/sewing-thread-1.jpg',3);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='labels'),'woven-labels','Woven Labels','WL','Sewn-in brand label with a permanent, durable finish.','Woven labels are the original label. Sewn into your garment, they are your brand''s permanent signature and offer high quality and durability. Specialised in woven-edge technology, produced on modern machines with recycled-quality raw material.','["Permanent brand identity", "High durability", "Recycled-quality raw material", "Taffeta, satin and damask weaves"]','{"weave": ["Taffeta", "Satin", "Damask"], "fields": ["width_mm", "length_mm", "colours", "edge", "buyer_brand"], "fold_types": ["End fold", "Centre fold", "Mitre fold"]}','pcs',1000.0,1,1);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='labels'),'printed-care-labels','Printed Care Labels (PFL)','PCL','Care and content labels printed on a wide range of fibres.','Care and content labels are small yet crucial to ensuring your product reaches the shop floor and the end user enjoys it as long as possible. Printed on polyester satin, taffeta, acetate, tear-away, nylon, poly-cotton blends, cotton, organic cotton and twill tape.','["Composition and care instructions", "Wide range of base fibres", "Recycled-quality raw material"]','{"fields": ["size", "print_colours", "language", "buyer_brand"], "base_fabrics": ["Polyester satin", "Taffeta", "Acetate", "Tear away", "Nylon", "Poly cotton", "Cotton", "Organic cotton", "Twill tape"]}','pcs',1000.0,1,2);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='labels'),'screen-printed-labels','Screen Printed Labels','SPL','Vibrant colour at a relatively lower cost.','A popular alternative to woven labels thanks to colour vibrancy. Produced on in-house substrates, including cotton substitutes that are durable and do not fray.','["Colour vibrancy", "Lower cost than woven", "Does not fray", "In-house substrates"]','{"fields": ["substrate", "size", "print_colours", "finish"]}','pcs',1000.0,0,3);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='tags-stickers-tracking'),'offset-printed-tags','Offset Printed Tags','OPT','Price tickets, hangtags, waist tags and secondary tags.','A swing ticket is the book cover to your brand. Wide range of price tickets, hangtags, waist tags and secondary tags with finishing such as die cutting, embossing, foil stamping, varnishing, stringing, eyelet and folding. Printed on eco-friendly recycled paper with soy-based ink.','["Die cutting", "Embossing", "Foil stamping", "Varnishing", "Stringing and eyelet", "Recycled paper, soy-based ink"]','{"fields": ["paper_type", "gsm", "size", "recycled_paper"], "finishing": ["Die cut", "Emboss", "Foil", "Varnish", "String", "Eyelet", "Fold"]}','pcs',1000.0,1,4);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='tags-stickers-tracking'),'digital-printed-tags','Digital Printed Tags','DPT','Photo-quality tags with many designs in one run.','A cost-effective method for custom tags and labels with photographic-quality graphics, crisp text and vibrant colours. Multiple designs can be produced in the same run without delay, from startups to large-scale enterprises.','["Photographic quality", "Short runs", "Multiple designs per run"]','{"fields": ["paper_type", "gsm", "size", "finishing"]}','pcs',500.0,0,5);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='tags-stickers-tracking'),'thermal-stickers','Thermal Stickers','TST','Thermal printed price, carton, poly and box stickers.','Thermal printed labels and tags for barcode-oriented products: price stickers, price tickets, carton stickers, poly stickers, box stickers and more.','["Barcode-ready", "Price, carton, poly and box stickers"]','{"fields": ["roll_width_mm", "roll_length_m", "core_size", "material", "labels_per_roll"]}','roll',10.0,1,6);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='tags-stickers-tracking'),'barcode-labels','Barcode Labels & Stickers','BCL','Barcode and QR identification labels.','Barcode and QR code labels and stickers for identification, tracking and retail scanning.','["Barcode and QR", "Roll or sheet"]','{"fields": ["code_type", "size", "material", "labels_per_roll"]}','roll',10.0,0,7);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='tags-stickers-tracking'),'rfid-labels-tags','RFID Labels & Tags','RFD','RFID labels and tags for inventory and supply-chain tracking.','Radio frequency identification used in manufacturing, inventory control, warehousing, distribution, logistics, automatic object tracking and supply-chain management. Labels and tags produced in-house.','["Inventory control", "Warehousing and logistics", "Automatic tracking"]','{"fields": ["chip_type", "frequency", "size", "printed_data"]}','pcs',1000.0,0,8);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='tags-stickers-tracking'),'variable-data-labels','Variable Data Labels','VDL','Tickets and labels carrying changing data through the supply chain.','Variable data tickets and labels communicate critical information throughout the supply chain as a product makes its way from production through to store.','["Unique data per label", "Production to store tracking"]','{"fields": ["data_fields", "size", "material", "code_type"]}','pcs',1000.0,0,9);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='tags-stickers-tracking'),'flexo-adhesive-labels','Flexo Printed Adhesive Labels','FAL','Roll adhesive labels printed by flexo.','Flexo printed adhesive labels and stickers on rolls for packaging and product identification.','["Roll form", "Adhesive backing"]','{"fields": ["roll_width_mm", "material", "print_colours"]}','roll',10.0,0,10);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='tags-stickers-tracking'),'adhesive-labels-tags','Adhesive Labels & Tags','ALT','Adhesive labels and tags in rolls and sheets.','A range of adhesive labels and tags for packaging, cartons and product identification.','["Rolls and sheets", "Custom shapes"]','{"fields": ["size", "material", "shape"]}','roll',10.0,0,11);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='trims'),'sewing-thread','Sewing Thread','THR','Cotton, polyester and silk thread for strong, smooth seams.','A vital component in garment production, designed to hold fabrics together with strength and flexibility. Available in cotton, polyester and silk for durability, smooth seams and a refined finish.','["Cotton, polyester, silk", "Durable smooth seams", "Wide colour range"]','{"fields": ["fibre", "count_ticket", "colour_code", "cone_weight"]}','cone',12.0,1,12);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='trims'),'elastic','Elastic','ELA','Stretchable elastic for waistbands, cuffs and more.','A stretchable material for flexibility, comfort and a secure fit. Commonly made from rubber or spandex blended with fabric fibres. Available in various widths and strengths for waistbands, cuffs and other areas needing stretch and recovery.','["Various widths and strengths", "Rubber or spandex blends", "Comfort and secure fit"]','{"fields": ["material", "width_mm", "colour", "stretch_type", "roll_length"]}','roll',10.0,1,13);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='trims'),'twill-tape','Twill Tape','TWT','Strong flat woven tape with a diagonal pattern.','A flat woven tape with a distinctive diagonal pattern, known for strength and durability. Made from cotton, polyester or a blend, widely used for binding edges, reinforcing seams and creating ties in garments and home textiles.','["Binding and reinforcing", "Cotton or polyester", "Soft texture, sturdy weave"]','{"fields": ["material", "width_mm", "colour", "roll_length"]}','roll',10.0,0,14);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='trims'),'drawstring-cord','Drawstring / Drawcord','DRC','Coloured cords with tipped ends for hoods and waists.','Coloured drawstrings and drawcords with tipped ends for hoodies, joggers, shorts and bags.','["Many colours", "Tipped ends", "Custom lengths"]','{"fields": ["diameter_mm", "length_cm", "tip_type", "colour"]}','dozen',12.0,0,15);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='trims'),'cord-stoppers','Cord Stoppers','CST','Plastic and metal toggle stoppers for drawcords.','Plastic and metal cord stoppers (toggles) for drawcords, hoods, waists and bags.','["Plastic and metal", "Single and double hole"]','{"fields": ["size", "hole_count", "material", "colour"]}','gross',1.0,0,16);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='trims'),'metal-snap-buttons','Metal Snap Buttons','MSB','Brass-finish snap buttons with custom logo.','Metal snap buttons in antique and other finishes, with custom embossed logos. Four-part sets: cap, socket, stud and post.','["Custom logo", "Antique and other finishes", "Four-part snap sets"]','{"fields": ["size_ligne", "finish", "snap_parts", "logo"]}','gross',1.0,1,17);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='trims'),'plastic-buttons','Plastic Buttons','PLB','2-hole and 4-hole plastic buttons in many colours.','Durable plastic buttons in two-hole and four-hole styles across a wide colour range.','["2-hole and 4-hole", "Many colours and sizes"]','{"fields": ["size_ligne", "holes", "colour", "finish"]}','gross',1.0,0,18);

INSERT INTO products (category_id,slug,name,code,short_description,description,features,specs,unit_code,moq,is_featured,sort_order) VALUES ((SELECT id FROM categories WHERE slug='trims'),'shell-buttons','Shell / Pearl Buttons','SHB','Pearl and shell buttons for shirts and premium wear.','Pearl and shell-finish buttons for shirts and premium garments.','["Pearl and shell finish", "Shirt and premium wear"]','{"fields": ["size_ligne", "holes", "finish"]}','gross',1.0,0,19);

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='woven-labels'),'WL-STD','Woven Labels — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='printed-care-labels'),'PCL-STD','Printed Care Labels (PFL) — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='screen-printed-labels'),'SPL-STD','Screen Printed Labels — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='offset-printed-tags'),'OPT-STD','Offset Printed Tags — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='digital-printed-tags'),'DPT-STD','Digital Printed Tags — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='thermal-stickers'),'TST-STD','Thermal Stickers — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='barcode-labels'),'BCL-STD','Barcode Labels & Stickers — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='rfid-labels-tags'),'RFD-STD','RFID Labels & Tags — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='variable-data-labels'),'VDL-STD','Variable Data Labels — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='flexo-adhesive-labels'),'FAL-STD','Flexo Printed Adhesive Labels — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='adhesive-labels-tags'),'ALT-STD','Adhesive Labels & Tags — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='sewing-thread'),'THR-STD','Sewing Thread — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='elastic'),'ELA-STD','Elastic — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='twill-tape'),'TWT-STD','Twill Tape — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='drawstring-cord'),'DRC-STD','Drawstring / Drawcord — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='cord-stoppers'),'CST-STD','Cord Stoppers — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='metal-snap-buttons'),'MSB-STD','Metal Snap Buttons — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='plastic-buttons'),'PLB-STD','Plastic Buttons — Standard');

INSERT INTO product_variants (product_id,sku,name) VALUES ((SELECT id FROM products WHERE slug='shell-buttons'),'SHB-STD','Shell / Pearl Buttons — Standard');

INSERT INTO product_images (product_id,url,alt,sort_order,is_primary) VALUES
((SELECT id FROM products WHERE slug='woven-labels'),'/assets/products/woven-labels/woven-labels-1.jpg','Woven Labels',1,1),
((SELECT id FROM products WHERE slug='woven-labels'),'/assets/products/woven-labels/woven-labels-2.jpg','Woven Labels',2,0),
((SELECT id FROM products WHERE slug='woven-labels'),'/assets/products/woven-labels/woven-labels-3.jpg','Woven Labels',3,0),
((SELECT id FROM products WHERE slug='woven-labels'),'/assets/products/woven-labels/woven-labels-4.jpg','Woven Labels',4,0),
((SELECT id FROM products WHERE slug='printed-care-labels'),'/assets/products/printed-care-labels/printed-care-labels-1.jpg','Printed Care Labels (PFL)',1,1),
((SELECT id FROM products WHERE slug='printed-care-labels'),'/assets/products/printed-care-labels/printed-care-labels-2.jpg','Printed Care Labels (PFL)',2,0),
((SELECT id FROM products WHERE slug='printed-care-labels'),'/assets/products/printed-care-labels/printed-care-labels-3.jpg','Printed Care Labels (PFL)',3,0),
((SELECT id FROM products WHERE slug='printed-care-labels'),'/assets/products/printed-care-labels/printed-care-labels-4.jpg','Printed Care Labels (PFL)',4,0),
((SELECT id FROM products WHERE slug='printed-care-labels'),'/assets/products/printed-care-labels/printed-care-labels-5.jpg','Printed Care Labels (PFL)',5,0),
((SELECT id FROM products WHERE slug='screen-printed-labels'),'/assets/products/screen-printed-labels/screen-printed-labels-1.jpg','Screen Printed Labels',1,1),
((SELECT id FROM products WHERE slug='screen-printed-labels'),'/assets/products/screen-printed-labels/screen-printed-labels-2.jpg','Screen Printed Labels',2,0),
((SELECT id FROM products WHERE slug='screen-printed-labels'),'/assets/products/screen-printed-labels/screen-printed-labels-3.jpg','Screen Printed Labels',3,0),
((SELECT id FROM products WHERE slug='screen-printed-labels'),'/assets/products/screen-printed-labels/screen-printed-labels-4.jpg','Screen Printed Labels',4,0),
((SELECT id FROM products WHERE slug='screen-printed-labels'),'/assets/products/screen-printed-labels/screen-printed-labels-5.jpg','Screen Printed Labels',5,0),
((SELECT id FROM products WHERE slug='screen-printed-labels'),'/assets/products/screen-printed-labels/screen-printed-labels-6.jpg','Screen Printed Labels',6,0),
((SELECT id FROM products WHERE slug='offset-printed-tags'),'/assets/products/offset-printed-tags/offset-printed-tags-1.jpg','Offset Printed Tags',1,1),
((SELECT id FROM products WHERE slug='offset-printed-tags'),'/assets/products/offset-printed-tags/offset-printed-tags-2.jpg','Offset Printed Tags',2,0),
((SELECT id FROM products WHERE slug='offset-printed-tags'),'/assets/products/offset-printed-tags/offset-printed-tags-3.jpg','Offset Printed Tags',3,0),
((SELECT id FROM products WHERE slug='offset-printed-tags'),'/assets/products/offset-printed-tags/offset-printed-tags-4.jpg','Offset Printed Tags',4,0),
((SELECT id FROM products WHERE slug='digital-printed-tags'),'/assets/products/digital-printed-tags/digital-printed-tags-1.jpg','Digital Printed Tags',1,1),
((SELECT id FROM products WHERE slug='digital-printed-tags'),'/assets/products/digital-printed-tags/digital-printed-tags-2.jpg','Digital Printed Tags',2,0),
((SELECT id FROM products WHERE slug='thermal-stickers'),'/assets/products/thermal-stickers/thermal-stickers-1.jpg','Thermal Stickers',1,1),
((SELECT id FROM products WHERE slug='thermal-stickers'),'/assets/products/thermal-stickers/thermal-stickers-2.jpg','Thermal Stickers',2,0),
((SELECT id FROM products WHERE slug='thermal-stickers'),'/assets/products/thermal-stickers/thermal-stickers-3.jpg','Thermal Stickers',3,0),
((SELECT id FROM products WHERE slug='barcode-labels'),'/assets/products/barcode-labels/barcode-labels-1.jpg','Barcode Labels & Stickers',1,1),
((SELECT id FROM products WHERE slug='barcode-labels'),'/assets/products/barcode-labels/barcode-labels-2.jpg','Barcode Labels & Stickers',2,0),
((SELECT id FROM products WHERE slug='barcode-labels'),'/assets/products/barcode-labels/barcode-labels-3.jpg','Barcode Labels & Stickers',3,0),
((SELECT id FROM products WHERE slug='rfid-labels-tags'),'/assets/products/rfid-labels-tags/rfid-labels-tags-1.jpg','RFID Labels & Tags',1,1),
((SELECT id FROM products WHERE slug='rfid-labels-tags'),'/assets/products/rfid-labels-tags/rfid-labels-tags-2.jpg','RFID Labels & Tags',2,0),
((SELECT id FROM products WHERE slug='rfid-labels-tags'),'/assets/products/rfid-labels-tags/rfid-labels-tags-3.jpg','RFID Labels & Tags',3,0),
((SELECT id FROM products WHERE slug='rfid-labels-tags'),'/assets/products/rfid-labels-tags/rfid-labels-tags-4.jpg','RFID Labels & Tags',4,0),
((SELECT id FROM products WHERE slug='variable-data-labels'),'/assets/products/variable-data-labels/variable-data-labels-1.jpg','Variable Data Labels',1,1),
((SELECT id FROM products WHERE slug='variable-data-labels'),'/assets/products/variable-data-labels/variable-data-labels-2.jpg','Variable Data Labels',2,0),
((SELECT id FROM products WHERE slug='variable-data-labels'),'/assets/products/variable-data-labels/variable-data-labels-3.jpg','Variable Data Labels',3,0),
((SELECT id FROM products WHERE slug='variable-data-labels'),'/assets/products/variable-data-labels/variable-data-labels-4.jpg','Variable Data Labels',4,0),
((SELECT id FROM products WHERE slug='flexo-adhesive-labels'),'/assets/products/flexo-adhesive-labels/flexo-adhesive-labels-1.jpg','Flexo Printed Adhesive Labels',1,1),
((SELECT id FROM products WHERE slug='adhesive-labels-tags'),'/assets/products/adhesive-labels-tags/adhesive-labels-tags-1.jpg','Adhesive Labels & Tags',1,1),
((SELECT id FROM products WHERE slug='sewing-thread'),'/assets/products/sewing-thread/sewing-thread-1.jpg','Sewing Thread',1,1),
((SELECT id FROM products WHERE slug='elastic'),'/assets/products/elastic/elastic-1.jpg','Elastic',1,1),
((SELECT id FROM products WHERE slug='twill-tape'),'/assets/products/twill-tape/twill-tape-1.jpg','Twill Tape',1,1),
((SELECT id FROM products WHERE slug='drawstring-cord'),'/assets/products/drawstring-cord/drawstring-cord-1.jpg','Drawstring / Drawcord',1,1),
((SELECT id FROM products WHERE slug='cord-stoppers'),'/assets/products/cord-stoppers/cord-stoppers-1.jpg','Cord Stoppers',1,1),
((SELECT id FROM products WHERE slug='cord-stoppers'),'/assets/products/cord-stoppers/cord-stoppers-2.jpg','Cord Stoppers',2,0),
((SELECT id FROM products WHERE slug='metal-snap-buttons'),'/assets/products/metal-snap-buttons/metal-snap-buttons-1.jpg','Metal Snap Buttons',1,1),
((SELECT id FROM products WHERE slug='plastic-buttons'),'/assets/products/plastic-buttons/plastic-buttons-1.jpg','Plastic Buttons',1,1),
((SELECT id FROM products WHERE slug='shell-buttons'),'/assets/products/shell-buttons/shell-buttons-1.jpg','Shell / Pearl Buttons',1,1);

-- client logos: shown only when is_active=1; permission_confirmed=0 until NR confirms permission
INSERT INTO clients (name,logo_url,sort_order,is_active,permission_confirmed) VALUES
('ONLY','/assets/clients/only.png',1,1,0),
('name it','/assets/clients/nameit.png',2,1,0),
('JDY','/assets/clients/jdy.png',3,1,0),
('VERO MODA','/assets/clients/veromoda.png',4,1,0),
('NOISY MAY','/assets/clients/noisymay.png',5,1,0),
('ONLY & SONS','/assets/clients/onlyandsons.png',6,1,0),
('Obaïbi','/assets/clients/obaibi.png',7,1,0),
('Okaïdi','/assets/clients/okaidi.png',8,1,0),
('Pepe Jeans London','/assets/clients/pepejeans.png',9,1,0),
('Lois','/assets/clients/lois.png',10,1,0),
('157','/assets/clients/157.png',11,1,0),
('ONLY Carmakoma','/assets/clients/onlycarmakoma.png',12,1,0),
('JULES','/assets/clients/jules.png',13,1,0),
('PIECES','/assets/clients/pieces.png',14,1,0),
('Y.A.S','/assets/clients/yas.png',15,1,0),
('ONLY PLAY','/assets/clients/onlyplay.png',16,1,0),
('JACK & JONES','/assets/clients/jackandjones.png',17,1,0),
('SELECTED / FEMME','/assets/clients/selectedfemme.png',18,1,0),
('mama licious','/assets/clients/mamalicious.png',19,1,0),
('VILA Clothes','/assets/clients/vilaclothes.png',20,1,0);

-- certificates came from the UNB profile text: keep UNPUBLISHED until NR confirms its own
INSERT INTO certifications (name,description,sort_order,is_published) VALUES
('OEKO-TEX Standard 100','Labels tested for harmful substances.',1,0),
('Forest Stewardship Council (FSC)','FSC certified paper from sustainably managed or recycled sources.',2,0),
('Global Recycled Standard (GRS)','Verifies origin of recycled materials.',3,0),
('amfori BSCI','Social compliance across the supply chain.',4,0),
('ISO 9001:2015 (QMS)','Quality management system standard.',5,0),
('SEDEX / SMETA','Ethical trade audit.',6,0);
