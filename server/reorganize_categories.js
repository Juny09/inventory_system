const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5433, database: 'inventory_system', user: 'postgres', password: 'junyuan123' });
const TENANT_ID = 1;

const mainCategories = [
  {en:'Cleaning Equipment',cn:'清洁设备'},
  {en:'Engines & Generators',cn:'引擎与发电机'},
  {en:'Pumps & Water Systems',cn:'水泵与水系统'},
  {en:'Air Compressors & Pneumatic Tools',cn:'空压机与气动工具'},
  {en:'Welding Equipment',cn:'焊接设备'},
  {en:'Power Tools & Machinery',cn:'电动工具与机械'},
  {en:'Construction Equipment',cn:'建筑设备'},
  {en:'Lifting & Hoisting Equipment',cn:'起重与吊装设备'},
  {en:'Bearings, Belts & Transmission',cn:'轴承、皮带与传动'},
  {en:'Metalworking Tools',cn:'金属加工工具'},
  {en:'Workshop & Hand Tools',cn:'车间与手动工具'},
  {en:'Cutting & Grinding Tools',cn:'切割与研磨工具'},
  {en:'Garden & Agriculture Tools',cn:'园艺与农业工具'},
  {en:'Fasteners & Hardware',cn:'紧固件与五金'},
  {en:'Miscellaneous',cn:'其他'}
];

const subMap = {
  'Carpet Cleaner':{m:'Cleaning Equipment',cn:'地毯清洗机'},
  'Floor Dryer':{m:'Cleaning Equipment',cn:'地面烘干机'},
  'High Pressure Washer':{m:'Cleaning Equipment',cn:'高压清洗机'},
  'Vacuum Cleaner':{m:'Cleaning Equipment',cn:'吸尘器'},
  'Floor Polisher':{m:'Cleaning Equipment',cn:'地面抛光机'},
  'Snow Wash Tank':{m:'Cleaning Equipment',cn:'洗车泡沫罐'},
  'Car Polishing':{m:'Cleaning Equipment',cn:'汽车抛光'},
  'Gasoline Engine':{m:'Engines & Generators',cn:'汽油发动机'},
  'Diesel Engine':{m:'Engines & Generators',cn:'柴油发动机'},
  'Diesel Generator':{m:'Engines & Generators',cn:'柴油发电机'},
  'Gasoline Generator':{m:'Engines & Generators',cn:'汽油发电机'},
  'Generator':{m:'Engines & Generators',cn:'发电机'},
  'Induction Motor':{m:'Engines & Generators',cn:'感应电机'},
  'Alternator':{m:'Engines & Generators',cn:'交流发电机'},
  'Diesel Water Pump':{m:'Pumps & Water Systems',cn:'柴油水泵'},
  'Gasoline Water Pump':{m:'Pumps & Water Systems',cn:'汽油水泵'},
  'Water Pump':{m:'Pumps & Water Systems',cn:'水泵'},
  'Booster Pump':{m:'Pumps & Water Systems',cn:'增压泵'},
  'Swimming Pool Products':{m:'Pumps & Water Systems',cn:'游泳池产品'},
  'Waste Water Pump':{m:'Pumps & Water Systems',cn:'废水泵'},
  'Non-Clogging Pump':{m:'Pumps & Water Systems',cn:'无堵塞泵'},
  'Gardening Pump':{m:'Pumps & Water Systems',cn:'园艺泵'},
  'Sand Filter':{m:'Pumps & Water Systems',cn:'砂滤器'},
  'Horizontal Multi-stage Pump':{m:'Pumps & Water Systems',cn:'卧式多级泵'},
  'Control Constant Pressure':{m:'Pumps & Water Systems',cn:'恒压控制'},
  'Sewage Pump':{m:'Pumps & Water Systems',cn:'污水泵'},
  'Sewage Cutter Pump':{m:'Pumps & Water Systems',cn:'污水切割泵'},
  'Under Water Light':{m:'Pumps & Water Systems',cn:'水下灯'},
  'Auto Booster Pump':{m:'Pumps & Water Systems',cn:'自动增压泵'},
  'Bare Pump':{m:'Pumps & Water Systems',cn:'裸泵'},
  'Diaphragm Pressure Tanks':{m:'Pumps & Water Systems',cn:'隔膜压力罐'},
  'Immersion Pump':{m:'Pumps & Water Systems',cn:'潜水泵'},
  'Sewage Submersible Pump':{m:'Pumps & Water Systems',cn:'污水潜水泵'},
  'Multistage Centrifugal Pump':{m:'Pumps & Water Systems',cn:'多级离心泵'},
  'High Flow Circulating Pump':{m:'Pumps & Water Systems',cn:'高流量循环泵'},
  'External Filters':{m:'Pumps & Water Systems',cn:'外置过滤器'},
  'Vortex Blower':{m:'Pumps & Water Systems',cn:'涡流风机'},
  'Power Air Pump':{m:'Pumps & Water Systems',cn:'气动泵'},
  'Hi-Blow Diaphragm Air Pump':{m:'Pumps & Water Systems',cn:'隔膜气泵'},
  'Surface Booster Pump':{m:'Pumps & Water Systems',cn:'表面增压泵'},
  'Centrifugal Pump':{m:'Pumps & Water Systems',cn:'离心泵'},
  'Self Priming Jet Pump':{m:'Pumps & Water Systems',cn:'自吸喷射泵'},
  'Vertical Multistage Pump':{m:'Pumps & Water Systems',cn:'立式多级泵'},
  'End Suction Pump':{m:'Pumps & Water Systems',cn:'端吸泵'},
  'Meter Nozzle':{m:'Pumps & Water Systems',cn:'计量喷嘴'},
  'Electric Pump':{m:'Pumps & Water Systems',cn:'电动泵'},
  'Automatic Nozzle':{m:'Pumps & Water Systems',cn:'自动喷嘴'},
  'Bilge Pump':{m:'Pumps & Water Systems',cn:'舱底泵'},
  'Hand Pump':{m:'Pumps & Water Systems',cn:'手动泵'},
  'Rotary Hand Pump':{m:'Pumps & Water Systems',cn:'旋转手泵'},
  'Self Priming Pump':{m:'Pumps & Water Systems',cn:'自吸泵'},
  'Submersible Pump':{m:'Pumps & Water Systems',cn:'潜水泵'},
  'Air Compressor':{m:'Air Compressors & Pneumatic Tools',cn:'空气压缩机'},
  'DC Air Compressor':{m:'Air Compressors & Pneumatic Tools',cn:'直流空压机'},
  'Pneumatic Nailer':{m:'Air Compressors & Pneumatic Tools',cn:'气动钉枪'},
  'Pneumatic Tools':{m:'Air Compressors & Pneumatic Tools',cn:'气动工具'},
  'Spray Gun':{m:'Air Compressors & Pneumatic Tools',cn:'喷枪'},
  'Air Nailer':{m:'Air Compressors & Pneumatic Tools',cn:'气动钉枪'},
  'Air Body Saw':{m:'Air Compressors & Pneumatic Tools',cn:'气动锯'},
  'Air Flux Chipper':{m:'Air Compressors & Pneumatic Tools',cn:'气动铲'},
  'Air Drill':{m:'Air Compressors & Pneumatic Tools',cn:'气动钻'},
  'Air Tamper':{m:'Air Compressors & Pneumatic Tools',cn:'气动夯实机'},
  'Air Winch':{m:'Air Compressors & Pneumatic Tools',cn:'气动绞车'},
  'Diesel Welding Generator':{m:'Welding Equipment',cn:'柴油焊接发电机'},
  'Gasoline Welding Generator':{m:'Welding Equipment',cn:'汽油焊接发电机'},
  'Welding Machine':{m:'Welding Equipment',cn:'焊接机'},
  'Welding Gloves':{m:'Welding Equipment',cn:'焊接手套'},
  'Cutting Welding Torches':{m:'Welding Equipment',cn:'切割焊接炬'},
  'Gas Regulator':{m:'Welding Equipment',cn:'气体调节器'},
  'Welding Accessories':{m:'Welding Equipment',cn:'焊接配件'},
  'Cordless Power Tools':{m:'Power Tools & Machinery',cn:'无绳电动工具'},
  'Hammer Drill':{m:'Power Tools & Machinery',cn:'冲击钻'},
  'Angle Grinder':{m:'Power Tools & Machinery',cn:'角磨机'},
  'Rotary Grinder':{m:'Power Tools & Machinery',cn:'旋转磨床'},
  'Impact Wrench':{m:'Power Tools & Machinery',cn:'冲击扳手'},
  'Industrial Sander':{m:'Power Tools & Machinery',cn:'工业砂光机'},
  'Power Cut Machine':{m:'Power Tools & Machinery',cn:'切割机'},
  'CNC Machines':{m:'Power Tools & Machinery',cn:'数控机床'},
  'Power Gasoline Tools':{m:'Power Tools & Machinery',cn:'汽油动力工具'},
  'Concrete Mixer':{m:'Construction Equipment',cn:'混凝土搅拌机'},
  'Mini Mixer':{m:'Construction Equipment',cn:'小型搅拌机'},
  'Concrete Vibrator':{m:'Construction Equipment',cn:'混凝土振动器'},
  'Power Trowel':{m:'Construction Equipment',cn:'动力抹平机'},
  'Drilling Hydraulic':{m:'Construction Equipment',cn:'液压钻机'},
  'Machine Breaker':{m:'Construction Equipment',cn:'破碎机'},
  'Road Cutter':{m:'Construction Equipment',cn:'路面切割机'},
  'Tamping Rammer':{m:'Construction Equipment',cn:'打夯机'},
  'Plate Compactor':{m:'Construction Equipment',cn:'平板压实机'},
  'Floor Scarifier':{m:'Construction Equipment',cn:'地面刨铣机'},
  'Tower Light':{m:'Construction Equipment',cn:'塔灯'},
  'Concrete Breaker':{m:'Construction Equipment',cn:'混凝土破碎锤'},
  'Pick Hammer':{m:'Construction Equipment',cn:'镐锤'},
  'Rock Drill':{m:'Construction Equipment',cn:'凿岩机'},
  'Chipping Hammer':{m:'Construction Equipment',cn:'凿毛锤'},
  'Baby Hammer':{m:'Construction Equipment',cn:'小锤'},
  'Bar Cutter':{m:'Construction Equipment',cn:'钢筋切断机'},
  'Bar Bender':{m:'Construction Equipment',cn:'钢筋弯曲机'},
  'Diamond Blade':{m:'Construction Equipment',cn:'金刚石锯片'},
  'Point Chisel':{m:'Construction Equipment',cn:'尖凿'},
  'Renovation Tools':{m:'Construction Equipment',cn:'翻新工具'},
  'Chain Hoist':{m:'Lifting & Hoisting Equipment',cn:'链式葫芦'},
  'Pallet Truck':{m:'Lifting & Hoisting Equipment',cn:'托盘车'},
  'Electric Hoist':{m:'Lifting & Hoisting Equipment',cn:'电动葫芦'},
  'Hand Winch':{m:'Lifting & Hoisting Equipment',cn:'手动绞车'},
  'Level Block':{m:'Lifting & Hoisting Equipment',cn:'水平块'},
  'Plain Pulley':{m:'Lifting & Hoisting Equipment',cn:'普通滑轮'},
  'High Speed Windlass':{m:'Lifting & Hoisting Equipment',cn:'高速绞车'},
  'Lifting Systems Equipment':{m:'Lifting & Hoisting Equipment',cn:'起重系统设备'},
  'Bearing':{m:'Bearings, Belts & Transmission',cn:'轴承'},
  'Couplings':{m:'Bearings, Belts & Transmission',cn:'联轴器'},
  'Industrial Power Transmission Belts':{m:'Bearings, Belts & Transmission',cn:'工业传动带'},
  'Pulley':{m:'Bearings, Belts & Transmission',cn:'滑轮'},
  'Gear Grease Gun':{m:'Bearings, Belts & Transmission',cn:'齿轮黄油枪'},
  'Roller Chain Sprocket':{m:'Bearings, Belts & Transmission',cn:'滚子链轮'},
  'Pillow Block':{m:'Bearings, Belts & Transmission',cn:'轴承座'},
  'Transmission Belt':{m:'Bearings, Belts & Transmission',cn:'传动带'},
  'Conveyor Belt':{m:'Bearings, Belts & Transmission',cn:'输送带'},
  'Link Chains':{m:'Bearings, Belts & Transmission',cn:'链环'},
  'Roller Chain':{m:'Bearings, Belts & Transmission',cn:'滚子链'},
  'Flexible Coupling':{m:'Bearings, Belts & Transmission',cn:'柔性联轴器'},
  'MH Chain Coupling':{m:'Bearings, Belts & Transmission',cn:'MH链条联轴器'},
  'MH Rubber Coupling':{m:'Bearings, Belts & Transmission',cn:'MH橡胶联轴器'},
  'Marine Cutless Bearing':{m:'Bearings, Belts & Transmission',cn:'船用轴承'},
  'Annular Cutter':{m:'Metalworking Tools',cn:'环形铣刀'},
  'Magnetic Drill':{m:'Metalworking Tools',cn:'磁座钻'},
  'Pilot Pin':{m:'Metalworking Tools',cn:'导销'},
  'Metal Working Machines':{m:'Metalworking Tools',cn:'金属加工机械'},
  'Metalworking Drilling':{m:'Metalworking Tools',cn:'金属加工钻削'},
  'Metalworking Finishing':{m:'Metalworking Tools',cn:'金属加工精加工'},
  'Metalworking Metalforming':{m:'Metalworking Tools',cn:'金属加工成型'},
  'Metalworking Milling':{m:'Metalworking Tools',cn:'金属加工铣削'},
  'Metalworking Sawing':{m:'Metalworking Tools',cn:'金属加工锯切'},
  'Metalworking Turning':{m:'Metalworking Tools',cn:'金属加工车削'},
  'Workshop Equipments':{m:'Workshop & Hand Tools',cn:'车间设备'},
  'Shop Tools Equipment':{m:'Workshop & Hand Tools',cn:'车间工具设备'},
  'Clamps & Vices':{m:'Workshop & Hand Tools',cn:'夹具与台虎钳'},
  'Cutters':{m:'Workshop & Hand Tools',cn:'切割工具'},
  'Drill Tap Die':{m:'Workshop & Hand Tools',cn:'钻丝锥模具'},
  'Electrician Tools':{m:'Workshop & Hand Tools',cn:'电工工具'},
  'Fastening Tools':{m:'Workshop & Hand Tools',cn:'紧固工具'},
  'File Tools':{m:'Workshop & Hand Tools',cn:'锉刀工具'},
  'Garden Tools':{m:'Workshop & Hand Tools',cn:'园艺工具'},
  'Hammers Chisel':{m:'Workshop & Hand Tools',cn:'锤凿'},
  'Hex Torx Key':{m:'Workshop & Hand Tools',cn:'六角梅花扳手'},
  'Hydraulic Tools':{m:'Workshop & Hand Tools',cn:'液压工具'},
  'Impact Sockets':{m:'Workshop & Hand Tools',cn:'冲击套筒'},
  'Insulated Tools':{m:'Workshop & Hand Tools',cn:'绝缘工具'},
  'Measuring Tools':{m:'Workshop & Hand Tools',cn:'测量工具'},
  'Non-sparking Tools':{m:'Workshop & Hand Tools',cn:'防爆工具'},
  'Pliers Pipe Wrenches':{m:'Workshop & Hand Tools',cn:'钳子与管钳'},
  'Screwdrivers Bits':{m:'Workshop & Hand Tools',cn:'螺丝刀头'},
  'Socket Sets':{m:'Workshop & Hand Tools',cn:'套筒组'},
  'Spanners Wrenchers':{m:'Workshop & Hand Tools',cn:'扳手'},
  'Special Automotive Tools':{m:'Workshop & Hand Tools',cn:'专用汽车工具'},
  'Tool Box Storage':{m:'Workshop & Hand Tools',cn:'工具箱收纳'},
  'Tool Pouches Bags':{m:'Workshop & Hand Tools',cn:'工具袋'},
  'Torque Wrenches':{m:'Workshop & Hand Tools',cn:'扭力扳手'},
  'Plumber Tools':{m:'Workshop & Hand Tools',cn:'水管工工具'},
  'Health Safety Articles':{m:'Workshop & Hand Tools',cn:'健康安全用品'},
  'Abrasives':{m:'Cutting & Grinding Tools',cn:'磨料'},
  'Cup Brush':{m:'Cutting & Grinding Tools',cn:'杯刷'},
  'Grinding Cutting Disc':{m:'Cutting & Grinding Tools',cn:'磨切割片'},
  'Marble Saw':{m:'Cutting & Grinding Tools',cn:'大理石锯'},
  'Metal Band Saw':{m:'Cutting & Grinding Tools',cn:'金属带锯'},
  'Miter Saw':{m:'Cutting & Grinding Tools',cn:'斜切锯'},
  'Grinding Tools':{m:'Cutting & Grinding Tools',cn:'研磨工具'},
  'Agriculture Product':{m:'Garden & Agriculture Tools',cn:'农业产品'},
  'Electric Sprayer':{m:'Garden & Agriculture Tools',cn:'电动喷雾器'},
  'Knapsack Sprayer':{m:'Garden & Agriculture Tools',cn:'背负式喷雾器'},
  'Power Sprayer':{m:'Garden & Agriculture Tools',cn:'动力喷雾器'},
  'Trimmer Line':{m:'Garden & Agriculture Tools',cn:'修剪机线'},
  'Spark Plug':{m:'Garden & Agriculture Tools',cn:'火花塞'},
  'Lubricant Oil':{m:'Garden & Agriculture Tools',cn:'润滑油'},
  'Bolt And Nuts':{m:'Fasteners & Hardware',cn:'螺栓螺母'},
  'Food Processing Machine':{m:'Miscellaneous',cn:'食品加工机'},
  'Tungsten Carbide Bur':{m:'Miscellaneous',cn:'硬质合金旋转锉'},
  'Needle Scaling Gun':{m:'Miscellaneous',cn:'针式除锈枪'},
  'Scaling Hammer':{m:'Miscellaneous',cn:'除锈锤'},
  'Air Control Unit':{m:'Air Compressors & Pneumatic Tools',cn:'空气控制单元'}
};

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert main categories
    const mainIds = {};
    for (const mc of mainCategories) {
      const fullName = `${mc.en}(${mc.cn})`;
      const res = await client.query(
        `INSERT INTO categories (tenant_id, name, created_at) VALUES ($1, $2, now()) ON CONFLICT DO NOTHING RETURNING id`,
        [TENANT_ID, fullName]
      );
      if (res.rows.length) {
        mainIds[mc.en] = res.rows[0].id;
      } else {
        const r2 = await client.query('SELECT id FROM categories WHERE tenant_id=$1 AND name=$2', [TENANT_ID, fullName]);
        if (r2.rows.length) mainIds[mc.en] = r2.rows[0].id;
      }
    }
    console.log(`Created ${Object.keys(mainIds).length} main categories`);

    // 2. Update sub categories: set name to en(cn) and parent_id
    let updated = 0;
    for (const [oldName, info] of Object.entries(subMap)) {
      const newName = `${oldName}(${info.cn})`;
      const parentId = mainIds[info.m];
      if (parentId) {
        // Check if a category with newName already exists (to avoid unique conflict)
        const check = await client.query('SELECT id FROM categories WHERE tenant_id=$1 AND name=$2', [TENANT_ID, newName]);
        if (check.rows.length && check.rows[0].id) {
          // Already exists with new name, skip rename but update parent
          await client.query('UPDATE categories SET parent_id=$1 WHERE id=$2 AND tenant_id=$3', [parentId, check.rows[0].id, TENANT_ID]);
        } else {
          // Check if old name exists
          const old = await client.query('SELECT id FROM categories WHERE tenant_id=$1 AND name=$2', [TENANT_ID, oldName]);
          if (old.rows.length) {
            await client.query('UPDATE categories SET name=$1, parent_id=$2 WHERE id=$3 AND tenant_id=$4', [newName, parentId, old.rows[0].id, TENANT_ID]);
          }
        }
        updated++;
      }
    }
    console.log(`Updated ${updated} sub categories`);

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
