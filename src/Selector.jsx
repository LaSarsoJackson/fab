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
    <div style={{ height: 350, width: '100%' }}><StaticBurialTable /></div>
  );
}
