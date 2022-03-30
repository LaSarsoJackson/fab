//this is where we're going to do the logic for the selectors
/*
First name + Last name OR
Birth date + Death date OR
Section + Lot OR
Section, Tier and Grave position 
*/
//add a date picker for birth and death dates

//output information to a data grid
//https://mui.com/components/text-fields/
import * as React from 'react';
import { Box } from '@mui/material';
import StaticBurialTable from './StaticBurialTable';

export default function Selector() {
  return (
    <Box component="form" sx={{marginTop: '10%',
    display: 'flex',  bgcolor: 'background.paper',
    boxShadow: 1, zIndex: '2000 !important'}}>
      
      <div className='zendex'><StaticBurialTable/></div>
    </Box>
  );
}
