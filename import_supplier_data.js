const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5433, database: 'inventory_system', user: 'postgres', password: 'junyuan123' });
const TENANT_ID = 1;
let skuC = 1, prdC = 1;
const nSku = () => `A-SKU-${String(skuC++).padStart(5,'0')}`;
const nPrd = () => `A-PRD-${String(prdC++).padStart(5,'0')}`;

const suppliers = [
  {n:'APE INDUSTRIAL SUPPLIES SDN BHD',a:'No.3, Lot 2-2, Jalan SU 6a, Seksyen 22, 40300 Shah Alam, Selangor',p:'03-5636 7429'},
  {n:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)',a:'Lot 8, 9 & 10, Jalan Emas SD 5/1, Bandar Sri Damansara, 52200 Kuala Lumpur, Federal Territory of Kuala Lumpur',p:'03-6273 1279'},
  {n:'Ikhua Hardware & Machinery Sdn Bhd',a:'Plot F Lot 1998 Jalan Perusahaan 3 Taman Perindustrian Selesa Jaya, Balakong, 43300 Seri Kembangan, Selangor',p:'03-8961 6855'},
  {n:'JET MACHINERY SDN BHD',a:null,p:null},
  {n:'JC MACHINERY SDN BHD',a:'Jalan Kapar, Batu 4, 42100 Klang, Selangor',p:null},
  {n:'Tuta Tools (M) Sdn Bhd',a:'PAGAR HIJAU - CORNER, 2, Jalan USJ 19/4a, Usj 19, 47620 Subang Jaya, Selangor',p:null},
  {n:'TECOLINE SDN BHD',a:'2, Jalan Utama 1/10, Taman Perindustrian Puchong Utama, 47100 Puchong, Selangor',p:'03-8063 2889'},
  {n:'GERENCO SDN BHD',a:'7, Jalan 3/91A, Taman Shamelin Perkasa, 56100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',p:'03-9281 3220'},
  {n:'Hero Industrial Supply Sdn Bhd',a:'62, Jalan Utama 2/16, Taman Perindustrian Maju Jaya, 47140 Puchong, Selangor',p:'03-8062 5527'},
  {n:'RNS Machinery Sdn Bhd',a:'23, Jalan Balakong Jaya 3 Taman Industri Balakong Jaya Balakong, 43300 Seri Kembangan, Selangor',p:'019-224 0675'},
  {n:'UNITED POWER MLC S/B',a:null,p:null},
  {n:'TEM ENGINEERING GROUP S/B',a:'8, Jalan TPP 6/7, Taman Perindustrian Puchong, 47100 Puchong, Selangor',p:'03-8062 4233'},
  {n:'Wai Chun Hardware (M) Sdn Bhd',a:'B5-G & 1 & 2, Jalan Rawang, PUSAT PERNIAGAAN REEF 2, 48000 Rawang, Selangor',p:'010-220 9510'},
  {n:'DENG FUNG MACHINERY sdn bhd',a:'605, Batu 3 3/4, Jalan Ipoh, 51200 Kuala Lumpur',p:'03 6258 5036 / 012-8927288'},
  {n:'Colson Machinery Sdn. Bhd.',a:'15, Jalan PJS 1/26, Taman Petaling Utama, 46150 Petaling Jaya, Selangor',p:'03-7783 3199'},
  {n:'Tools & Machinery Parts Supplies Sdn Bhd (TOMAC)',a:null,p:'03-79313381'},
  {n:'Iklim Hardware & Machinery Sdn. Bhd.',a:'23, Jalan 8/91, Taman Shamelin Perkasa, 56100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',p:'03-9284 8333'},
  {n:'Tackly Hardware & Machinery Sdn Bhd (德利机械五金有限公司)',a:'No.12, Jalan Metro Perdana Barat 11, Seri Edaran Light Industrial Park, 52100 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',p:'03-6258 5866'},
  {n:'ASB HARDWARE SDN BHD',a:'221, Jalan Mahkota, Maluri, 55100 Cheras, Wilayah Persekutuan Kuala Lumpur',p:'010-559 2506'},
  {n:'SIN YUAN MACHINERY SDN BHD',a:'Lot 10, Jalan Emas SD 5/1, Bandar Sri Damansara, 52200 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',p:'03-6276 6226'},
  {n:'sym equipment sdn bhd',a:'Lot 9, Jalan SD 5/1, Bandar Sri Damansara, 52200 Kuala Lumpur, Selangor',p:'03-6275 1492'},
  {n:'Sym Power Sdn Bhd',a:'Lot 8 & 9, Jalan Emas SD 5/1, Bandar Sri Damansara, 52200 Kuala Lumpur, Malaysia',p:null},
  {n:'VA ASIA MOTOR TOOLS HARDWARE TRADING',a:'9, Jalan Bpu 2, Kawasan Perniagaan Bandar Puchong Utama, 47100 Puchong, Selangor',p:'012-351 1605'},
  {n:'YIE HONG TRADING SDN BHD',a:'37, jalan 8/152, off, batu 6, Taman Perindustrian Oug, 58200 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',p:'03-7772 7816'},
  {n:'GLOBALL HARDWARE & MACHINERY S/B (寰球五金机械有限公司)',a:'22G, Jalan Bandar Tiga, Pusat Bandar Puchong, 47100 Puchong, Selangor',p:'03-8082 0606'},
  {n:'Bangkok Belt & Industry Centre Sdn Bhd',a:'45A & 46A, Jalan TK 1/11a, Taman Kinrara, 47180 Puchong, Selangor',p:'03-8075 7210'},
  {n:'Chye Khiang Seng (M) Sdn Bhd',a:'WISMA CKS, NO 155, Jalan Kapar, PO BOX 211, 41720, 155, Jalan Kapar, Kawasan 18, 41300 Klang, Selangor',p:'03-3341 3233'},
  {n:'SHAKO Automation & Trading Sdn Bhd',a:'37, Jalan Utama 1/1, Taman Perindustrian Puchong Utama, 47100 Puchong, Selangor',p:'03-8062 4241'},
  {n:'ZIM SONG ENTERPRISE',a:null,p:null},
  {n:'JAYA POLIGON sdn bhd',a:'13, Jalan Bestari 1/KU7, 42200 Kapar, Selangor',p:'03-3291 8885'},
  {n:'NOVITECH sdn bhd',a:'1st floor, 182b, 1, Jalan Pasar, Kawasan 18, 41400 Klang, Selangor',p:'03-3343 9551'},
  {n:'KINIKI MARKETING',a:'27, Jalan Kuchai Lama, Taman Lian Hoe, 58200 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',p:null},
  {n:'GWM marketing sdn bhd',a:'43500 Semenyih, Selangor',p:'03-8727 8930'}
];

const brands = [
  {n:'Epple',c:null,m:null,sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {n:'Europower',c:null,m:null,sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {n:'Eurox',c:null,m:null,sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {n:'EuroX Air Plus',c:null,m:null,sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {n:'EuroX Gold',c:null,m:null,sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {n:'Robintec',c:null,m:null,sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {n:'HISAKI',c:null,m:null,sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {n:'TOKU',c:'Japan',m:'Japan',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {n:'HISAKI Air Tool',c:null,m:null,sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {n:'PROCUT',c:'England',m:'Ireland',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {n:'TRELAWNY',c:'UK',m:'UK',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {n:'YAMAMOTO',c:'Taiwan',m:'Taiwan',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {n:'Bossco',c:'Taiwan',m:'Taiwan',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {n:'TARANGIN',c:null,m:null,sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {n:'CH TOOLS',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'FOUR M',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'HOMAI',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'HUMHON',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'JETMAC',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'LONG XING',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'ROMEO PROFESSIONAL',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'SEMPROX',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'Sorrano',c:null,m:null,sup:'JET MACHINERY SDN BHD'},
  {n:'JET',c:null,m:null,sup:'UNITED POWER MLC S/B'},
  {n:'Elite',c:null,m:null,sup:'UNITED POWER MLC S/B'},
  {n:'Loncin',c:null,m:null,sup:'UNITED POWER MLC S/B'},
  {n:'Yato',c:null,m:null,sup:'UNITED POWER MLC S/B'},
  {n:'kobei',c:null,m:null,sup:'Bangkok Belt & Industry Centre Sdn Bhd'},
  {n:'JIANDONG',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'SIFANG',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'TONANCO',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'ENGA',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'DELTA',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'EVERGUSH',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'HAILEA',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'SHIMGE',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'PIUSI',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'MAIDE',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'},
  {n:'CKS',c:null,m:null,sup:'Chye Khiang Seng (M) Sdn Bhd'}
];

const cats = [
  'Carpet Cleaner','Gasoline Engine','Floor Dryer','High Pressure Washer','Vacuum Cleaner','Air Compressor',
  'Airless Paint Sprayer','Diesel Engine','Diesel Generator','Diesel Tower Light','Diesel Water Pump',
  'Diesel Welding Generator','Floor Polisher','Gasoline Generator','Gasoline Water Pump','Gasoline Welding Generator',
  'Plunger Pump','Snow Wash Tank','Bar Cutter','Diamond Blade','Self Priming Pump','Submersible Pump',
  'Bar Bender','Concrete Mixer','Mini Mixer','Generator','Welding Machine','Power Cut Machine','Concrete Vibrator',
  'Power Trowel','Drilling Hydraulic','Machine Breaker','Road Cutter','Tamping Rammer','Plate Compactor',
  'Floor Scarifier','Tower Light','Concrete Breaker','Pick Hammer','Rock Drill','Chipping Hammer','Chain Hoist',
  'Baby Hammer','Air Drill','Air Winch','Impact Wrench','Air Tamper','Angle Grinder','Rotary Grinder',
  'Spray Gun','Air Nailer','Industrial Sander','Air Body Saw','Air Flux Chipper','Tungsten Carbide Bur',
  'Needle Scaling Gun','Scaling Hammer','Water Pump','Booster Pump','Swimming Pool Products',
  'Waste Water Pump','Non-Clogging Pump','Gardening Pump','Sand Filter','Horizontal Multi-stage Pump',
  'Control Constant Pressure','Sewage Pump','Sewage Cutter Pump','Under Water Light','Annular Cutter',
  'Magnetic Drill','Pilot Pin','Abrasives','Cup Brush','Grinding Cutting Disc','Welding Gloves','Marble Saw',
  'Metal Band Saw','Miter Saw','Cordless Power Tools','Car Polishing','Metal Working Machines','Pneumatic Nailer',
  'Woodworking Machines','Agriculture Product','Point Chisel','Workshop Equipments','Cutting Welding Torches',
  'Gas Regulator','Welding Accessories','Food Processing Machine','Lubricant Oil','Plumber Tools','Spark Plug',
  'Trimmer Line','Renovation Tools','Hammer Drill','CNC Machines','Lifting Systems Equipment',
  'Metalworking Drilling','Metalworking Finishing','Metalworking Metalforming','Metalworking Milling',
  'Metalworking Sawing','Metalworking Turning','Shop Tools Equipment','Clamps & Vices','Cutters',
  'Drill Tap Die','Electrician Tools','Fastening Tools','File Tools','Garden Tools','Grinding Tools',
  'Hammers Chisel','Health Safety Articles','Hex Torx Key','Hydraulic Tools','Impact Sockets',
  'Insulated Tools','Measuring Tools','Non-sparking Tools','Pliers Pipe Wrenches','Pneumatic Tools',
  'Power Gasoline Tools','Screwdrivers Bits','Socket Sets','Spanners Wrenchers','Special Automotive Tools',
  'Tool Box Storage','Tool Pouches Bags','Torque Wrenches','Bearing','Bolt And Nuts','Couplings',
  'Industrial Power Transmission Belts','Pulley','Gear Grease Gun','Roller Chain Sprocket','Induction Motor',
  'Alternator','Auto Booster Pump','Bare Pump','Diaphragm Pressure Tanks','Immersion Pump',
  'Sewage Submersible Pump','Multistage Centrifugal Pump','DC Air Compressor','High Flow Circulating Pump',
  'External Filters','Vortex Blower','Power Air Pump','Hi-Blow Diaphragm Air Pump','Surface Booster Pump',
  'Centrifugal Pump','Self Priming Jet Pump','Vertical Multistage Pump','End Suction Pump','Meter Nozzle',
  'Electric Pump','Automatic Nozzle','Bilge Pump','Hand Pump','Rotary Hand Pump','Electric Hoist',
  'Hand Winch','Level Block','Plain Pulley','High Speed Windlass','Electric Sprayer','Knapsack Sprayer',
  'Power Sprayer','Pillow Block','Transmission Belt','Conveyor Belt','Link Chains','Roller Chain',
  'Flexible Coupling','MH Chain Coupling','MH Rubber Coupling','Marine Cutless Bearing','Pallet Truck'
];

const products = [
  // APE
  {name:'Carpet Cleaner',brand:'Epple',cat:'Carpet Cleaner',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Engine',brand:'Epple',cat:'Gasoline Engine',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Carpet Cleaner',brand:'Europower',cat:'Carpet Cleaner',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Floor Dryer C/W Handle',brand:'Europower',cat:'Floor Dryer',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'High Pressure Washer',brand:'Europower',cat:'High Pressure Washer',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Vacuum',brand:'Europower',cat:'Vacuum Cleaner',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Air Compressor',brand:'Eurox',cat:'Air Compressor',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Airless Paint Sprayer',brand:'Eurox',cat:'Airless Paint Sprayer',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Diesel Engine',brand:'Eurox',cat:'Diesel Engine',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Diesel Generator',brand:'Eurox',cat:'Diesel Generator',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Diesel Tower Light',brand:'Eurox',cat:'Diesel Tower Light',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Diesel Water Pump',brand:'Eurox',cat:'Diesel Water Pump',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Diesel Welding Generator',brand:'Eurox',cat:'Diesel Welding Generator',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Floor Polisher',brand:'Eurox',cat:'Floor Polisher',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Engine',brand:'Eurox',cat:'Gasoline Engine',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Generator',brand:'Eurox',cat:'Gasoline Generator',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Water Pump',brand:'Eurox',cat:'Gasoline Water Pump',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Welding Generator',brand:'Eurox',cat:'Gasoline Welding Generator',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'High Pressure Washer',brand:'Eurox',cat:'High Pressure Washer',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Pallet Truck',brand:'Eurox',cat:'Lifting Systems Equipment',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Plunger Pump Head',brand:'Eurox',cat:'Plunger Pump',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Plunger Pump Set',brand:'Eurox',cat:'Plunger Pump',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Snow Wash Tank',brand:'Eurox',cat:'Snow Wash Tank',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Air Compressor',brand:'EuroX Air Plus',cat:'Air Compressor',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Air Compressor',brand:'EuroX Gold',cat:'Air Compressor',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Engine',brand:'EuroX Gold',cat:'Gasoline Engine',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Generator',brand:'EuroX Gold',cat:'Gasoline Generator',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline High Pressure Washer',brand:'EuroX Gold',cat:'High Pressure Washer',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Inverter Generator',brand:'EuroX Gold',cat:'Gasoline Generator',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Water Pump',brand:'EuroX Gold',cat:'Gasoline Water Pump',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  {name:'Gasoline Inverter Generator',brand:'Robintec',cat:'Gasoline Generator',sup:'APE INDUSTRIAL SUPPLIES SDN BHD'},
  // JINHUI
  {name:'Bar Cutter',brand:'HISAKI',cat:'Bar Cutter',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Diamond Blade',brand:'HISAKI',cat:'Diamond Blade',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Self Priming Pump',brand:'HISAKI',cat:'Self Priming Pump',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'HP Series Submersible Pump',brand:'HISAKI',cat:'Submersible Pump',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Bar Bender',brand:'HISAKI',cat:'Bar Bender',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Concrete Mixer',brand:'HISAKI',cat:'Concrete Mixer',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Mini Mixer',brand:'HISAKI',cat:'Mini Mixer',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Generator',brand:'HISAKI',cat:'Generator',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Welding Machine',brand:'HISAKI',cat:'Welding Machine',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Power Cut Machine',brand:'HISAKI',cat:'Power Cut Machine',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'JHI Series Submersible Pump',brand:'HISAKI',cat:'Submersible Pump',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'JHI Series Concrete Vibrator',brand:'HISAKI',cat:'Concrete Vibrator',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'HK Series Concrete Vibrator',brand:'HISAKI',cat:'Concrete Vibrator',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Power Trowel',brand:'HISAKI',cat:'Power Trowel',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Drilling Hydraulic',brand:'HISAKI',cat:'Drilling Hydraulic',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Machine Breaker',brand:'HISAKI',cat:'Machine Breaker',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Road Cutter',brand:'HISAKI',cat:'Road Cutter',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Tamping Rammer',brand:'HISAKI',cat:'Tamping Rammer',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Plate Compactor',brand:'HISAKI',cat:'Plate Compactor',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Floor Scarifier',brand:'HISAKI',cat:'Floor Scarifier',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  {name:'Tower Light',brand:'HISAKI',cat:'Tower Light',sup:'JINHUI INDUSTRIES SDN BHD (金辉工业有限公司)'},
  // Ikhua TOKU
  {name:'Concrete Breaker TPB-30,40,60,73,90',brand:'TOKU',cat:'Concrete Breaker',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Pick Hammer TCA-7',brand:'TOKU',cat:'Pick Hammer',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Rock Drill TH-5S',brand:'TOKU',cat:'Rock Drill',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Chipping Hammer AA-OB',brand:'TOKU',cat:'Chipping Hammer',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Chain Hoist 0.5-80 ton',brand:'TOKU',cat:'Chain Hoist',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Baby Hammer MH-5111',brand:'TOKU',cat:'Baby Hammer',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Air Drill MD-3311B',brand:'TOKU',cat:'Air Drill',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Air Winch',brand:'TOKU',cat:'Air Winch',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'3/4 Impact Wrench MI-2500P',brand:'TOKU',cat:'Impact Wrench',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Air Tamper TB-00G',brand:'TOKU',cat:'Air Tamper',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Angle Grinder TSG-3C',brand:'TOKU',cat:'Angle Grinder',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Rotary Grinder',brand:'TOKU',cat:'Rotary Grinder',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'1 Impact Wrench MI-5000GL',brand:'TOKU',cat:'Impact Wrench',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  // Ikhua HISAKI Air Tool
  {name:'Spray Gun K-600S',brand:'HISAKI Air Tool',cat:'Spray Gun',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'F+R+L Air Control Unit FRL-400',brand:'HISAKI Air Tool',cat:'Air Control Unit',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Air Nailer F-30',brand:'HISAKI Air Tool',cat:'Air Nailer',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Industrial Sander AS-6602',brand:'HISAKI Air Tool',cat:'Industrial Sander',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'CT-1516 Air Body Saw',brand:'HISAKI Air Tool',cat:'Air Body Saw',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'O Professional Air Flux Chipper/Scaler CS-2270',brand:'HISAKI Air Tool',cat:'Air Flux Chipper',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  // Ikhua PROCUT
  {name:'TUNGSTEN CARBIDE BUR',brand:'PROCUT',cat:'Tungsten Carbide Bur',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  // Ikhua TRELAWNY
  {name:'Needle Scaling Gun VL-303',brand:'TRELAWNY',cat:'Needle Scaling Gun',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Scaling Hammer VL SH-1H',brand:'TRELAWNY',cat:'Scaling Hammer',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Scaling Hammer SH-3H',brand:'TRELAWNY',cat:'Scaling Hammer',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  // Ikhua YAMAMOTO
  {name:'Water Pump',brand:'YAMAMOTO',cat:'Water Pump',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  // Ikhua Bossco
  {name:'Booster Pump',brand:'Bossco',cat:'Booster Pump',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  // Ikhua TARANGIN
  {name:'Auto Booster',brand:'TARANGIN',cat:'Auto Booster Pump',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Electronic Flow-Control',brand:'TARANGIN',cat:'Control Constant Pressure',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Large Mix Flow',brand:'TARANGIN',cat:'Water Pump',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'DSP Submersible Sewage Pump',brand:'TARANGIN',cat:'Sewage Submersible Pump',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Booster Pump',brand:'TARANGIN',cat:'Booster Pump',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  {name:'Under Water Light',brand:'TARANGIN',cat:'Under Water Light',sup:'Ikhua Hardware & Machinery Sdn Bhd'},
  // Bangkok Belt
  {name:'Bearing',brand:'kobei',cat:'Bearing',sup:'Bangkok Belt & Industry Centre Sdn Bhd'},
  {name:'Bolt And Nuts',brand:'kobei',cat:'Bolt And Nuts',sup:'Bangkok Belt & Industry Centre Sdn Bhd'},
  {name:'Couplings',brand:'kobei',cat:'Couplings',sup:'Bangkok Belt & Industry Centre Sdn Bhd'},
  {name:'Industrial Power Transmission Belts',brand:'kobei',cat:'Industrial Power Transmission Belts',sup:'Bangkok Belt & Industry Centre Sdn Bhd'},
  {name:'Pulley',brand:'kobei',cat:'Pulley',sup:'Bangkok Belt & Industry Centre Sdn Bhd'},
  {name:'Gear & Grease Gun',brand:'kobei',cat:'Gear Grease Gun',sup:'Bangkok Belt & Industry Centre Sdn Bhd'},
  {name:'Roller Chain & Sprocket',brand:'kobei',cat:'Roller Chain Sprocket',sup:'Bangkok Belt & Industry Centre Sdn Bhd'}
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Insert suppliers
    const supIds = {};
    for (const s of suppliers) {
      const res = await client.query(
        `INSERT INTO suppliers (tenant_id, name, address, payment_terms, lead_time_days, is_active, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,0,true,$5,now(),now()) ON CONFLICT DO NOTHING RETURNING id`,
        [TENANT_ID, s.n, s.a, null, s.p ? `Phone: ${s.p}` : null]
      );
      if (res.rows.length) supIds[s.n] = res.rows[0].id;
      else {
        const r2 = await client.query('SELECT id FROM suppliers WHERE tenant_id=$1 AND name=$2', [TENANT_ID, s.n]);
        if (r2.rows.length) supIds[s.n] = r2.rows[0].id;
      }
    }
    console.log(`Inserted ${Object.keys(supIds).length} suppliers`);

    // Insert categories
    const catIds = {};
    for (const c of cats) {
      const res = await client.query(
        `INSERT INTO categories (tenant_id, name, created_at) VALUES ($1,$2,now()) ON CONFLICT DO NOTHING RETURNING id`,
        [TENANT_ID, c]
      );
      if (res.rows.length) catIds[c] = res.rows[0].id;
      else {
        const r2 = await client.query('SELECT id FROM categories WHERE tenant_id=$1 AND name=$2', [TENANT_ID, c]);
        if (r2.rows.length) catIds[c] = r2.rows[0].id;
      }
    }
    console.log(`Inserted ${Object.keys(catIds).length} categories`);

    // Insert brands
    const brandIds = {};
    for (const b of brands) {
      const res = await client.query(
        `INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,true,now(),now()) ON CONFLICT DO NOTHING RETURNING id`,
        [TENANT_ID, b.n, null, b.c, b.m]
      );
      if (res.rows.length) brandIds[b.n] = res.rows[0].id;
      else {
        const r2 = await client.query('SELECT id FROM brands WHERE tenant_id=$1 AND name=$2', [TENANT_ID, b.n]);
        if (r2.rows.length) brandIds[b.n] = r2.rows[0].id;
      }
    }
    console.log(`Inserted ${Object.keys(brandIds).length} brands`);

    // Insert supplier_brands
    let sbCount = 0;
    for (const b of brands) {
      const sid = supIds[b.sup];
      const bid = brandIds[b.n];
      if (sid && bid) {
        await client.query(
          `INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at) VALUES ($1,$2,$3,now()) ON CONFLICT DO NOTHING`,
          [sid, bid, TENANT_ID]
        );
        sbCount++;
      }
    }
    console.log(`Linked ${sbCount} supplier-brands`);

    // Insert products
    let prodCount = 0;
    for (const p of products) {
      const bid = brandIds[p.brand];
      const cid = catIds[p.cat];
      const sid = supIds[p.sup];
      if (bid && cid) {
        await client.query(
          `INSERT INTO products (tenant_id, name, sku, sku_type, product_code, unit, cost_price, selling_price, markup_percentage, suggested_price, reorder_level, is_active, description, category_id, brand_id, created_at, updated_at)
           VALUES ($1,$2,$3,'EA',$4,'EA',0,0,0,0,0,true,$5,$6,$7,now(),now()) ON CONFLICT DO NOTHING`,
          [TENANT_ID, p.name, nSku(), nPrd(), sid ? `Supplier: ${p.sup}` : null, cid, bid]
        );
        prodCount++;
      }
    }
    console.log(`Inserted ${prodCount} products`);

    await client.query('COMMIT');
    console.log('Done!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
