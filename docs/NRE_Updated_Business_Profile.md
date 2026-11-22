# NR Enterprise: Updated Business Profile (working copy for the website and admin build)

*Prepared by Abrar IT, 22 Nov 2026. Based on `NRE_BUSINESS_Profile.pdf` (20 pages, updated) and the earlier NR profile (19 pages). Items marked **[VERIFY]** are not yet confirmed as NR's own facts and are hidden on the website until the owner confirms them.*

## 1. What the updated profile fixed, and what is still wrong

**Fixed in the update**

- Colour theme changed from green to **yellow** (matches the logo's yellow circle).
- New phone **+880 1876584213** and email **nrenterprisebd2@gmail.com**; address unchanged.
- Client wall expanded to **20 brand logos**; Management Overview page and cover tagline added.

**Still wrong or missing (must be resolved before launch)**

| # | Finding | Where | Action taken in this package |
|---|---|---|---|
| 1 | Company text still names **United Nine Bangladesh** (Brief Overview, Sustainability Overview, 'Welcome to United Nine Bangladesh' photo) | Pages 3-4 | Rewritten as NR Enterprise in section 3; photo not used |
| 2 | 'Founded in 2015', '85 million capacity per month', '150+ employees', '10+ years of manufacturing' are word-for-word UNB's | Pages 3, 5 | Hidden on site **[VERIFY]** |
| 3 | Machinery and capacity tables (long machine lists) and per-process capacities are UNB's | Pages 16-17 | Kept as reference only in section 8; capacity block hidden by flag |
| 4 | Certificates (OEKO-TEX, FSC C147844, GRS GSCI-1074, amfori, ISO 9001:2015, SEDEX) carry UNB's certificate numbers and scans | Page 15 | Stored but **unpublished**; owner must supply NR's own |
| 5 | Management Overview is signed 'Md. Arif, Managing Director, United Nine Bangladesh OPC' and thanks the Sun Tin Lun group | Page 18 | Omitted; owner to provide NR's own message |
| 6 | Cover says 'manufacturer & exporter'; earlier profile said 'supplier' | Cover | Neutral wording used until confirmed |
| 7 | Trims (thread, elastic, twill tape, drawcord, stoppers, buttons) were **removed** in the update but are NR's range in the earlier profile and in 'All Kinds of Garments Accessories' | Earlier pp 7, 15-17 | Added back as 8 products (section 5) |
| 8 | 'www.nrenterprisebd2@gmail.com' is printed as a website but is an email; Facebook/YouTube icons and QR have no links | Cover, p20 | Social/website left empty; icons hidden |
| 9 | Photos are small (about 290 px); some factory photos appear to show UNB branding | Pages 5-13 | Product photos used at small sizes; factory/machine photos not used |
| 10 | No per-product specs, MOQ, colours, sizes, pricing | All | Spec field templates and default variants created; owner to fill |
| 11 | No BIN/TIN/trade licence/bank details for invoices | - | Fields added to company settings |
| 12 | Third-party brand logos shown without any stated permission | Page 14 | Logos loaded with `permission_confirmed = false`; owner to confirm |

## 2. Company identity and contact

| Item | Value |
|---|---|
| Name | NR Enterprise |
| Tagline | All Kinds of Garments Accessories |
| Positioning | Garments trims & accessories supplier (cover: 'manufacturer & exporter' **[VERIFY]**) |
| Promise | We synchronize supply with demand |
| Motto | We blend People, Process & Technology to meet customer demand |
| Closing line | Make your brand's product stand out with our high-quality production line. |
| Address | House # 375/C, Chanpara, Uttarkhan, Dhaka-1230, Bangladesh |
| Phone | +880 1876584213, +88 01648886936 |
| WhatsApp | +880 1876584213 (assumed same as first phone **[VERIFY]**) |
| Email | nrenterprisebd2@gmail.com |
| Facebook / YouTube | Icons on cover only, links missing **[PROVIDE]** |
| Website / domain | Not provided **[PROVIDE]** |
| BIN / TIN / Trade licence | Not provided **[PROVIDE]** |

**Brand:** logo = green NR monogram in a yellow circle; colours #F8C840 yellow, #6FA33F green, #201818 black; typeface Poppins.

## 3. About NR Enterprise (rewritten with NR's name, unverified claims removed)

From promotional labels through to product identification solutions, NR Enterprise specialises in enhancing your brand image and helping you share essential information about your products. Whether you are a retailer, brand owner or garment manufacturer, our integrated range of products and solutions is designed to support your needs throughout the supply chain, so whatever you need from your labels, tags and trims, you can count on us to make it happen.

We refine the art of apparel labelling. From concept to production, we turn every label and tag into the perfect distillation of a brand.

We operate with moral, ethical and responsible business practices and expect the same high standards from our employees, business partners and customers. Everything we do is designed to have a positive impact on our communities and the environment in which we live.

**Vision:** To be the global Trims & Accessories company that respected brands, retailers and manufacturers choose to partner with.

**Mission:** To create innovative, intelligent and sustainable ways to connect brands with consumers.

> **[VERIFY] hidden until confirmed:** years in business, founding year, monthly capacity, employee count, 'best trims and accessories provider in Bangladesh', 'compliant factory with state-of-the-art machines', 'separate production unit'.

## 4. Sustainability (NR wording)

With consumers becoming more environmentally aware and demanding more transparency and ethical practices, brands and retailers are investing heavily in sustainability. At NR Enterprise we understand that the products we offer are as important as how we offer them. We are widening our range of sustainable products and improving our supply chain processes and ways of working to minimise our environmental impact.

**Sustainability Technical Product Guide:** a resource to help brands and retailers navigate the transition towards sustainable development with science-led information. **[VERIFY: does NR have this guide?]**

**Environmental policy:** we recognise the need to contribute to the sustainability of natural resources and believe sustainable development means adopting business strategies and processes that meet the needs of the company and its stakeholders today while protecting and enhancing the resources needed in the future. Objectives focus on materials, water, greenhouse gas emissions and energy, waste and air pollution.

**4R:** Reduce, Reuse, Recycle, Recover (icons from the earlier NR profile).

## 5. Product catalogue (19 product lines in 3 categories)


### Labels

#### Woven Labels  (`woven-labels`, code WL)
Woven labels are the original label. Sewn into your garment, they are your brand's permanent signature and offer high quality and durability. Specialised in woven-edge technology, produced on modern machines with recycled-quality raw material.

- **Highlights:** Permanent brand identity; High durability; Recycled-quality raw material; Taffeta, satin and damask weaves
- **Default unit / MOQ:** pcs / 1000 **[VERIFY MOQ]**
- **Spec fields to capture:** width_mm, length_mm, colours, edge, buyer_brand
- **Weave:** Taffeta, Satin, Damask
- **Fold Types:** End fold, Centre fold, Mitre fold
- **Images:** `products/woven-labels/woven-labels-1.jpg`, `products/woven-labels/woven-labels-2.jpg`, `products/woven-labels/woven-labels-3.jpg`, `products/woven-labels/woven-labels-4.jpg`

#### Printed Care Labels (PFL)  (`printed-care-labels`, code PCL)
Care and content labels are small yet crucial to ensuring your product reaches the shop floor and the end user enjoys it as long as possible. Printed on polyester satin, taffeta, acetate, tear-away, nylon, poly-cotton blends, cotton, organic cotton and twill tape.

- **Highlights:** Composition and care instructions; Wide range of base fibres; Recycled-quality raw material
- **Default unit / MOQ:** pcs / 1000 **[VERIFY MOQ]**
- **Spec fields to capture:** size, print_colours, language, buyer_brand
- **Base Fabrics:** Polyester satin, Taffeta, Acetate, Tear away, Nylon, Poly cotton, Cotton, Organic cotton, Twill tape
- **Images:** `products/printed-care-labels/printed-care-labels-1.jpg`, `products/printed-care-labels/printed-care-labels-2.jpg`, `products/printed-care-labels/printed-care-labels-3.jpg`, `products/printed-care-labels/printed-care-labels-4.jpg`, `products/printed-care-labels/printed-care-labels-5.jpg`

#### Screen Printed Labels  (`screen-printed-labels`, code SPL)
A popular alternative to woven labels thanks to colour vibrancy. Produced on in-house substrates, including cotton substitutes that are durable and do not fray.

- **Highlights:** Colour vibrancy; Lower cost than woven; Does not fray; In-house substrates
- **Default unit / MOQ:** pcs / 1000 **[VERIFY MOQ]**
- **Spec fields to capture:** substrate, size, print_colours, finish
- **Images:** `products/screen-printed-labels/screen-printed-labels-1.jpg`, `products/screen-printed-labels/screen-printed-labels-2.jpg`, `products/screen-printed-labels/screen-printed-labels-3.jpg`, `products/screen-printed-labels/screen-printed-labels-4.jpg`, `products/screen-printed-labels/screen-printed-labels-5.jpg`, `products/screen-printed-labels/screen-printed-labels-6.jpg`


### Tags, Stickers & Tracking

#### Offset Printed Tags  (`offset-printed-tags`, code OPT)
A swing ticket is the book cover to your brand. Wide range of price tickets, hangtags, waist tags and secondary tags with finishing such as die cutting, embossing, foil stamping, varnishing, stringing, eyelet and folding. Printed on eco-friendly recycled paper with soy-based ink.

- **Highlights:** Die cutting; Embossing; Foil stamping; Varnishing; Stringing and eyelet; Recycled paper, soy-based ink
- **Default unit / MOQ:** pcs / 1000 **[VERIFY MOQ]**
- **Spec fields to capture:** paper_type, gsm, size, recycled_paper
- **Finishing:** Die cut, Emboss, Foil, Varnish, String, Eyelet, Fold
- **Images:** `products/offset-printed-tags/offset-printed-tags-1.jpg`, `products/offset-printed-tags/offset-printed-tags-2.jpg`, `products/offset-printed-tags/offset-printed-tags-3.jpg`, `products/offset-printed-tags/offset-printed-tags-4.jpg`

#### Digital Printed Tags  (`digital-printed-tags`, code DPT)
A cost-effective method for custom tags and labels with photographic-quality graphics, crisp text and vibrant colours. Multiple designs can be produced in the same run without delay, from startups to large-scale enterprises.

- **Highlights:** Photographic quality; Short runs; Multiple designs per run
- **Default unit / MOQ:** pcs / 500 **[VERIFY MOQ]**
- **Spec fields to capture:** paper_type, gsm, size, finishing
- **Images:** `products/digital-printed-tags/digital-printed-tags-1.jpg`, `products/digital-printed-tags/digital-printed-tags-2.jpg`

#### Thermal Stickers  (`thermal-stickers`, code TST)
Thermal printed labels and tags for barcode-oriented products: price stickers, price tickets, carton stickers, poly stickers, box stickers and more.

- **Highlights:** Barcode-ready; Price, carton, poly and box stickers
- **Default unit / MOQ:** roll / 10 **[VERIFY MOQ]**
- **Spec fields to capture:** roll_width_mm, roll_length_m, core_size, material, labels_per_roll
- **Images:** `products/thermal-stickers/thermal-stickers-1.jpg`, `products/thermal-stickers/thermal-stickers-2.jpg`, `products/thermal-stickers/thermal-stickers-3.jpg`

#### Barcode Labels & Stickers  (`barcode-labels`, code BCL)
Barcode and QR code labels and stickers for identification, tracking and retail scanning.

- **Highlights:** Barcode and QR; Roll or sheet
- **Default unit / MOQ:** roll / 10 **[VERIFY MOQ]**
- **Spec fields to capture:** code_type, size, material, labels_per_roll
- **Images:** `products/barcode-labels/barcode-labels-1.jpg`, `products/barcode-labels/barcode-labels-2.jpg`, `products/barcode-labels/barcode-labels-3.jpg`

#### RFID Labels & Tags  (`rfid-labels-tags`, code RFD)
Radio frequency identification used in manufacturing, inventory control, warehousing, distribution, logistics, automatic object tracking and supply-chain management. Labels and tags produced in-house.

- **Highlights:** Inventory control; Warehousing and logistics; Automatic tracking
- **Default unit / MOQ:** pcs / 1000 **[VERIFY MOQ]**
- **Spec fields to capture:** chip_type, frequency, size, printed_data
- **Images:** `products/rfid-labels-tags/rfid-labels-tags-1.jpg`, `products/rfid-labels-tags/rfid-labels-tags-2.jpg`, `products/rfid-labels-tags/rfid-labels-tags-3.jpg`, `products/rfid-labels-tags/rfid-labels-tags-4.jpg`

#### Variable Data Labels  (`variable-data-labels`, code VDL)
Variable data tickets and labels communicate critical information throughout the supply chain as a product makes its way from production through to store.

- **Highlights:** Unique data per label; Production to store tracking
- **Default unit / MOQ:** pcs / 1000 **[VERIFY MOQ]**
- **Spec fields to capture:** data_fields, size, material, code_type
- **Images:** `products/variable-data-labels/variable-data-labels-1.jpg`, `products/variable-data-labels/variable-data-labels-2.jpg`, `products/variable-data-labels/variable-data-labels-3.jpg`, `products/variable-data-labels/variable-data-labels-4.jpg`

#### Flexo Printed Adhesive Labels  (`flexo-adhesive-labels`, code FAL)
Flexo printed adhesive labels and stickers on rolls for packaging and product identification.

- **Highlights:** Roll form; Adhesive backing
- **Default unit / MOQ:** roll / 10 **[VERIFY MOQ]**
- **Spec fields to capture:** roll_width_mm, material, print_colours
- **Images:** `products/flexo-adhesive-labels/flexo-adhesive-labels-1.jpg`

#### Adhesive Labels & Tags  (`adhesive-labels-tags`, code ALT)
A range of adhesive labels and tags for packaging, cartons and product identification.

- **Highlights:** Rolls and sheets; Custom shapes
- **Default unit / MOQ:** roll / 10 **[VERIFY MOQ]**
- **Spec fields to capture:** size, material, shape
- **Images:** `products/adhesive-labels-tags/adhesive-labels-tags-1.jpg`


### Trims & Accessories

#### Sewing Thread  (`sewing-thread`, code THR)
A vital component in garment production, designed to hold fabrics together with strength and flexibility. Available in cotton, polyester and silk for durability, smooth seams and a refined finish.

- **Highlights:** Cotton, polyester, silk; Durable smooth seams; Wide colour range
- **Default unit / MOQ:** cone / 12 **[VERIFY MOQ]**
- **Spec fields to capture:** fibre, count_ticket, colour_code, cone_weight
- **Images:** `products/sewing-thread/sewing-thread-1.jpg`

#### Elastic  (`elastic`, code ELA)
A stretchable material for flexibility, comfort and a secure fit. Commonly made from rubber or spandex blended with fabric fibres. Available in various widths and strengths for waistbands, cuffs and other areas needing stretch and recovery.

- **Highlights:** Various widths and strengths; Rubber or spandex blends; Comfort and secure fit
- **Default unit / MOQ:** roll / 10 **[VERIFY MOQ]**
- **Spec fields to capture:** material, width_mm, colour, stretch_type, roll_length
- **Images:** `products/elastic/elastic-1.jpg`

#### Twill Tape  (`twill-tape`, code TWT)
A flat woven tape with a distinctive diagonal pattern, known for strength and durability. Made from cotton, polyester or a blend, widely used for binding edges, reinforcing seams and creating ties in garments and home textiles.

- **Highlights:** Binding and reinforcing; Cotton or polyester; Soft texture, sturdy weave
- **Default unit / MOQ:** roll / 10 **[VERIFY MOQ]**
- **Spec fields to capture:** material, width_mm, colour, roll_length
- **Images:** `products/twill-tape/twill-tape-1.jpg`

#### Drawstring / Drawcord  (`drawstring-cord`, code DRC)
Coloured drawstrings and drawcords with tipped ends for hoodies, joggers, shorts and bags.

- **Highlights:** Many colours; Tipped ends; Custom lengths
- **Default unit / MOQ:** dozen / 12 **[VERIFY MOQ]**
- **Spec fields to capture:** diameter_mm, length_cm, tip_type, colour
- **Images:** `products/drawstring-cord/drawstring-cord-1.jpg`

#### Cord Stoppers  (`cord-stoppers`, code CST)
Plastic and metal cord stoppers (toggles) for drawcords, hoods, waists and bags.

- **Highlights:** Plastic and metal; Single and double hole
- **Default unit / MOQ:** gross / 1 **[VERIFY MOQ]**
- **Spec fields to capture:** size, hole_count, material, colour
- **Images:** `products/cord-stoppers/cord-stoppers-1.jpg`, `products/cord-stoppers/cord-stoppers-2.jpg`

#### Metal Snap Buttons  (`metal-snap-buttons`, code MSB)
Metal snap buttons in antique and other finishes, with custom embossed logos. Four-part sets: cap, socket, stud and post.

- **Highlights:** Custom logo; Antique and other finishes; Four-part snap sets
- **Default unit / MOQ:** gross / 1 **[VERIFY MOQ]**
- **Spec fields to capture:** size_ligne, finish, snap_parts, logo
- **Images:** `products/metal-snap-buttons/metal-snap-buttons-1.jpg`

#### Plastic Buttons  (`plastic-buttons`, code PLB)
Durable plastic buttons in two-hole and four-hole styles across a wide colour range.

- **Highlights:** 2-hole and 4-hole; Many colours and sizes
- **Default unit / MOQ:** gross / 1 **[VERIFY MOQ]**
- **Spec fields to capture:** size_ligne, holes, colour, finish
- **Images:** `products/plastic-buttons/plastic-buttons-1.jpg`

#### Shell / Pearl Buttons  (`shell-buttons`, code SHB)
Pearl and shell-finish buttons for shirts and premium garments.

- **Highlights:** Pearl and shell finish; Shirt and premium wear
- **Default unit / MOQ:** gross / 1 **[VERIFY MOQ]**
- **Spec fields to capture:** size_ligne, holes, finish
- **Images:** `products/shell-buttons/shell-buttons-1.jpg`

## 6. Clients shown in the profile (20 brand logos)

ONLY, name it, JDY, VERO MODA, NOISY MAY, ONLY & SONS, Obaïbi, Okaïdi, Pepe Jeans London, Lois, 157, ONLY Carmakoma, JULES, PIECES, Y.A.S, ONLY PLAY, JACK & JONES, SELECTED / FEMME, mama licious, VILA Clothes.

Logos are in `assets/clients/`. Permission to display must be confirmed by NR (`permission_confirmed` in the database).

## 7. Certifications named in the profile: do not publish yet

OEKO-TEX Standard 100; Forest Stewardship Council (FSC); Global Recycled Standard (GRS); amfori BSCI; ISO 9001:2015 (QMS); SEDEX/SMETA. The numbers and scans in the PDF belong to United Nine Bangladesh. Publish only the ones NR itself holds, with NR's own certificate numbers.

## 8. Machinery and capacity: reference only (UNB source)

The profile lists machine groups with capacities: Woven label (40 million/month), Printing label (25 million), Offset (30 million), Screen (5 million), Thermal sticker (40 million), RFID (2 million), String lock (6 million). These are UNB's. Replace with NR's own list on the Capabilities page when provided; the website block is disabled by the `SHOW_CAPACITY=false` flag.

## 9. Information still needed from NR (see `content_gaps` in the JSON)

- **G1** NR's own founding year, capacity, staff count. *Until then:* Not shown.
- **G2** Whether NR manufactures in-house or sources trims (cover says manufacturer & exporter). *Until then:* Neutral: 'supplier of garments trims & accessories'.
- **G3** NR's own certificates (OEKO-TEX, GRS, FSC, ISO, BSCI, SEDEX) and numbers. *Until then:* Certifications hidden.
- **G4** NR's own factory/office/team photos (some existing ones appear to show UNB branding). *Until then:* Cover building photo used in About and flagged; capabilities uses product photos.
- **G5** Facebook page, YouTube channel, website domain, QR destination. *Until then:* Social icons hidden.
- **G6** Permission to show the 20 client brand logos. *Until then:* Shown (is_active) but permission_confirmed = false; admin toggles.
- **G7** Higher-resolution product photos (embedded images are about 290 px wide). *Until then:* Use small sizes, avoid full-bleed; replace via admin upload.
- **G8** Per-product specs, colours, sizes/widths, MOQ, units. *Until then:* Default variant per product, MOQ and unit from seed.
- **G9** Trims (thread, elastic, twill tape, drawcord, stoppers, buttons) were dropped from the updated profile. *Until then:* Kept in catalogue (8 products); confirm NR still supplies them.
- **G10** BIN/TIN/trade licence, bank details, invoice footer terms. *Until then:* Left blank in settings; fields exist.
- **G11** Map location (Google Maps embed URL). *Until then:* Placeholder card.
- **G12** Bangla website copy (if a Bangla toggle is wanted). *Until then:* English only.
- **G13** Existing stock list, customers, suppliers, opening dues. *Until then:* Empty tables; import tools in admin.
- **G14** Management message/about text written for NR (current one is UNB's). *Until then:* Omitted.
