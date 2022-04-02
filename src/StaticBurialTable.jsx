import geo_burials from "./data/Geo_Burials.json"
import ReactDataGrid from '@inovua/reactdatagrid-community'
import '@inovua/reactdatagrid-community/index.css'

import NumberFilter from '@inovua/reactdatagrid-community/NumberFilter'

const columns = [
  { name: 'OBJECTID', header: 'ID', type:'number', minWidth: 90, filterEditor: NumberFilter,},
  {
    name: 'First_Name',
    header: 'First name',
    type: 'string',
    minWidth: 150,
  },
  {
    name: 'Last_Name',
    header: 'Last name',
    type: 'string',
    minWidth: 150,
  },
  {
    name: 'Section',
    header: 'Section',
    type: 'number',
    minWidth: 110,
    filterEditor: NumberFilter,
  },
  {
    name: 'Lot',
    header: 'Lot',
    type: 'number',
    minWidth: 110,
    filterEditor: NumberFilter,
  },
  {
    name: 'Pvt_Pub',
    header: 'Pvt_Pub',
    type: 'number',
    minWidth: 110,
    filterEditor: NumberFilter,

  },
  {
    name: 'Tier',
    header: 'Tier',
    type: 'number',
    minWidth: 110,
    filterEditor: NumberFilter,

  },
  {
    name: 'Grave',
    header: 'Grave',
    type: 'number',
    minWidth: 110,
    filterEditor: NumberFilter,
  },
  {
    name: 'Sec_Disp',
    header: 'Sec_Disp',
    type: 'number',
    minWidth: 110,
    filterEditor: NumberFilter,
  },
  {
    name: 'ARC_GeoID',
    header: 'GEOID',
    type: 'number',
    minWidth: 110,
    filterEditor: NumberFilter,
  },
  {
    name: 'Birth',
    header: 'Birth',
    type: 'date',
    minWidth: 110,
  },
  {
    name: 'Death',
    header: 'Death',
    type: 'date',
    minWidth: 110,
  },
];
let geo_burials_rows = [];
for (let i = 0; i < geo_burials.features.length; i++) {
  let feature = geo_burials.features[i];
  let row = {
    OBJECTID: feature.properties.OBJECTID,
    First_Name: feature.properties.First_Name,
    Last_Name: feature.properties.Last_Name,
    Section: feature.properties.Section,
    Lot: feature.properties.Lot,
    Pvt_Pub: feature.properties.Pvt_Pub,
    Tier: feature.properties.Tier,
    Grave: feature.properties.Grave,
    Sec_Disp: feature.properties.Sec_Disp,
    ARC_GeoID: feature.properties.ARC_GeoID,
    Birth: feature.properties.Birth,
    Death: feature.properties.Death,
  };
  geo_burials_rows.push(row);
}
//copilot wrote this, but I don't understand it

const gridStyle = { minHeight: 550 };

const filterValue = [
  { name: 'First_Name', operator: 'startsWith', type: 'string', value: '' },
  { name: 'Last_Name', operator: 'startsWith', type: 'string', value: '' },
  { name: 'Section', operator: 'eq', type: 'number' },
  { name: 'Lot', operator: 'eq', type: 'number' },
  { name: 'Tier', operator: 'eq', type: 'number' },
];


//https://reactdatagrid.io/docs/filtering

export default function StaticBurialTable() {
  return (
    console.log(geo_burials_rows),
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flexGrow: 1 }}>
        <ReactDataGrid
          idProperty="OBJECTID"
          columns={columns}
          pagination
          defaultLimit={15}
          defaultSkip={15}
          defaultFilterValue={filterValue}
          pageSizes={[10, 15, 30]}
          dataSource={geo_burials_rows}
          style={gridStyle}
        />


      </div>
    </div>
  );
}