
import { DataGrid } from '@mui/x-data-grid';
import geo_burials from "./data/Geo_Burials.json";

const columns = [
  { field: 'OBJECTID', headerName: 'ID', width: 90 },
  {
    field: 'First_Name',
    headerName: 'First name',
    width: 150,
    editable: false,
  },
  {
    field: 'Last_Name',
    headerName: 'Last name',
    width: 150,
    editable: false,
  },
  {
    field: 'Section',
    headerName: 'Section',
    type: 'number',
    width: 110,
    editable: false,
  },
  {
    field: 'Lot',
    headerName: 'Lot',
    type: 'number',
    width: 110,
    editable: false,
  },
  {
    field: 'Pvt_Pub',
    headerName: 'Pvt_Pub',
    type: 'number',
    width: 110,
    editable: false,
  },
  {
    field: 'Tier',
    headerName: 'Tier',
    type: 'number',
    width: 110,
    editable: false,
  },
  {
    field: 'Grave',
    headerName: 'Grave',
    type: 'number',
    width: 110,
    editable: false,
  },
  {
    field: 'Sec_Disp',
    headerName: 'Sec_Disp',
    type: 'number',
    width: 110,
    editable: false,
  },
  {
    field: 'ARC_GeoID',
    headerName: 'GEOID',
    type: 'number',
    width: 110,
    editable: false,
  },
  {
    field: 'Birth',
    headerName: 'Birth',
    type: 'date',
    width: 110,
    editable: false,
  },
  {
    field: 'Death',
    headerName: 'Death',
    type: 'date',
    width: 110,
    editable: false,
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


export default function StaticBurialTable() {
  return (
    console.log(geo_burials_rows),
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flexGrow: 1 }}>
        <DataGrid getRowId={(row) => row.OBJECTID}
          rows={geo_burials_rows}
          columns={columns}
          pageSize={5}
          rowsPerPageOptions={[5]}
          checkboxSelection
          disableSelectionOnClick
        />
      </div>
    </div>
  );
}