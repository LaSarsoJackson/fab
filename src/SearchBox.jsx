import React, { Component } from 'react';
import TextField from '@mui/material/TextField';

export default function SearchBox() {
  return (
    <div className='SearchBox'>
      <TextField id="firstNameInput" label="First Name" variant="outlined" />
      <TextField id="lastNameInput" label="Last Name" variant="outlined" />
      <TextField id="FullNameInput" label="Full Name" variant="outlined" />
    </div>
  );
}