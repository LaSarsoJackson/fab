/*
                "OBJECTID": 4,
                "First_Name": "Edward H",
                "Last_Name": "Davis",
                "Section": 132.0,
                "Lot": 0.0,
                "Pvt_Pub": 2,
                "Tier": 2,
                "Grave": 11,
                "Sec_Disp": "132",
                "ARC_GeoID": 13202002,
                "Birth": "6/22/1966",
                "Death": "1/21/2011"
*/
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
      field: 'fullName',
      headerName: 'Full name',
      description: 'This column has a value getter and is not sortable.',
      sortable: false,
      width: 160,
      valueGetter: (params) =>
        `${params.row.firstName || ''} ${params.row.lastName || ''}`,
    },
  ];
  
  const rows = [
 { "OBJECTID": 1, "First_Name": "Thomas E", "Last_Name": "LaMont", "Section": 215.0, "Lot": 30.0, "Pvt_Pub": 1, "Tier": 0, "Grave": 0, "Sec_Disp": "215", "ARC_GeoID": 21501030, "Birth": "7/21/1951", "Death": "1/26/2011" }, 
 { "OBJECTID": 2, "First_Name": "William G", "Last_Name": "Roe", "Section": 129.0, "Lot": 73.0, "Pvt_Pub": 1, "Tier": 0, "Grave": 0, "Sec_Disp": "129", "ARC_GeoID": 12901073, "Birth": "11/17/1917", "Death": "1/24/2011" }, 
 { "OBJECTID": 3, "First_Name": "Patricia Ann", "Last_Name": "Murray", "Section": 132.0, "Lot": 0.0, "Pvt_Pub": 2, "Tier": 2, "Grave": 12, "Sec_Disp": "132", "ARC_GeoID": 13202002, "Birth": "1/20/1940", "Death": "1/22/2011" },
 { "OBJECTID": 4, "First_Name": "Edward H", "Last_Name": "Davis", "Section": 132.0, "Lot": 0.0, "Pvt_Pub": 2, "Tier": 2, "Grave": 11, "Sec_Disp": "132", "ARC_GeoID": 13202002, "Birth": "6/22/1966", "Death": "1/21/2011" }, 
 { "OBJECTID": 5, "First_Name": "Ester S", "Last_Name": "Patti", "Section": 116.0, "Lot": 57.0, "Pvt_Pub": 1, "Tier": 0, "Grave": 0, "Sec_Disp": "116", "ARC_GeoID": 11601057, "Birth": "6/5/1961", "Death": "1/17/2011" }, 
  ];

  
  export default function DataGridDemo() {
    return (
        console.log(geo_burials),
      <div style={{ height: '40vh', width: '100vh' }}>
        <DataGrid getRowId={(row) => row.OBJECTID} 
          rows={rows}
          columns={columns}
          pageSize={5}
          rowsPerPageOptions={[5]}
          checkboxSelection
          disableSelectionOnClick
        />
      </div>
    );
  }